import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { WorkoutsClient } from './WorkoutsClient';
import type { Activity, Student, WorkoutPlan } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface WorkoutRow extends Activity {
  roster_count: number;
  exercise_count: number;
  sets_logged: number;
  source_plan_title: string | null;
}

export default async function WorkoutsPage() {
  await requireRole('admin', 'director', 'trainer');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();
  const seasonId = seasonCtx.selected?.id;

  let workoutsQuery = supabase.from('activities').select('*')
    .eq('activity_type', 'off_ice_workout')
    .order('occurred_on', { ascending: false })
    .limit(200);
  if (seasonId) {
    workoutsQuery = workoutsQuery.eq('season_id', seasonId);
  }

  const [{ data: wRows }, { data: planRows }, { data: studentRows }] = await Promise.all([
    workoutsQuery,
    supabase.from('workout_plans').select('*')
      .eq('is_template', true).order('title'),
    supabase.from('students').select('id, full_name, jersey_number, active')
      .eq('active', true).order('full_name'),
  ]);

  const workouts = (wRows ?? []) as Activity[];
  const plans = (planRows ?? []) as WorkoutPlan[];
  const students = (studentRows ?? []) as Array<Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'active'>>;

  const workoutIds = workouts.map((w) => w.id);
  const rosterCounts = new Map<string, number>();
  const exerciseCounts = new Map<string, number>();
  const setsCounts = new Map<string, number>();
  if (workoutIds.length > 0) {
    const [{ data: rosterR }, { data: exR }] = await Promise.all([
      supabase.from('activity_students').select('activity_id').in('activity_id', workoutIds),
      supabase.from('workout_exercises').select('id, activity_id').in('activity_id', workoutIds),
    ]);
    ((rosterR ?? []) as Array<{ activity_id: string }>).forEach((r) => {
      rosterCounts.set(r.activity_id, (rosterCounts.get(r.activity_id) ?? 0) + 1);
    });
    const exRows = (exR ?? []) as Array<{ id: string; activity_id: string }>;
    const exToAct = new Map(exRows.map((r) => [r.id, r.activity_id]));
    exRows.forEach((e) => {
      exerciseCounts.set(e.activity_id, (exerciseCounts.get(e.activity_id) ?? 0) + 1);
    });
    const exIds = exRows.map((e) => e.id);
    if (exIds.length > 0) {
      const { data: setsR } = await supabase
        .from('workout_exercise_sets').select('workout_exercise_id')
        .in('workout_exercise_id', exIds);
      ((setsR ?? []) as Array<{ workout_exercise_id: string }>).forEach((s) => {
        const actId = exToAct.get(s.workout_exercise_id);
        if (actId) setsCounts.set(actId, (setsCounts.get(actId) ?? 0) + 1);
      });
    }
  }

  const planTitleById = new Map(plans.map((p) => [p.id, p.title]));
  const rows: WorkoutRow[] = workouts.map((w) => ({
    ...w,
    roster_count: rosterCounts.get(w.id) ?? 0,
    exercise_count: exerciseCounts.get(w.id) ?? 0,
    sets_logged: setsCounts.get(w.id) ?? 0,
    source_plan_title: w.source_workout_plan_id ? planTitleById.get(w.source_workout_plan_id) ?? null : null,
  }));

  return (
    <>
      <PageHeader
        kicker={seasonCtx.selected ? `Trainer · Off-Ice Workouts · ${seasonCtx.selected.name}` : 'Trainer · Off-Ice Workouts'}
        title={<><em className="italic text-crimson">Off-ice</em> sessions.</>}
        description="Schedule gym workouts from a plan or ad-hoc. Track actual weight, reps, and RPE per set per student."
        actions={
          <WorkoutsClient
            workouts={[]} plans={plans} students={students}
            seasonId={seasonId ?? null} seasonArchived={seasonCtx.isArchived}
            addOnly
          />
        }
      />
      <WorkoutsClient
        workouts={rows} plans={plans} students={students}
        seasonId={seasonId ?? null} seasonArchived={seasonCtx.isArchived}
      />
    </>
  );
}
