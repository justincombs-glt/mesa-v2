import { createClient } from '@/lib/supabase/server';
import type { NutritionGoal, NutritionEntry, Student } from '@/lib/supabase/types';

/**
 * Phase 15f extension: nutrition_entries gained 9 macro/micro columns. If the
 * generated NutritionEntry type doesn't include them yet (because Supabase
 * types haven't been regenerated post-migration), this intersection adds them
 * so the rest of the code stays type-safe.
 *
 * Once you regenerate types via `supabase gen types typescript --linked`, the
 * intersection becomes redundant but harmless.
 */
export type NutritionEntryExtended = NutritionEntry & {
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
  iron_mg: number | null;
  calcium_mg: number | null;
  vitamin_d_mcg: number | null;
  potassium_mg: number | null;
};

/**
 * Daily macro and micro totals, computed from entries that have non-null
 * values for each field. NULLs are excluded so the totals reflect ONLY what's
 * been tracked — they're a lower bound, not the full intake of the day.
 *
 * `entries_with_macros` counts entries where at least one macro/micro field
 * is non-null. Used by the UI to display "(N of M entries with macro data)"
 * when partial.
 */
export interface NutritionTotals {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  iron_mg: number;
  calcium_mg: number;
  vitamin_d_mcg: number;
  potassium_mg: number;
  /** Number of entries that had at least one non-null macro/micro field. */
  entries_with_macros: number;
  /** Total entries that day (for ratio display). */
  entries_total: number;
}

export interface NutritionDay {
  date: string;              // YYYY-MM-DD
  entries: NutritionEntryExtended[]; // sorted by occurred_at descending
  total: number;             // calories
  totals: NutritionTotals;   // macros + micros
}

export interface NutritionData {
  goal: NutritionGoal | null;
  today: NutritionDay;
  last7Days: NutritionDay[]; // most recent first, includes today
}

/**
 * Trainer overview row — one per student, summarizing the rolled-up nutrition
 * state without paying the cost of building a full NutritionData per student.
 */
export interface NutritionOverviewRow {
  student: Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position'>;
  goal: number | null;
  todayTotal: number;
  loggedToday: boolean;
  last7DayTotals: number[]; // most recent first, 7 entries
}

/**
 * Load nutrition data for a specific student. Returns the goal + today's
 * entries + a 7-day rollup, including macro/micro totals per day.
 *
 * Callable from server components only (uses createClient from supabase/server).
 * Access control is via RLS — if the caller isn't household or trainer,
 * queries return nothing.
 */
export async function buildNutritionData(studentId: string): Promise<NutritionData> {
  const supabase = createClient();

  // Goal
  const { data: goalRow } = await supabase
    .from('nutrition_goals').select('*')
    .eq('student_id', studentId).maybeSingle();
  const goal = goalRow as NutritionGoal | null;

  // Last 7 days of entries
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const { data: entryRows } = await supabase
    .from('nutrition_entries').select('*')
    .eq('student_id', studentId)
    .gte('occurred_at', sevenDaysAgo.toISOString())
    .order('occurred_at', { ascending: false });

  const entries = (entryRows ?? []) as NutritionEntryExtended[];

  // Bucket by local date
  const byDate = new Map<string, NutritionEntryExtended[]>();
  for (const entry of entries) {
    const d = new Date(entry.occurred_at);
    const dateKey = d.toISOString().slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(entry);
  }

  const last7Days: NutritionDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayEntries = byDate.get(key) ?? [];
    const total = dayEntries.reduce((sum, e) => sum + e.calories, 0);
    const totals = aggregateTotals(dayEntries);
    last7Days.push({ date: key, entries: dayEntries, total, totals });
  }

  const today = last7Days[0]; // first element is today since we iterated descending

  return { goal, today, last7Days };
}

/**
 * Sum macros and micros across a list of entries. NULL fields are skipped
 * (they don't contribute to the sum). Counts entries that have at least one
 * non-null macro/micro for partial-data display.
 */
export function aggregateTotals(entries: NutritionEntryExtended[]): NutritionTotals {
  const t: NutritionTotals = {
    protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sodium_mg: 0,
    iron_mg: 0, calcium_mg: 0, vitamin_d_mcg: 0, potassium_mg: 0,
    entries_with_macros: 0, entries_total: entries.length,
  };
  for (const e of entries) {
    let hasAny = false;
    if (e.protein_g !== null) { t.protein_g += Number(e.protein_g); hasAny = true; }
    if (e.carbs_g !== null) { t.carbs_g += Number(e.carbs_g); hasAny = true; }
    if (e.fat_g !== null) { t.fat_g += Number(e.fat_g); hasAny = true; }
    if (e.fiber_g !== null) { t.fiber_g += Number(e.fiber_g); hasAny = true; }
    if (e.sodium_mg !== null) { t.sodium_mg += Number(e.sodium_mg); hasAny = true; }
    if (e.iron_mg !== null) { t.iron_mg += Number(e.iron_mg); hasAny = true; }
    if (e.calcium_mg !== null) { t.calcium_mg += Number(e.calcium_mg); hasAny = true; }
    if (e.vitamin_d_mcg !== null) { t.vitamin_d_mcg += Number(e.vitamin_d_mcg); hasAny = true; }
    if (e.potassium_mg !== null) { t.potassium_mg += Number(e.potassium_mg); hasAny = true; }
    if (hasAny) t.entries_with_macros += 1;
  }
  // Round once at the end to avoid drift across many additions
  t.protein_g = Math.round(t.protein_g * 10) / 10;
  t.carbs_g = Math.round(t.carbs_g * 10) / 10;
  t.fat_g = Math.round(t.fat_g * 10) / 10;
  t.fiber_g = Math.round(t.fiber_g * 10) / 10;
  t.sodium_mg = Math.round(t.sodium_mg);
  t.iron_mg = Math.round(t.iron_mg * 100) / 100;
  t.calcium_mg = Math.round(t.calcium_mg);
  t.vitamin_d_mcg = Math.round(t.vitamin_d_mcg * 10) / 10;
  t.potassium_mg = Math.round(t.potassium_mg);
  return t;
}

/**
 * Trainer-side loader: rolls up nutrition state for many students in one go.
 * Pulls all students once, joins the goal map, and computes today + 7-day
 * totals in memory.
 *
 * Active students only. Sorted alphabetically by full_name.
 *
 * Access: relies on RLS — caller must be trainer (Phase 15b RLS) or staff
 * with student-table read access. Returns empty list if RLS blocks reads.
 */
export async function buildNutritionOverview(): Promise<NutritionOverviewRow[]> {
  const supabase = createClient();

  // 1. Active students
  const { data: studentRows } = await supabase
    .from('students')
    .select('id, full_name, jersey_number, position')
    .eq('active', true)
    .order('full_name');

  const students = (studentRows ?? []) as Array<Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position'>>;
  if (students.length === 0) return [];

  const studentIds = students.map((s) => s.id);

  // 2. Goals (one row per student max)
  const { data: goalRows } = await supabase
    .from('nutrition_goals')
    .select('student_id, daily_calories')
    .in('student_id', studentIds);

  const goalByStudent = new Map<string, number>();
  for (const g of (goalRows ?? []) as Array<{ student_id: string; daily_calories: number }>) {
    goalByStudent.set(g.student_id, g.daily_calories);
  }

  // 3. Last 7 days of entries (all students at once)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const { data: entryRows } = await supabase
    .from('nutrition_entries')
    .select('student_id, occurred_at, calories')
    .in('student_id', studentIds)
    .gte('occurred_at', sevenDaysAgo.toISOString());

  const entries = (entryRows ?? []) as Array<{ student_id: string; occurred_at: string; calories: number }>;

  // 4. Aggregate by student × date
  const todayKey = new Date().toISOString().slice(0, 10);
  const dailyTotals = new Map<string, Map<string, number>>(); // student_id -> date -> total
  for (const e of entries) {
    const dateKey = new Date(e.occurred_at).toISOString().slice(0, 10);
    if (!dailyTotals.has(e.student_id)) dailyTotals.set(e.student_id, new Map());
    const studentTotals = dailyTotals.get(e.student_id)!;
    studentTotals.set(dateKey, (studentTotals.get(dateKey) ?? 0) + e.calories);
  }

  // 5. Build the rolling 7-day window keys (most recent first, today at index 0)
  const dateKeys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dateKeys.push(d.toISOString().slice(0, 10));
  }

  // 6. Build the rows
  return students.map((student) => {
    const studentTotals = dailyTotals.get(student.id) ?? new Map<string, number>();
    const last7DayTotals = dateKeys.map((k) => studentTotals.get(k) ?? 0);
    const todayTotal = studentTotals.get(todayKey) ?? 0;
    return {
      student,
      goal: goalByStudent.get(student.id) ?? null,
      todayTotal,
      loggedToday: todayTotal > 0,
      last7DayTotals,
    };
  });
}

// ============================================================================
// Phase 15e: all-time history loader (extended in 15f with macros/micros)
// ============================================================================

/**
 * Load ALL nutrition entries for a student, grouped by date. Used by the
 * dedicated History page (/dashboard/nutrition/history and the parent
 * equivalent).
 *
 * - No date filter — Q1 = D returns the full history.
 * - Zero-entry days are omitted (Q10 = A) so the list only shows days with
 *   actual activity.
 * - Sorted most-recent-first.
 * - Also returns the current goal so the page can render "X% of goal"
 *   indicators per day (Q3 = B).
 * - Each day now includes aggregated macro/micro totals.
 *
 * Access: RLS on nutrition_entries enforces — caller must be student-self,
 * parent-of-student, or trainer (per Phase 15a/15b policies).
 */
export async function buildNutritionHistory(studentId: string): Promise<{
  goal: NutritionGoal | null;
  days: NutritionDay[];
}> {
  const supabase = createClient();

  const { data: goalRow } = await supabase
    .from('nutrition_goals').select('*')
    .eq('student_id', studentId).maybeSingle();
  const goal = goalRow as NutritionGoal | null;

  const { data: entryRows } = await supabase
    .from('nutrition_entries').select('*')
    .eq('student_id', studentId)
    .order('occurred_at', { ascending: false });

  const entries = (entryRows ?? []) as NutritionEntryExtended[];

  // Bucket by local date
  const byDate = new Map<string, NutritionEntryExtended[]>();
  for (const entry of entries) {
    const d = new Date(entry.occurred_at);
    const dateKey = d.toISOString().slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(entry);
  }

  // Build days array sorted most-recent first (Map preserves insertion order
  // which here is descending since we ordered the query that way).
  const days: NutritionDay[] = [];
  for (const [date, dayEntries] of byDate) {
    const total = dayEntries.reduce((s, e) => s + e.calories, 0);
    const totals = aggregateTotals(dayEntries);
    days.push({ date, entries: dayEntries, total, totals });
  }

  return { goal, days };
}
