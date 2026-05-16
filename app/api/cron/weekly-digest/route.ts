// ============================================================================
// Weekly digest cron endpoint
//
// Phase 8c: GET /api/cron/weekly-digest
//
// Trigger: Vercel Cron Jobs, configured in vercel.json to run every Friday
// at 6 PM Eastern (per Q1 = C). Vercel sends a GET request with an
// Authorization header containing CRON_SECRET (an env var we set).
//
// Manual / test trigger: passing ?force=true&token=<CRON_SECRET> in the URL
// runs the job on-demand. Useful for testing before Friday rolls around.
//
// Workflow:
//   1. Authenticate the request (header OR token query)
//   2. Resolve date range — past week (rangeStart..rangeEnd) + upcoming week
//   3. Load every profile where digest_enabled = true AND role in (student,player,parent)
//   4. For each, build digest content; if non-empty, send via Resend; log result
//   5. Return summary JSON
//
// Service-role client used to bypass RLS (we're aggregating across users).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildDigestForProfile } from '@/lib/email/digest';
import { buildDigestEmail } from '@/lib/email/templates/digest';
import { sendEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
// Increase timeout for big jobs — Vercel hobby allows up to 60s on cron endpoints
export const maxDuration = 60;

interface SendResult {
  profile_id: string;
  email: string;
  status: 'success' | 'skipped_empty' | 'skipped_disabled' | 'error';
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
  const isAuthorized =
    authHeader === `Bearer ${cronSecret}` ||
    tokenQuery === cronSecret;
  if (!isAuthorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // ----- Service-role client -----
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase env not configured' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ----- Date range -----
  // Past week = last 7 days ending today.
  // Upcoming = next 7 days starting tomorrow.
  // All in Eastern Time per Q9 = A.
  const today = _todayInET();
  const rangeEnd = today;
  const rangeStart = _addDays(today, -6);
  const upcomingEnd = _addDays(today, 7);

  // ----- Load eligible recipients -----
  const { data: recipientRows, error: recErr } = await supabase
    .from('profiles')
    .select('id, email, role, full_name, notification_settings!inner(digest_enabled)')
    .in('role', ['student', 'player', 'parent']);
  if (recErr) {
    return NextResponse.json({ error: 'failed to load recipients', detail: recErr.message }, { status: 500 });
  }
  const allRecipients = ((recipientRows ?? []) as unknown as Array<{
    id: string;
    email: string;
    role: string;
    full_name: string | null;
    notification_settings: { digest_enabled: boolean } | Array<{ digest_enabled: boolean }>;
  }>);

  // Normalize: Supabase returns notification_settings as array OR object depending on relationship
  const normalized = allRecipients.map((r) => ({
    id: r.id, email: r.email, role: r.role, full_name: r.full_name,
    digest_enabled: Array.isArray(r.notification_settings)
      ? r.notification_settings[0]?.digest_enabled ?? true
      : r.notification_settings?.digest_enabled ?? true,
  }));

  // Optional ?only=<profileId> for targeted testing
  const onlyId = req.nextUrl.searchParams.get('only');
  const recipients = onlyId
    ? normalized.filter((r) => r.id === onlyId)
    : normalized;

  // Optional ?dry_run=true to skip actual sends
  const dryRun = req.nextUrl.searchParams.get('dry_run') === 'true';

  // ----- Site URL -----
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000';

  // ----- Per-recipient send loop -----
  const results: SendResult[] = [];

  for (const r of recipients) {
    // Skip if digest disabled
    if (!r.digest_enabled) {
      results.push({ profile_id: r.id, email: r.email, status: 'skipped_disabled' });
      await _logSend(supabase, r.id, rangeStart, rangeEnd, 'skipped_disabled');
      continue;
    }

    // Build content
    let content;
    try {
      content = await buildDigestForProfile(supabase, r.id, rangeStart, rangeEnd, upcomingEnd);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ profile_id: r.id, email: r.email, status: 'error', error: msg });
      await _logSend(supabase, r.id, rangeStart, rangeEnd, 'error', msg);
      continue;
    }

    if (!content) {
      results.push({ profile_id: r.id, email: r.email, status: 'skipped_empty' });
      await _logSend(supabase, r.id, rangeStart, rangeEnd, 'skipped_empty');
      continue;
    }

    // Resolve unsubscribe token
    const { data: tokenRow } = await supabase
      .from('notification_settings')
      .select('unsubscribe_token')
      .eq('profile_id', r.id)
      .maybeSingle();
    const token = (tokenRow as { unsubscribe_token: string } | null)?.unsubscribe_token ?? '';

    // Build payload
    const payload = buildDigestEmail({ content, siteUrl, unsubscribeToken: token });

    if (dryRun) {
      results.push({ profile_id: r.id, email: r.email, status: 'success' });
      continue;
    }

    const sent = await sendEmail({
      to: r.email,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    if (sent) {
      results.push({ profile_id: r.id, email: r.email, status: 'success' });
      await _logSend(supabase, r.id, rangeStart, rangeEnd, 'success');
    } else {
      results.push({ profile_id: r.id, email: r.email, status: 'error', error: 'sendEmail returned false' });
      await _logSend(supabase, r.id, rangeStart, rangeEnd, 'error', 'sendEmail returned false');
    }
  }

  const summary = {
    range_start: rangeStart,
    range_end: rangeEnd,
    upcoming_end: upcomingEnd,
    total: results.length,
    success: results.filter((r) => r.status === 'success').length,
    skipped_empty: results.filter((r) => r.status === 'skipped_empty').length,
    skipped_disabled: results.filter((r) => r.status === 'skipped_disabled').length,
    error: results.filter((r) => r.status === 'error').length,
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

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function _logSend(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  profileId: string,
  rangeStart: string,
  rangeEnd: string,
  status: 'success' | 'skipped_empty' | 'skipped_disabled' | 'error',
  errorMessage?: string,
): Promise<void> {
  try {
    await supabase.from('digest_sends').insert({
      profile_id: profileId,
      range_start: rangeStart,
      range_end: rangeEnd,
      status,
      error_message: errorMessage ?? null,
    });
  } catch {
    // Don't let logging failures break the main flow
  }
}

/**
 * Today's date in Eastern Time as YYYY-MM-DD.
 * Q9 = A: hard-coded to ET.
 */
function _todayInET(): string {
  // toLocaleDateString with timeZone gives us a local-rendered date string.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function _addDays(d: string, n: number): string {
  const dt = new Date(d + 'T12:00:00Z');  // noon UTC sidesteps DST edge cases
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
