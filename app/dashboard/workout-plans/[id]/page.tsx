import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { WorkoutPlanDetailClient } from './WorkoutPlanDetailClient';
import type { WorkoutPlan, WorkoutPlanItem, Exercise } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface ResolvedPlanItem extends WorkoutPlanItem {
  exercise_title: string;
  exercise_category: string | null;
}

export default async function WorkoutPlanDetailPage({ params }: { params: { id: string } }) {
  await requireRole('admin', 'director', 'trainer');
  const supabase = createClient();

  const { data: planRow } = await supabase
    .from('workout_plans').select('*').eq('id', params.id).single();
  if (!planRow) notFound();
  const plan = planRow as WorkoutPlan;

  const [{ data: itemRows }, { data: exerciseRows }] = await Promise.all([
    supabase.from('workout_plan_items').select('*').eq('plan_id', plan.id).order('sequence'),
    supabase.from('exercises').select('id, title, category, active').eq('active', true).order('title'),
  ]);

  const items = (itemRows ?? []) as WorkoutPlanItem[];
  const exercises = (exerciseRows ?? []) as Array<Pick<Exercise, 'id' | 'title' | 'category' | 'active'>>;
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));

  const resolved: ResolvedPlanItem[] = items.map((it) => {
    const ex = exerciseById.get(it.exercise_id);
    return {
      ...it,
      exercise_title: ex?.title ?? '(Unknown exercise)',
      exercise_category: ex?.category ?? null,
    };
  });

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/workout-plans" className="hover:text-ink">Workout Plans</Link>
            <span className="mx-2">·</span>
            Plan
          </>
        }
        title={<em className="italic">{plan.title}</em>}
        description={plan.focus ?? plan.description ?? undefined}
      />
      <WorkoutPlanDetailClient plan={plan} items={resolved} exercises={exercises} />
    </>
  );
}
