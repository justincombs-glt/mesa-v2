import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import type { Student, GoalPlan, Activity, FamilyLink } from '@/lib/supabase/types';

/**
 * Resolves the Student record that a student-role profile is linked to.
 * Returns null if no student is linked (shouldn't happen in practice — admin
 * should link via linkStudentProfile when creating the account).
 */
export async function getLinkedStudentForProfile(profileId: string): Promise<Student | null> {
  const supabase = createClient();
  const { data } = await supabase.from('students').select('*').eq('profile_id', profileId).maybeSingle();
  return data ? (data as unknown as Student) : null;
}

/**
 * Returns all students linked to a parent profile via family_links.
 */
export async function getLinkedStudentsForParent(parentProfileId: string): Promise<Student[]> {
  const supabase = createClient();
  const { data: linkRows } = await supabase
    .from('family_links').select('student_id, relationship, is_primary').eq('parent_id', parentProfileId);
  const studentIds = ((linkRows ?? []) as Array<Pick<FamilyLink, 'student_id'>>).map((l) => l.student_id);
  if (studentIds.length === 0) return [];
  const { data: studentRows } = await supabase
    .from('students').select('*').in('id', studentIds).order('full_name');
  return (studentRows ?? []) as Student[];
}

export interface StudentDashboardData {
  student: Student;
  seasonId: string | null;
  seasonName: string | null;
  activePlans: Array<Pick<GoalPlan, 'id' | 'title' | 'status'> & { goal_count: number }>;
  upcomingActivities: Activity[];
  recentActivities: Activity[];
  latestTestResults: Array<{
    test_title: string;
    test_unit: string | null;
    value: number;
    recorded_at: string;
    is_baseline: boolean;
  }>;
  workoutSetsLogged: number;
  attendanceTotal: { present: number; absent: number };
}

/**
 * Gathers the data for a student's dashboard home / per-child family detail view.
 */
export async function buildStudentDashboard(studentId: string): Promise<StudentDashboardData | null> {
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();
  const seasonId = seasonCtx.selected?.id ?? null;

  const { data: studentRow } = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
  if (!studentRow) return null;
  const student = studentRow as unknown as Student;

  // Active goal plans (scoped to current season)
  let plansQuery = supabase.from('goal_plans').select('*')
    .eq('student_id', studentId)
    .in('status', ['draft', 'active'])
    .order('created_at', { ascending: false });
  if (seasonId) plansQuery = plansQuery.eq('season_id', seasonId);
  const { data: planRows } = await plansQuery;
  const plans = (planRows ?? []) as GoalPlan[];

  // Goal counts per plan
  const planIds = plans.map((p) => p.id);
  const goalCountMap = new Map<string, number>();
  if (planIds.length > 0) {
    const { data: goalRows } = await supabase
      .from('goals').select('id, plan_id').in('plan_id', planIds);
    ((goalRows ?? []) as Array<{ id: string; plan_id: string }>).forEach((g) => {
      goalCountMap.set(g.plan_id, (goalCountMap.get(g.plan_id) ?? 0) + 1);
    });
  }
  const activePlans = plans.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    goal_count: goalCountMap.get(p.id) ?? 0,
  }));

  // Activities where this student is rostered, scoped to current season
  let activityIds: string[] = [];
  if (seasonId) {
    const { data: linkRows } = await supabase
      .from('activity_students').select('activity_id').eq('student_id', studentId);
    activityIds = ((linkRows ?? []) as Array<{ activity_id: string }>).map((r) => r.activity_id);
  }

  let upcomingActivities: Activity[] = [];
  let recentActivities: Activity[] = [];
  if (activityIds.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: upR }, { data: recR }] = await Promise.all([
      supabase.from('activities').select('*')
        .in('id', activityIds)
        .gte('occurred_on', today)
        .order('occurred_on', { ascending: true })
        .limit(5)
        .eq('season_id', seasonId as string),
      supabase.from('activities').select('*')
        .in('id', activityIds)
        .lt('occurred_on', today)
        .order('occurred_on', { ascending: false })
        .limit(5)
        .eq('season_id', seasonId as string),
    ]);
    upcomingActivities = (upR ?? []) as Activity[];
    recentActivities = (recR ?? []) as Activity[];
  }

  // Latest performance test results (top 5 distinct tests, most recent)
  const { data: perfRows } = await supabase
    .from('performance_test_results').select('test_id, value, recorded_at, is_baseline')
    .eq('student_id', studentId)
    .order('recorded_at', { ascending: false })
    .limit(20);
  const perfData = (perfRows ?? []) as Array<{ test_id: string; value: number; recorded_at: string; is_baseline: boolean }>;
  const seenTests = new Set<string>();
  const topLatest = perfData.filter((r) => {
    if (seenTests.has(r.test_id)) return false;
    seenTests.add(r.test_id);
    return true;
  }).slice(0, 5);

  let latestTestResults: StudentDashboardData['latestTestResults'] = [];
  if (topLatest.length > 0) {
    const testIds = topLatest.map((r) => r.test_id);
    const { data: testRows } = await supabase
      .from('performance_tests').select('id, title, unit').in('id', testIds);
    const testById = new Map(((testRows ?? []) as Array<{ id: string; title: string; unit: string | null }>)
      .map((t) => [t.id, t]));
    latestTestResults = topLatest.map((r) => {
      const t = testById.get(r.test_id);
      return {
        test_title: t?.title ?? '(Unknown test)',
        test_unit: t?.unit ?? null,
        value: r.value,
        recorded_at: r.recorded_at,
        is_baseline: r.is_baseline,
      };
    });
  }

  // Workout sets logged (count)
  const { count: setsCount } = await supabase
    .from('workout_exercise_sets').select('id', { count: 'exact', head: true })
    .eq('student_id', studentId);

  // Attendance totals for current season
  let attendance = { present: 0, absent: 0 };
  if (activityIds.length > 0) {
    const { data: attRows } = await supabase
      .from('attendance').select('attended')
      .eq('student_id', studentId)
      .in('activity_id', activityIds);
    ((attRows ?? []) as Array<{ attended: boolean | null }>).forEach((a) => {
      if (a.attended === true) attendance.present += 1;
      else if (a.attended === false) attendance.absent += 1;
    });
  }

  return {
    student,
    seasonId,
    seasonName: seasonCtx.selected?.name ?? null,
    activePlans,
    upcomingActivities,
    recentActivities,
    latestTestResults,
    workoutSetsLogged: setsCount ?? 0,
    attendanceTotal: attendance,
  };
}
