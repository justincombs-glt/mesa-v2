import { createClient } from '@/lib/supabase/server';
import type { NutritionGoal, NutritionEntry, Student } from '@/lib/supabase/types';

export interface NutritionDay {
  date: string;              // YYYY-MM-DD
  entries: NutritionEntry[]; // sorted by occurred_at descending
  total: number;
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
 * entries + a 7-day rollup.
 *
 * Callable from server components only (uses createClient from supabase/server).
 * Access control is via RLS — if the caller isn't household, queries return
 * nothing.
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

  const entries = (entryRows ?? []) as NutritionEntry[];

  // Bucket by local date
  const byDate = new Map<string, NutritionEntry[]>();
  for (const entry of entries) {
    const d = new Date(entry.occurred_at);
    const dateKey = d.toISOString().slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(entry);
  }

  const todayKey = new Date().toISOString().slice(0, 10);

  const last7Days: NutritionDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayEntries = byDate.get(key) ?? [];
    const total = dayEntries.reduce((sum, e) => sum + e.calories, 0);
    last7Days.push({ date: key, entries: dayEntries, total });
  }

  const today = last7Days[0]; // first element is today since we iterated descending

  return { goal, today, last7Days };
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
