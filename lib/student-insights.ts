import { createClient } from '@/lib/supabase/server';
import type {
  Student, GoalPlan, GoalPlanGoal,
  PerformanceTest, PerformanceTestResult,
  WorkoutExerciseSet,
} from '@/lib/supabase/types';

// ============================================================================
// Per-student insights aggregator (Phase 7a)
// ============================================================================

export interface AttendanceBreakdown {
  overall_pct: number | null;       // null if no recorded attendance
  overall_present: number;
  overall_total: number;
  by_type: {
    practice: { present: number; total: number; pct: number | null };
    game: { present: number; total: number; pct: number | null };
    off_ice_workout: { present: number; total: number; pct: number | null };
  };
  lifetime_pct: number | null;
  lifetime_present: number;
  lifetime_total: number;
}

export interface TestTrend {
  test_id: string;
  test_title: string;
  test_unit: string | null;
  direction: 'higher_is_better' | 'lower_is_better';
  results: Array<{
    value: number;
    recorded_at: string;
    is_baseline: boolean;
  }>; // chronological asc
  baseline: number | null;
  latest: number | null;
  pct_change_from_baseline: number | null;  // signed; positive = "better" relative to direction
}

export interface GoalProgressDetail extends GoalPlanGoal {
  /** Auto-computed progress (0-100) when linked_test_id + target_numeric set; falls back to stored progress_pct otherwise. */
  computed_pct: number;
  /** True when computed from data, false when using the stored manual override. */
  is_auto: boolean;
  /** Latest measured value (only when linked to a test). */
  latest_value: number | null;
  /** Baseline (earliest result of linked test for this season). */
  baseline_value: number | null;
}

export interface WorkoutInsights {
  total_workouts_attended: number;
  total_sets_logged: number;
  average_rpe: number | null;       // null if no RPE values recorded
  workouts_in_last_30_days: number;
}

export interface PlanWithGoals {
  plan: GoalPlan;
  goals: GoalProgressDetail[];
}

export interface StudentInsights {
  student: Student;
  seasonId: string | null;
  seasonName: string | null;
  attendance: AttendanceBreakdown;
  testTrends: TestTrend[];
  workout: WorkoutInsights;
  plans: PlanWithGoals[];
}

export async function buildStudentInsights(
  studentId: string,
  seasonId: string | null,
  seasonName: string | null
): Promise<StudentInsights | null> {
  const supabase = createClient();

  const { data: studentRow } = await supabase
    .from('students').select('*').eq('id', studentId).maybeSingle();
  if (!studentRow) return null;
  const student = studentRow as unknown as Student;

  // --------------------------------------------------------------------------
  // Attendance
  // --------------------------------------------------------------------------

  const attendance = await buildAttendanceBreakdown(studentId, seasonId);

  // --------------------------------------------------------------------------
  // Test trends — for the current season (or lifetime if no season selected)
  // --------------------------------------------------------------------------

  const testTrends = await buildTestTrends(studentId, seasonId);

  // --------------------------------------------------------------------------
  // Workout insights
  // --------------------------------------------------------------------------

  const workout = await buildWorkoutInsights(studentId, seasonId);

  // --------------------------------------------------------------------------
  // Plans + goals (with computed progress)
  // --------------------------------------------------------------------------

  const plans = await buildPlansWithGoals(studentId, seasonId, testTrends);

  return {
    student,
    seasonId,
    seasonName,
    attendance,
    testTrends,
    workout,
    plans,
  };
}

// ============================================================================
// Internals
// ============================================================================

async function buildAttendanceBreakdown(
  studentId: string,
  seasonId: string | null
): Promise<AttendanceBreakdown> {
  const supabase = createClient();

  // Lifetime first
  const { data: allLinks } = await supabase
    .from('activity_students').select('activity_id').eq('student_id', studentId);
  const allActivityIds = ((allLinks ?? []) as Array<{ activity_id: string }>).map((l) => l.activity_id);

  let lifetime_present = 0;
  let lifetime_total = 0;
  if (allActivityIds.length > 0) {
    const { data: allAtt } = await supabase
      .from('attendance').select('attended')
      .eq('student_id', studentId)
      .in('activity_id', allActivityIds)
      .not('attended', 'is', null);
    ((allAtt ?? []) as Array<{ attended: boolean }>).forEach((a) => {
      lifetime_total += 1;
      if (a.attended) lifetime_present += 1;
    });
  }

  // Season-scoped + per-type
  const byType = {
    practice: { present: 0, total: 0, pct: null as number | null },
    game: { present: 0, total: 0, pct: null as number | null },
    off_ice_workout: { present: 0, total: 0, pct: null as number | null },
  };
  let overall_present = 0;
  let overall_total = 0;

  if (seasonId && allActivityIds.length > 0) {
    // Need activity rows to know type + season
    const { data: actRows } = await supabase
      .from('activities').select('id, activity_type, season_id')
      .in('id', allActivityIds)
      .eq('season_id', seasonId);
    const actMap = new Map(((actRows ?? []) as Array<{ id: string; activity_type: string; season_id: string | null }>)
      .map((a) => [a.id, a]));
    const seasonActivityIds = Array.from(actMap.keys());

    if (seasonActivityIds.length > 0) {
      const { data: seasonAtt } = await supabase
        .from('attendance').select('activity_id, attended')
        .eq('student_id', studentId)
        .in('activity_id', seasonActivityIds)
        .not('attended', 'is', null);
      ((seasonAtt ?? []) as Array<{ activity_id: string; attended: boolean }>).forEach((a) => {
        const act = actMap.get(a.activity_id);
        if (!act) return;
        overall_total += 1;
        if (a.attended) overall_present += 1;

        const type = act.activity_type as keyof typeof byType;
        if (byType[type]) {
          byType[type].total += 1;
          if (a.attended) byType[type].present += 1;
        }
      });
    }
  }

  (Object.keys(byType) as Array<keyof typeof byType>).forEach((k) => {
    const b = byType[k];
    b.pct = b.total === 0 ? null : Math.round((b.present / b.total) * 1000) / 10;
  });

  const overall_pct = overall_total === 0 ? null : Math.round((overall_present / overall_total) * 1000) / 10;
  const lifetime_pct = lifetime_total === 0 ? null : Math.round((lifetime_present / lifetime_total) * 1000) / 10;

  return {
    overall_pct,
    overall_present,
    overall_total,
    by_type: byType,
    lifetime_pct,
    lifetime_present,
    lifetime_total,
  };
}

async function buildTestTrends(
  studentId: string,
  seasonId: string | null
): Promise<TestTrend[]> {
  const supabase = createClient();

  let q = supabase.from('performance_test_results')
    .select('test_id, value, recorded_at, is_baseline')
    .eq('student_id', studentId)
    .order('recorded_at', { ascending: true });
  if (seasonId) q = q.eq('season_id', seasonId);

  const { data: resultRows } = await q;
  const results = (resultRows ?? []) as Array<Pick<PerformanceTestResult, 'test_id' | 'value' | 'recorded_at' | 'is_baseline'>>;

  if (results.length === 0) return [];

  const testIds = Array.from(new Set(results.map((r) => r.test_id)));
  const { data: testRows } = await supabase
    .from('performance_tests').select('id, title, unit, direction').in('id', testIds);
  const testById = new Map(((testRows ?? []) as Array<Pick<PerformanceTest, 'id' | 'title' | 'unit' | 'direction'>>)
    .map((t) => [t.id, t]));

  // Group by test_id
  const grouped = new Map<string, typeof results>();
  results.forEach((r) => {
    const arr = grouped.get(r.test_id) ?? [];
    arr.push(r);
    grouped.set(r.test_id, arr);
  });

  const trends: TestTrend[] = [];
  testIds.forEach((tid) => {
    const test = testById.get(tid);
    if (!test) return;
    const tResults = (grouped.get(tid) ?? []).slice();
    const baselineRow = tResults.find((r) => r.is_baseline) ?? tResults[0];
    const latest = tResults[tResults.length - 1];

    const baseline_value = baselineRow ? baselineRow.value : null;
    const latest_value = latest ? latest.value : null;

    let pct_change: number | null = null;
    if (baseline_value !== null && latest_value !== null && baseline_value !== 0) {
      const raw = ((latest_value - baseline_value) / baseline_value) * 100;
      // For lower-is-better tests (e.g., sprint time), negative raw change = improvement → flip sign
      pct_change = test.direction === 'lower_is_better' ? -raw : raw;
      pct_change = Math.round(pct_change * 10) / 10;
    }

    trends.push({
      test_id: tid,
      test_title: test.title,
      test_unit: test.unit,
      direction: test.direction,
      results: tResults.map((r) => ({
        value: r.value,
        recorded_at: r.recorded_at,
        is_baseline: r.is_baseline,
      })),
      baseline: baseline_value,
      latest: latest_value,
      pct_change_from_baseline: pct_change,
    });
  });

  // Sort by test title
  trends.sort((a, b) => a.test_title.localeCompare(b.test_title));
  return trends;
}

async function buildWorkoutInsights(
  studentId: string,
  seasonId: string | null
): Promise<WorkoutInsights> {
  const supabase = createClient();

  // Workouts attended
  const { data: workoutLinks } = await supabase
    .from('activity_students').select('activity_id').eq('student_id', studentId);
  const linkedActivityIds = ((workoutLinks ?? []) as Array<{ activity_id: string }>).map((l) => l.activity_id);

  let total_workouts_attended = 0;
  let workouts_in_last_30_days = 0;
  if (linkedActivityIds.length > 0) {
    let actQ = supabase.from('activities').select('id, occurred_on, activity_type')
      .in('id', linkedActivityIds).eq('activity_type', 'off_ice_workout');
    if (seasonId) actQ = actQ.eq('season_id', seasonId);
    const { data: workoutActs } = await actQ;
    const acts = (workoutActs ?? []) as Array<{ id: string; occurred_on: string }>;
    total_workouts_attended = acts.length;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    workouts_in_last_30_days = acts.filter((a) => a.occurred_on >= cutoffStr).length;
  }

  // Sets + RPE
  const { data: setRows } = await supabase
    .from('workout_exercise_sets').select('rpe').eq('student_id', studentId);
  const sets = (setRows ?? []) as Array<Pick<WorkoutExerciseSet, 'rpe'>>;
  const total_sets_logged = sets.length;
  const rpeValues = sets.map((s) => s.rpe).filter((v): v is number => v !== null && v !== undefined);
  const average_rpe = rpeValues.length === 0
    ? null
    : Math.round((rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length) * 10) / 10;

  return {
    total_workouts_attended,
    total_sets_logged,
    average_rpe,
    workouts_in_last_30_days,
  };
}

async function buildPlansWithGoals(
  studentId: string,
  seasonId: string | null,
  testTrends: TestTrend[]
): Promise<PlanWithGoals[]> {
  const supabase = createClient();

  // Trends keyed by test for fast lookup
  const trendByTestId = new Map(testTrends.map((t) => [t.test_id, t]));

  let planQ = supabase.from('goal_plans').select('*')
    .eq('student_id', studentId)
    .in('status', ['draft', 'active'])
    .order('created_at', { ascending: false });
  if (seasonId) planQ = planQ.eq('season_id', seasonId);
  const { data: planRows } = await planQ;
  const plans = (planRows ?? []) as GoalPlan[];

  if (plans.length === 0) return [];

  const planIds = plans.map((p) => p.id);
  const { data: goalRows } = await supabase
    .from('goal_plan_goals').select('*').in('plan_id', planIds).order('sequence');
  const goals = (goalRows ?? []) as GoalPlanGoal[];

  const out: PlanWithGoals[] = plans.map((p) => {
    const planGoals = goals.filter((g) => g.plan_id === p.id);
    const detailedGoals: GoalProgressDetail[] = planGoals.map((g) => {
      const auto = computeAutoGoalProgress(g, trendByTestId);
      return {
        ...g,
        computed_pct: auto.pct,
        is_auto: auto.isAuto,
        latest_value: auto.latest,
        baseline_value: auto.baseline,
      };
    });
    return { plan: p, goals: detailedGoals };
  });

  return out;
}

function computeAutoGoalProgress(
  goal: GoalPlanGoal,
  trendByTestId: Map<string, TestTrend>
): { pct: number; isAuto: boolean; latest: number | null; baseline: number | null } {
  if (goal.status === 'achieved') {
    return { pct: 100, isAuto: false, latest: null, baseline: null };
  }
  if (goal.status === 'abandoned') {
    return { pct: 0, isAuto: false, latest: null, baseline: null };
  }

  if (goal.linked_test_id && goal.target_numeric !== null) {
    const trend = trendByTestId.get(goal.linked_test_id);
    if (trend && trend.baseline !== null && trend.latest !== null) {
      const baseline = trend.baseline;
      const latest = trend.latest;
      const target = goal.target_numeric;

      // Same denominator regardless of direction; sign flips for lower-is-better
      const denom = target - baseline;
      if (denom === 0) {
        // Already at target
        return { pct: 100, isAuto: true, latest, baseline };
      }
      const numer = latest - baseline;
      let raw = (numer / denom) * 100;
      // Clamp 0..100; if direction agrees they're improving toward target, raw is positive
      raw = Math.max(0, Math.min(100, raw));
      return { pct: Math.round(raw), isAuto: true, latest, baseline };
    }
  }

  // Fallback: stored manual override
  return { pct: goal.progress_pct, isAuto: false, latest: null, baseline: null };
}
