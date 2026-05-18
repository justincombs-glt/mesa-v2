// ============================================================================
// GET /api/cron/device-metrics-pull
//
// Phase 9b: Vercel cron endpoint that runs every 30 minutes and pulls device
// metrics for practices that have ended 30+ minutes ago.
//
// For each eligible (practice, athlete) combo:
//   1. Skip if metrics already pulled successfully (idempotent)
//   2. Skip if athlete has no Google Health connection
//   3. Otherwise call pullPracticeForAthlete which:
//      - refreshes the token if needed
//      - calls Google Health API
//      - saves metrics + logs attempt
//
// Auth: same CRON_SECRET mechanism as the weekly digest cron.
//
// Manual testing: same as digest cron — pass ?token=... to authenticate,
// ?only_activity_id=... to target a single practice, ?dry_run=true to skip writes.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pullPracticeForAthlete } from '@/lib/devices/practice-pull';
import { computePracticeWindow } from '@/lib/devices/practice-window';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

interface ProcessedItem {
  activity_id: string;
  student_id: string;
  status: string;
  error?: string;
}

export async function GET(req: NextRequest) {
  // ----- Auth -----
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  const tokenQuery = req.nextUrl.searchParams.get('token');
  if (authHeader !== `Bearer ${cronSecret}` && tokenQuery !== cronSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // ----- Service-role client (bypasses RLS so we can read across users) -----
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase env not configured' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const onlyActivityId = req.nextUrl.searchParams.get('only_activity_id');
  const dryRun = req.nextUrl.searchParams.get('dry_run') === 'true';

  // ----- Find candidate practices -----
  // A practice is eligible to pull if:
  //   - activity_type = 'practice'
  //   - occurred_on is recent (within last 7 days — don't try to backfill ancient ones)
  //   - the practice end (occurred_on + starts_at + duration) is at least 30 min ago
  //
  // We fetch practices from the last 7 days and filter in code since the
  // end-time computation depends on civil-time math.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let activitiesQuery = supabase
    .from('activities')
    .select('id, occurred_on, starts_at, duration_minutes')
    .eq('activity_type', 'practice')
    .gte('occurred_on', sevenDaysAgo);
  if (onlyActivityId) {
    activitiesQuery = activitiesQuery.eq('id', onlyActivityId);
  }
  const { data: actsRaw, error: actsErr } = await activitiesQuery;
  if (actsErr) {
    return NextResponse.json({ error: 'failed to load practices', detail: actsErr.message }, { status: 500 });
  }
  const acts = ((actsRaw ?? []) as Array<{
    id: string;
    occurred_on: string;
    starts_at: string | null;
    duration_minutes: number | null;
  }>);

  const nowMs = Date.now();
  const eligibleActs = [];
  for (const a of acts) {
    const w = computePracticeWindow(a.occurred_on, a.starts_at, a.duration_minutes);
    if (!w) continue;
    // Practice must have ended 30+ min ago
    if (w.utc_end.getTime() > nowMs - 30 * 60 * 1000) continue;
    eligibleActs.push({ activity: a, window: w });
  }

  // ----- Per-activity processing -----
  const results: ProcessedItem[] = [];

  for (const { activity, window } of eligibleActs) {
    // Find rostered athletes
    const { data: rosterRows } = await supabase
      .from('activity_students')
      .select('student_id, students(id, profile_id)')
      .eq('activity_id', activity.id);
    const roster = ((rosterRows ?? []) as Array<{
      student_id: string;
      students: { id: string; profile_id: string | null } | null;
    }>);

    // Find existing successful metrics rows so we can skip them
    const { data: existingRows } = await supabase
      .from('practice_device_metrics')
      .select('student_id')
      .eq('activity_id', activity.id)
      .eq('provider', 'google_health');
    const alreadyPulled = new Set(
      ((existingRows ?? []) as Array<{ student_id: string }>).map((r) => r.student_id),
    );

    for (const r of roster) {
      if (!r.students?.profile_id) continue;  // Athlete has no auth profile (manual record)
      if (alreadyPulled.has(r.student_id)) continue;  // Already pulled

      if (dryRun) {
        results.push({
          activity_id: activity.id,
          student_id: r.student_id,
          status: 'would_pull',
        });
        continue;
      }

      const pull = await pullPracticeForAthlete({
        supabase,
        activity_id: activity.id,
        student_id: r.student_id,
        profile_id: r.students.profile_id,
        civil_start: window.civil_start,
        civil_end: window.civil_end,
        utc_start: window.utc_start,
        utc_end: window.utc_end,
      });
      results.push({
        activity_id: activity.id,
        student_id: r.student_id,
        status: pull.status,
        error: pull.error,
      });
    }
  }

  const summary = {
    eligible_practices: eligibleActs.length,
    total_attempts: results.length,
    success: results.filter((r) => r.status === 'success').length,
    no_data: results.filter((r) => r.status === 'no_data').length,
    no_connection: results.filter((r) => r.status === 'no_connection').length,
    token_refresh_failed: results.filter((r) => r.status === 'token_refresh_failed').length,
    rate_limit: results.filter((r) => r.status === 'rate_limit').length,
    api_error: results.filter((r) => r.status === 'api_error').length,
    unexpected_error: results.filter((r) => r.status === 'unexpected_error').length,
    would_pull: results.filter((r) => r.status === 'would_pull').length,
    dry_run: dryRun,
    results,
  };

  return NextResponse.json(summary, {
    headers: {
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}
