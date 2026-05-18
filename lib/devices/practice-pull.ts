// ============================================================================
// Per-practice device metrics pull
//
// Phase 9b: orchestrates pulling metrics for a single (practice, athlete)
// combo. Handles:
//   - Loading the athlete's device connection
//   - Refreshing the access token if expired
//   - Calling the appropriate provider's pull function
//   - Summarizing samples into derived metrics
//   - Saving to practice_device_metrics
//   - Logging the attempt outcome
//
// Idempotent: re-pulling the same (practice, athlete) updates the metrics row
// rather than inserting a duplicate.
// ============================================================================

import { getConnection, saveConnection, markReconnectNeeded } from '@/lib/devices/connection';
import { refreshAccessToken } from '@/lib/oauth/google-health';
import { pullGoogleHealthMetrics } from '@/lib/devices/pull-google-health';
import { summarizeHrSamples, ageBasedMaxHr } from '@/lib/devices/hr-zones';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

type PullStatus =
  | 'success'
  | 'no_data'
  | 'token_refresh_failed'
  | 'no_connection'
  | 'rate_limit'
  | 'api_error'
  | 'unexpected_error';

export interface PracticePullParams {
  /** Service-role client — RLS is bypassed since we aggregate across users */
  supabase: AnySupabaseClient;
  /** Activity (practice) UUID. */
  activity_id: string;
  /** Student UUID. */
  student_id: string;
  /** Profile UUID of the athlete (for connection lookup). */
  profile_id: string;
  /** Practice civil start time in ET (YYYY-MM-DDTHH:MM:SS). */
  civil_start: string;
  /** Practice civil end time in ET (YYYY-MM-DDTHH:MM:SS). */
  civil_end: string;
  /** UTC start (for record-keeping in metrics row). */
  utc_start: Date;
  /** UTC end. */
  utc_end: Date;
}

export interface PracticePullResult {
  status: PullStatus;
  error?: string;
  http_status?: number;
}

/**
 * Pull metrics for one athlete on one practice from Google Health.
 *
 * The function always returns a result and always logs an attempt row — it
 * doesn't throw. Callers (the cron) handle hundreds of these in a loop and
 * shouldn't be derailed by one bad call.
 */
export async function pullPracticeForAthlete(
  params: PracticePullParams,
): Promise<PracticePullResult> {
  const {
    supabase, activity_id, student_id, profile_id,
    civil_start, civil_end, utc_start, utc_end,
  } = params;

  // 1. Load the athlete's Google Health connection
  let connection = await getConnection(supabase, profile_id, 'google_health');
  if (!connection || connection.status === 'revoked') {
    await _logAttempt(supabase, activity_id, student_id, 'google_health', 'no_connection');
    return { status: 'no_connection' };
  }

  // 2. Refresh token if expired (or about to expire in next 5 min)
  const now = new Date();
  const buffer = new Date(now.getTime() + 5 * 60 * 1000);
  if (!connection.expires_at || connection.expires_at < buffer) {
    if (!connection.refresh_token) {
      await markReconnectNeeded(supabase, profile_id, 'google_health');
      await _logAttempt(supabase, activity_id, student_id, 'google_health',
        'token_refresh_failed', 'no refresh token stored');
      return { status: 'token_refresh_failed', error: 'no refresh token stored' };
    }
    try {
      const refreshed = await refreshAccessToken({ refreshToken: connection.refresh_token });
      const save = await saveConnection(supabase, {
        profile_id,
        provider: 'google_health',
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? connection.refresh_token,
        expires_at: refreshed.expires_at,
        scopes: refreshed.scopes.length > 0 ? refreshed.scopes : connection.scopes,
      });
      if (!save.ok) {
        await _logAttempt(supabase, activity_id, student_id, 'google_health',
          'token_refresh_failed', `save after refresh failed: ${save.error}`);
        return { status: 'token_refresh_failed', error: save.error };
      }
      // Reload connection to get fresh tokens
      connection = await getConnection(supabase, profile_id, 'google_health');
      if (!connection) {
        await _logAttempt(supabase, activity_id, student_id, 'google_health',
          'unexpected_error', 'connection vanished after refresh');
        return { status: 'unexpected_error' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If refresh fails it's likely because the refresh token was revoked
      // by the user (or expired due to 6mo non-use). Mark for reconnect.
      await markReconnectNeeded(supabase, profile_id, 'google_health');
      await _logAttempt(supabase, activity_id, student_id, 'google_health',
        'token_refresh_failed', msg);
      return { status: 'token_refresh_failed', error: msg };
    }
  }

  // 3. Pull from Google Health
  const pullResult = await pullGoogleHealthMetrics({
    accessToken: connection.access_token,
    civilStart: civil_start,
    civilEnd: civil_end,
  });

  if (pullResult.error && pullResult.samples.length === 0) {
    // Check if it's a rate limit / auth error
    if (pullResult.http_status === 429) {
      await _logAttempt(supabase, activity_id, student_id, 'google_health',
        'rate_limit', pullResult.error, pullResult.http_status);
      return { status: 'rate_limit', error: pullResult.error };
    }
    if (pullResult.http_status === 401 || pullResult.http_status === 403) {
      // Token is bad despite our refresh — mark for reconnect
      await markReconnectNeeded(supabase, profile_id, 'google_health');
    }
    await _logAttempt(supabase, activity_id, student_id, 'google_health',
      'api_error', pullResult.error, pullResult.http_status);
    return { status: 'api_error', error: pullResult.error, http_status: pullResult.http_status };
  }

  if (!pullResult.has_data) {
    await _logAttempt(supabase, activity_id, student_id, 'google_health', 'no_data');
    return { status: 'no_data' };
  }

  // 4. Compute derived metrics
  // Max HR fallback: load student DOB to compute age-based max HR.
  // If DOB missing, default to age 20 (conservative max HR ~200).
  const { data: studentRow } = await supabase
    .from('students')
    .select('date_of_birth')
    .eq('id', student_id)
    .maybeSingle();
  const dob = (studentRow as { date_of_birth: string | null } | null)?.date_of_birth ?? null;
  const age = dob ? _calcAgeFromDob(dob) : 20;
  const maxHrEstimate = ageBasedMaxHr(age);
  const summary = summarizeHrSamples(pullResult.samples, maxHrEstimate);

  // 5. Save metrics (upsert by composite unique key)
  const { error: saveErr } = await supabase
    .from('practice_device_metrics')
    .upsert(
      {
        activity_id,
        student_id,
        provider: 'google_health',
        avg_hr: summary.avg,
        max_hr: summary.max,
        min_hr: summary.min,
        duration_minutes: summary.total_minutes,
        calories: pullResult.calories,
        zone_out_of_range_min: summary.zones.out_of_range,
        zone_fat_burn_min: summary.zones.fat_burn,
        zone_cardio_min: summary.zones.cardio,
        zone_peak_min: summary.zones.peak,
        strain_score: null,  // Google Health doesn't provide
        pulled_at: new Date().toISOString(),
        source_window_start: utc_start.toISOString(),
        source_window_end: utc_end.toISOString(),
      },
      { onConflict: 'activity_id,student_id,provider' },
    );
  if (saveErr) {
    await _logAttempt(supabase, activity_id, student_id, 'google_health',
      'unexpected_error', `save failed: ${saveErr.message}`);
    return { status: 'unexpected_error', error: saveErr.message };
  }

  await _logAttempt(supabase, activity_id, student_id, 'google_health', 'success');
  return { status: 'success' };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function _logAttempt(
  supabase: AnySupabaseClient,
  activity_id: string,
  student_id: string,
  provider: 'google_health' | 'whoop',
  status: PullStatus,
  error_message?: string,
  http_status?: number,
): Promise<void> {
  try {
    await supabase.from('practice_device_pull_attempts').insert({
      activity_id,
      student_id,
      provider,
      status,
      error_message: error_message ?? null,
      http_status: http_status ?? null,
    });
  } catch {
    // Don't let a logging failure break the main flow
  }
}

function _calcAgeFromDob(dob: string): number {
  const dt = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - dt.getFullYear();
  const m = now.getMonth() - dt.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dt.getDate())) age--;
  return age;
}
