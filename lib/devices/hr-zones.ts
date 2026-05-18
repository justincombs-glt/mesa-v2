// ============================================================================
// Heart rate zone calculation (Fitbit-style)
//
// Phase 9b: given a series of HR samples and the athlete's max HR, computes
// minutes spent in each zone. Matches what athletes see in their Fitbit app.
//
// Zones (Fitbit defaults):
//   - Out of Range: < 50% of max HR  (e.g. resting / warming up)
//   - Fat Burn:     50% to 69% of max HR
//   - Cardio:       70% to 84% of max HR
//   - Peak:         85%+ of max HR
//
// Max HR comes from the athlete's Google Health profile if available; falls
// back to age-based formula (220 - age) if not. The fallback is rough but
// universally available.
// ============================================================================

export interface HrSample {
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Heart rate in bpm. */
  bpm: number;
}

export interface HrZoneMinutes {
  out_of_range: number;
  fat_burn: number;
  cardio: number;
  peak: number;
}

export interface HrSummary {
  avg: number | null;
  max: number | null;
  min: number | null;
  zones: HrZoneMinutes;
  /** Sum of zones — should approximate practice duration. */
  total_minutes: number;
}

/**
 * Compute max HR using age-based formula. Used as fallback when the Google
 * Health profile doesn't expose a value.
 */
export function ageBasedMaxHr(age: number): number {
  if (age < 5 || age > 100) return 200;  // Sanity defaults for absurd values
  return 220 - age;
}

/**
 * Zone thresholds in bpm, given a max HR. Returns the boundary bpm values
 * (exclusive lower bound, inclusive upper).
 */
export function zoneThresholds(maxHr: number): {
  fatBurnStart: number;
  cardioStart: number;
  peakStart: number;
} {
  return {
    fatBurnStart: Math.round(maxHr * 0.50),
    cardioStart: Math.round(maxHr * 0.70),
    peakStart: Math.round(maxHr * 0.85),
  };
}

/**
 * Bin a single bpm value into its zone label.
 */
function _bpmToZone(bpm: number, t: ReturnType<typeof zoneThresholds>): keyof HrZoneMinutes {
  if (bpm >= t.peakStart) return 'peak';
  if (bpm >= t.cardioStart) return 'cardio';
  if (bpm >= t.fatBurnStart) return 'fat_burn';
  return 'out_of_range';
}

/**
 * Compute summary stats from a series of HR samples.
 *
 * Time-in-zone is calculated by attributing each sample's "duration" — the
 * gap between it and the next sample — to its zone. Assumes samples are
 * roughly evenly spaced (Fitbit / Google Health typically samples every
 * few seconds during exercise).
 *
 * Returns nulls when input is empty.
 */
export function summarizeHrSamples(samples: HrSample[], maxHr: number): HrSummary {
  if (samples.length === 0) {
    return {
      avg: null, max: null, min: null,
      zones: { out_of_range: 0, fat_burn: 0, cardio: 0, peak: 0 },
      total_minutes: 0,
    };
  }

  const sorted = [...samples].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const t = zoneThresholds(maxHr);

  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  const zones: HrZoneMinutes = {
    out_of_range: 0,
    fat_burn: 0,
    cardio: 0,
    peak: 0,
  };

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    sum += s.bpm;
    if (s.bpm > max) max = s.bpm;
    if (s.bpm < min) min = s.bpm;

    // Time-in-zone: this sample's "duration" is the gap to the next sample
    let gapSeconds: number;
    if (i < sorted.length - 1) {
      const here = new Date(s.timestamp).getTime();
      const next = new Date(sorted[i + 1].timestamp).getTime();
      gapSeconds = Math.max(0, (next - here) / 1000);
      // Cap unreasonably large gaps at 60s (signal loss, paused workout, etc.)
      if (gapSeconds > 60) gapSeconds = 60;
    } else {
      // Last sample: assume same gap as median gap, capped at 30s
      gapSeconds = 30;
    }
    const z = _bpmToZone(s.bpm, t);
    zones[z] += gapSeconds / 60;
  }

  // Round zones to nearest minute
  const roundedZones: HrZoneMinutes = {
    out_of_range: Math.round(zones.out_of_range),
    fat_burn: Math.round(zones.fat_burn),
    cardio: Math.round(zones.cardio),
    peak: Math.round(zones.peak),
  };

  return {
    avg: Math.round(sum / sorted.length),
    max,
    min,
    zones: roundedZones,
    total_minutes:
      roundedZones.out_of_range +
      roundedZones.fat_burn +
      roundedZones.cardio +
      roundedZones.peak,
  };
}
