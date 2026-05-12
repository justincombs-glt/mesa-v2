import { createClient } from '@/lib/supabase/server';
import type { NutritionGoal, NutritionEntry } from '@/lib/supabase/types';

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
