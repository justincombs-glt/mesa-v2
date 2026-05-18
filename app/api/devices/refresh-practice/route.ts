// ============================================================================
// POST /api/devices/refresh-practice
//
// Phase 9b: staff-triggered on-demand pull of device metrics for a single
// practice. The coach view will eventually have a "Refresh device data"
// button; this endpoint backs it.
//
// Body: JSON { activity_id: string }
//
// Auth: must be a signed-in staff member (admin/director/coach/trainer).
//
// Internally calls the same logic as the cron — pulls fresh metrics for every
// rostered athlete with a connected device, regardless of whether they were
// already pulled. (Different from the cron which skips already-pulled rows.)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createUserClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { pullPracticeForAthlete } from '@/lib/devices/practice-pull';
import { computePracticeWindow } from '@/lib/devices/practice-window';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const STAFF_ROLES = new Set(['admin', 'director', 'coach', 'trainer']);

export async function POST(req: NextRequest) {
  // ----- Auth: user must be signed in -----
  const userClient = createUserClient();
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // ----- Authorization: user must be staff -----
  const { data: profileRow } = await userClient
    .from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
  const role = (profileRow as { role: string } | null)?.role;
  if (!role || !STAFF_ROLES.has(role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // ----- Read body -----
  let body: { activity_id?: string };
  try {
    body = await req.json() as { activity_id?: string };
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 });
  }
  const activity_id = body.activity_id;
  if (!activity_id) {
    return NextResponse.json({ error: 'activity_id required' }, { status: 400 });
  }

  // ----- Service-role client for cross-user data access -----
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'service config missing' }, { status: 500 });
  }
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ----- Load practice -----
  const { data: actRow } = await supabase
    .from('activities')
    .select('id, activity_type, occurred_on, starts_at, duration_minutes')
    .eq('id', activity_id)
    .maybeSingle();
  const act = actRow as {
    id: string; activity_type: string; occurred_on: string;
    starts_at: string | null; duration_minutes: number | null;
  } | null;
  if (!act) {
    return NextResponse.json({ error: 'practice not found' }, { status: 404 });
  }
  if (act.activity_type !== 'practice') {
    return NextResponse.json({ error: 'activity is not a practice' }, { status: 400 });
  }

  const window = computePracticeWindow(act.occurred_on, act.starts_at, act.duration_minutes);
  if (!window) {
    return NextResponse.json({ error: 'could not compute practice window' }, { status: 400 });
  }

  // ----- Load roster -----
  const { data: rosterRows } = await supabase
    .from('activity_students')
    .select('student_id, students(id, profile_id)')
    .eq('activity_id', act.id);
  const roster = ((rosterRows ?? []) as Array<{
    student_id: string;
    students: { id: string; profile_id: string | null } | null;
  }>);

  // ----- Pull each athlete -----
  const results = [];
  for (const r of roster) {
    if (!r.students?.profile_id) {
      results.push({ student_id: r.student_id, status: 'no_profile' });
      continue;
    }
    const pull = await pullPracticeForAthlete({
      supabase,
      activity_id: act.id,
      student_id: r.student_id,
      profile_id: r.students.profile_id,
      civil_start: window.civil_start,
      civil_end: window.civil_end,
      utc_start: window.utc_start,
      utc_end: window.utc_end,
    });
    results.push({
      student_id: r.student_id,
      status: pull.status,
      error: pull.error,
    });
  }

  return NextResponse.json({
    activity_id,
    total: results.length,
    results,
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
    },
  });
}
