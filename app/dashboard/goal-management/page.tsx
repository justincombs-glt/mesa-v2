import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { GoalManagementClient } from './GoalManagementClient';
import type { GoalPlan, Student } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface PlanRow extends GoalPlan {
  student_name: string;
  student_jersey: string | null;
  goal_count: number;
  test_count: number;
  review_count: number;
}

export default async function GoalManagementPage() {
  await requireRole('admin', 'director');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();
  const seasonId = seasonCtx.selected?.id;

  // Scope plans to selected season; show all students for the picker
  let plansQuery = supabase.from('goal_plans').select('*').order('created_at', { ascending: false });
  if (seasonId) {
    plansQuery = plansQuery.eq('season_id', seasonId);
  }

  const [{ data: planRows }, { data: studentRows }] = await Promise.all([
    plansQuery,
    supabase.from('students').select('id, full_name, jersey_number, active').eq('active', true).order('full_name'),
  ]);

  const plans = (planRows ?? []) as GoalPlan[];
  const students = (studentRows ?? []) as Array<Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'active'>>;

  // Counts per plan
  const planIds = plans.map((p) => p.id);
  const goalCounts = new Map<string, number>();
  const testCounts = new Map<string, number>();
  const reviewCounts = new Map<string, number>();

  if (planIds.length > 0) {
    const [{ data: goalRows }, { data: testRows }, { data: reviewRows }] = await Promise.all([
      supabase.from('goal_plan_goals').select('plan_id').in('plan_id', planIds),
      supabase.from('goal_plan_composites').select('plan_id').in('plan_id', planIds),
      supabase.from('reviews').select('plan_id').in('plan_id', planIds),
    ]);
    ((goalRows ?? []) as Array<{ plan_id: string }>).forEach((g) => {
      goalCounts.set(g.plan_id, (goalCounts.get(g.plan_id) ?? 0) + 1);
    });
    ((testRows ?? []) as Array<{ plan_id: string }>).forEach((t) => {
      testCounts.set(t.plan_id, (testCounts.get(t.plan_id) ?? 0) + 1);
    });
    ((reviewRows ?? []) as Array<{ plan_id: string }>).forEach((r) => {
      reviewCounts.set(r.plan_id, (reviewCounts.get(r.plan_id) ?? 0) + 1);
    });
  }

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const rows: PlanRow[] = plans.map((p) => {
    const s = studentMap.get(p.student_id);
    return {
      ...p,
      student_name: s?.full_name ?? '(unknown student)',
      student_jersey: s?.jersey_number ?? null,
      goal_count: goalCounts.get(p.id) ?? 0,
      test_count: testCounts.get(p.id) ?? 0,
      review_count: reviewCounts.get(p.id) ?? 0,
    };
  });

  return (
    <>
      <PageHeader
        kicker={seasonCtx.selected ? `Director · Goal Management · ${seasonCtx.selected.name}` : 'Director · Goal Management'}
        title={<>Goal <em className="italic text-crimson">plans</em>.</>}
        description="Each student can have a multi-goal plan with attached composite performance tests and formal reviews. Goals are limited to 1–3 per plan so focus stays clear."
        actions={<GoalManagementClient plans={[]} students={students} seasonId={seasonId ?? null} seasonArchived={seasonCtx.isArchived} addOnly />}
      />
      <GoalManagementClient plans={rows} students={students} seasonId={seasonId ?? null} seasonArchived={seasonCtx.isArchived} />
    </>
  );
}
