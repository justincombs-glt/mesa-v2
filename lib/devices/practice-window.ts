// ============================================================================
// Practice time-window helper
//
// Converts a practice's (occurred_on, starts_at, duration_minutes) into:
//   - civil_start / civil_end strings in Eastern Time (no TZ)
//   - utc_start / utc_end Date objects
//
// All MESA practices are assumed to be in Eastern Time, per the same hardcoded
// timezone used by the weekly digest. If/when we expand beyond Michigan, this
// is the central place to revisit.
// ============================================================================

export interface PracticeWindow {
  /** ET civil string: "YYYY-MM-DDTHH:MM:SS" — what Google Health API wants. */
  civil_start: string;
  civil_end: string;
  /** UTC Date objects for record-keeping. */
  utc_start: Date;
  utc_end: Date;
}

/**
 * Compute the practice window from DB fields.
 *
 * @param occurred_on  YYYY-MM-DD
 * @param starts_at    HH:MM:SS or HH:MM (24h, ET local time)
 * @param duration_minutes  Practice duration in minutes (defaults to 90 if null)
 */
export function computePracticeWindow(
  occurred_on: string,
  starts_at: string | null,
  duration_minutes: number | null,
): PracticeWindow | null {
  if (!occurred_on) return null;
  const startHHMMSS = _normalizeTime(starts_at ?? '17:30:00');
  const dur = duration_minutes ?? 90;

  // Build civil start string in ET local
  const civilStart = `${occurred_on}T${startHHMMSS}`;

  // Convert ET local to UTC
  const utcStart = _etCivilToUtc(occurred_on, startHHMMSS);
  if (!utcStart) return null;
  const utcEnd = new Date(utcStart.getTime() + dur * 60 * 1000);

  // Convert utcEnd back to ET civil string
  const civilEnd = _utcToEtCivil(utcEnd);

  return {
    civil_start: civilStart,
    civil_end: civilEnd,
    utc_start: utcStart,
    utc_end: utcEnd,
  };
}

/** Normalize HH:MM into HH:MM:SS. */
function _normalizeTime(t: string): string {
  const trimmed = t.trim();
  // Already HH:MM:SS
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) return _padTime(trimmed);
  // HH:MM (no seconds) — add :00
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return _padTime(trimmed + ':00');
  return '17:30:00';  // Sensible default
}

function _padTime(t: string): string {
  const [h, m, s] = t.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
}

/**
 * Convert ET civil date+time to UTC. Handles DST automatically by leveraging
 * Intl APIs to find the correct UTC offset for that civil moment.
 */
function _etCivilToUtc(dateStr: string, timeStr: string): Date | null {
  // Construct as if it were UTC, then adjust by the ET offset at that moment
  const isoLocal = `${dateStr}T${timeStr}`;
  // First parse as if UTC to get a temporary reference
  const tempUtc = new Date(`${isoLocal}Z`);
  if (isNaN(tempUtc.getTime())) return null;
  // Find ET offset at that moment using Intl
  const offsetMs = _etOffsetAt(tempUtc);
  // The actual UTC time = civil time minus ET offset
  return new Date(tempUtc.getTime() - offsetMs);
}

/**
 * Convert a UTC Date back into an ET civil string "YYYY-MM-DDTHH:MM:SS".
 */
function _utcToEtCivil(utc: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(utc);
  const y = _part(parts, 'year');
  const mo = _part(parts, 'month');
  const d = _part(parts, 'day');
  const h = _part(parts, 'hour');
  const mi = _part(parts, 'minute');
  const s = _part(parts, 'second');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

function _part(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((p) => p.type === type)?.value ?? '00';
}

/**
 * Returns the ET offset from UTC in milliseconds at a given moment.
 * Positive when ET is behind UTC (always the case for ET).
 */
function _etOffsetAt(utc: Date): number {
  const etCivil = _utcToEtCivil(utc);  // "YYYY-MM-DDTHH:MM:SS"
  // Treat that civil string as if it were UTC; the difference from the input is the offset
  const asUtc = new Date(`${etCivil}Z`).getTime();
  return asUtc - utc.getTime();
}
