import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { WorkoutPlansClient } from './WorkoutPlansClient';
import type { WorkoutPlan, WorkoutPlanItem } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface WorkoutPlanRow extends WorkoutPlan {
  exercise_count: number;
}

export default async function WorkoutPlansPage() {
  await requireRole('admin', 'director', 'trainer');
  const supabase = createClient();

  const { data: planRows } = await supabase
    .from('workout_plans').select('*').eq('is_template', true).order('title');
  const plans = (planRows ?? []) as WorkoutPlan[];

  const counts = new Map<string, number>();
  if (plans.length > 0) {
    const { data: itemRows } = await supabase
      .from('workout_plan_items').select('plan_id').in('plan_id', plans.map((p) => p.id));
    ((itemRows ?? []) as Pick<WorkoutPlanItem, 'plan_id'>[]).forEach((it) => {
      counts.set(it.plan_id, (counts.get(it.plan_id) ?? 0) + 1);
    });
  }

  const rows: WorkoutPlanRow[] = plans.map((p) => ({
    ...p,
    exercise_count: counts.get(p.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        kicker="Trainer · Workout Plans"
        title={<><em className="italic text-crimson">Off-ice</em> templates.</>}
        description="Reusable gym workout templates. Build once, schedule as many times as you want. Scheduling a workout copies the plan's exercises into that session, where you log actual weight, reps, and RPE per set."
        actions={<WorkoutPlansClient plans={[]} addOnly />}
      />
      <WorkoutPlansClient plans={rows} />
    </>
  );
}
