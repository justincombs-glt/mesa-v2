// ============================================================================
// Google Health API data pull
//
// Phase 9b: queries the Google Health API for heart rate samples within a
// specified time window. Returns normalized HR samples + summary stats.
//
// API basics (per developers.google.com/health):
//   - Base URL: https://health.googleapis.com/v4
//   - Endpoint: GET /users/me/dataTypes/heart-rate/dataPoints?filter=...
//   - Data type names are kebab-case in URLs (heart-rate), snake_case in filters (heart_rate)
//   - Times in filters are "civil time" (user's local time, no TZ)
//
// Time zone: we hardcoded Eastern Time for the digest, so we do the same here
// for civil-time conversion. Practice starts_at + occurred_on + duration_minutes
// is converted to ET civil range, sent to Google, and the returned samples are
// reasoned about in UTC for analysis.
//
// Auth: caller passes the (decrypted) access token. If the token is expired,
// caller is responsible for refreshing first (see lib/devices/practice-pull.ts).
// ============================================================================

import type { HrSample } from '@/lib/devices/hr-zones';

const BASE = 'https://health.googleapis.com/v4';

export interface PullParams {
  /** Decrypted Google access token. */
  accessToken: string;
  /** Civil-time start of the practice in athlete's local zone (ET). */
  civilStart: string;  // YYYY-MM-DDTHH:MM:SS
  /** Civil-time end of the practice in athlete's local zone (ET). */
  civilEnd: string;    // YYYY-MM-DDTHH:MM:SS
}

export interface PullResult {
  /** HR samples within the window, sorted by time. */
  samples: HrSample[];
  /** Total calories burned during the window, if available. */
  calories: number | null;
  /** Whether the API returned any data at all (helps distinguish "device wasn't worn" from "token bad"). */
  has_data: boolean;
  /** Raw HTTP status from the most relevant API call. */
  http_status: number;
  /** Error string if anything went wrong; empty when successful. */
  error: string;
}

/**
 * Pull HR data and total calories for a single user in a time window.
 *
 * Returns a normalized result regardless of API errors. Inspect `error` and
 * `has_data` to decide how to handle the outcome.
 */
export async function pullGoogleHealthMetrics(params: PullParams): Promise<PullResult> {
  const out: PullResult = {
    samples: [],
    calories: null,
    has_data: false,
    http_status: 0,
    error: '',
  };

  // Build the filter expression for the time window
  // Google expects: heart_rate.interval.civil_start_time >= "..." AND <= "..."
  // The exact filter field name varies by data type:
  //   - heart-rate uses heart_rate.endTime (per spec for instantaneous readings)
  //   - But the API also accepts interval.civil_start_time/civil_end_time
  //
  // We'll try the civil_start_time approach since it's documented in the
  // codelab examples. If Google's schema diverges, the response will indicate
  // and we'll get an error code we can debug.
  const hrFilter = encodeURIComponent(
    `heart_rate.interval.civil_start_time >= "${params.civilStart}" ` +
    `AND heart_rate.interval.civil_end_time <= "${params.civilEnd}"`,
  );

  // ----- Heart rate samples -----
  try {
    const url = `${BASE}/users/me/dataTypes/heart-rate/dataPoints?filter=${hrFilter}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: 'application/json',
      },
    });
    out.http_status = res.status;
    if (!res.ok) {
      const text = await res.text();
      out.error = `HR pull: ${res.status} ${text.slice(0, 200)}`;
      return out;
    }
    const json = await res.json() as unknown;
    out.samples = _parseHrSamples(json);
    if (out.samples.length > 0) out.has_data = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    out.error = `HR pull threw: ${msg}`;
    return out;
  }

  // ----- Calories (best-effort; failure doesn't block) -----
  try {
    const calFilter = encodeURIComponent(
      `total_calories.interval.civil_start_time >= "${params.civilStart}" ` +
      `AND total_calories.interval.civil_end_time <= "${params.civilEnd}"`,
    );
    const url = `${BASE}/users/me/dataTypes/total-calories/dataPoints?filter=${calFilter}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: 'application/json',
      },
    });
    if (res.ok) {
      const json = await res.json() as unknown;
      out.calories = _parseTotalCalories(json);
      if (out.calories !== null) out.has_data = true;
    }
    // Failure here doesn't set out.error — calories are best-effort
  } catch {
    // Swallow — calories failure shouldn't block HR success
  }

  return out;
}

/**
 * Parse Google Health "data points" response for heart rate. The expected
 * shape per the spec:
 *
 * {
 *   "dataPoints": [
 *     {
 *       "name": "users/.../dataTypes/heart-rate/dataPoints/...",
 *       "heartRate": {
 *         "endTime": "2026-05-17T17:30:15Z",
 *         "bpm": 142
 *       }
 *     },
 *     ...
 *   ]
 * }
 *
 * Be defensive — the API is pre-GA and the exact field shape may shift.
 */
function _parseHrSamples(payload: unknown): HrSample[] {
  if (!_isObject(payload)) return [];
  const dataPoints = (payload as Record<string, unknown>).dataPoints;
  if (!Array.isArray(dataPoints)) return [];

  const samples: HrSample[] = [];
  for (const p of dataPoints) {
    if (!_isObject(p)) continue;
    // Try multiple field shapes since the API is pre-GA
    const obj = p as Record<string, unknown>;
    // Shape A: { heartRate: { endTime, bpm } }
    const heartRate = obj.heartRate;
    if (_isObject(heartRate)) {
      const hr = heartRate as Record<string, unknown>;
      const bpm = typeof hr.bpm === 'number' ? hr.bpm : Number(hr.bpm);
      const ts = typeof hr.endTime === 'string' ? hr.endTime : typeof hr.time === 'string' ? hr.time : '';
      if (!isNaN(bpm) && ts) {
        samples.push({ timestamp: ts, bpm: Math.round(bpm) });
        continue;
      }
    }
    // Shape B: { value: { bpm }, endTime }  (alternative format)
    const value = obj.value;
    if (_isObject(value)) {
      const v = value as Record<string, unknown>;
      const bpm = typeof v.bpm === 'number' ? v.bpm : Number(v.bpm);
      const ts = typeof obj.endTime === 'string' ? obj.endTime : '';
      if (!isNaN(bpm) && ts) {
        samples.push({ timestamp: ts, bpm: Math.round(bpm) });
      }
    }
  }
  return samples;
}

/**
 * Parse total-calories response. Expected shape similar to heart rate but with
 * a single sum or multiple intervals to add up.
 */
function _parseTotalCalories(payload: unknown): number | null {
  if (!_isObject(payload)) return null;
  const dataPoints = (payload as Record<string, unknown>).dataPoints;
  if (!Array.isArray(dataPoints)) return null;
  let total = 0;
  let found = false;
  for (const p of dataPoints) {
    if (!_isObject(p)) continue;
    const obj = p as Record<string, unknown>;
    // Look for caloriesKcal or kcal field nested inside totalCalories or value
    const candidates = [
      obj.totalCalories,
      obj.value,
      obj,
    ];
    for (const c of candidates) {
      if (_isObject(c)) {
        const cobj = c as Record<string, unknown>;
        const k = typeof cobj.caloriesKcal === 'number'
          ? cobj.caloriesKcal
          : typeof cobj.kcal === 'number'
            ? cobj.kcal
            : null;
        if (k !== null) {
          total += k;
          found = true;
          break;
        }
      }
    }
  }
  return found ? Math.round(total) : null;
}

function _isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
