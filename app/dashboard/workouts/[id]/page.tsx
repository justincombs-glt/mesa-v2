import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { WorkoutDetailClient } from './WorkoutDetailClient';
import type {
  Activity, WorkoutExercise, WorkoutExerciseSet,
  Exercise, SeasonEnrollment,
} from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface RosterStudent {
  id: string;
  full_name: string;
  jersey_number: number | null;
}

export interface ResolvedExercise extends WorkoutExercise {
  exercise_title: string;
  exercise_category: string | null;
}

export interface SetCell {
  id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
}

// Map keyed by `${workout_exercise_id}:${student_id}` -> SetCell[] (ordered by set_number)
export type SetMap = Record<string, SetCell[]>;

export default async function WorkoutDetailPage({ params }: { params: { id: string } }) {
  await requireRole('admin', 'director', 'trainer');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();

  const { data: actRow } = await supabase.from('activities').select('*').eq('id', params.id).single();
  if (!actRow) notFound();
  const workout = actRow as Activity;
  if (workout.activity_type !== 'off_ice_workout') notFound();

  // Roster
  const { data: rosterLinks } = await supabase
    .from('activity_students').select('student_id').eq('activity_id', workout.id);
  const rosterIds = ((rosterLinks ?? []) as Array<{ student_id: string }>).map((l) => l.student_id);

  let rosterStudents: RosterStudent[] = [];
  if (rosterIds.length > 0) {
    const { data: sRows } = await supabase
      .from('students').select('id, full_name, jersey_number')
      .in('id', rosterIds).order('full_name');
    rosterStudents = (sRows ?? []) as RosterStudent[];
  }

  // Workout exercises
  const { data: wExRows } = await supabase
    .from('workout_exercises').select('*').eq('activity_id', workout.id).order('sequence');
  const workoutExercises = (wExRows ?? []) as WorkoutExercise[];

  // Resolve exercise titles
  const wExIds = workoutExercises.map((we) => we.id);
  const exerciseIds = Array.from(new Set(workoutExercises.map((we) => we.exercise_id)));
  let exercisesById = new Map<string, Pick<Exercise, 'id' | 'title' | 'category' | 'active'>>();
  if (exerciseIds.length > 0) {
    const { data: exRows } = await supabase
      .from('exercises').select('id, title, category, active').in('id', exerciseIds);
    ((exRows ?? []) as Array<Pick<Exercise, 'id' | 'title' | 'category' | 'active'>>).forEach((e) => {
      exercisesById.set(e.id, e);
    });
  }

  const resolvedExercises: ResolvedExercise[] = workoutExercises.map((we) => {
    const ex = exercisesById.get(we.exercise_id);
    return {
      ...we,
      exercise_title: ex?.title ?? '(Unknown exercise)',
      exercise_category: ex?.category ?? null,
    };
  });

  // Pull all set rows for all workout exercises
  const setMap: SetMap = {};
  if (wExIds.length > 0) {
    const { data: setRows } = await supabase
      .from('workout_exercise_sets').select('*')
      .in('workout_exercise_id', wExIds)
      .order('set_number');
    ((setRows ?? []) as WorkoutExerciseSet[]).forEach((s) => {
      const key = `${s.workout_exercise_id}:${s.student_id}`;
      const arr = setMap[key] ?? [];
      arr.push({
        id: s.id,
        set_number: s.set_number,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        notes: s.notes,
      });
      setMap[key] = arr;
    });
    // Ensure each list is sorted by set_number
    Object.keys(setMap).forEach((k) => {
      setMap[k].sort((a, b) => a.set_number - b.set_number);
    });
  }

  // All active exercises (for adding new exercise to workout)
  const { data: allExercises } = await supabase
    .from('exercises').select('id, title, category, active').eq('active', true).order('title');
  const addableExercises = ((allExercises ?? []) as Array<Pick<Exercise, 'id' | 'title' | 'category' | 'active'>>);

  // Addable students — season-enrolled, not already on roster
  const rosterSet = new Set(rosterIds);
  let availableStudents: RosterStudent[] = [];
  if (workout.season_id) {
    const { data: enrollRows } = await supabase
      .from('season_enrollments').select('student_id')
      .eq('season_id', workout.season_id).is('departed_on', null);
    const enrolledIds = ((enrollRows ?? []) as Array<Pick<SeasonEnrollment, 'student_id'>>)
      .map((e) => e.student_id)
      .filter((id) => !rosterSet.has(id));
    if (enrolledIds.length > 0) {
      const { data: availRows } = await supabase
        .from('students').select('id, full_name, jersey_number')
        .in('id', enrolledIds).eq('active', true).order('full_name');
      availableStudents = (availRows ?? []) as RosterStudent[];
    }
  }

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/workouts" className="hover:text-ink">Off-Ice Workouts</Link>
            <span className="mx-2">·</span>
            Session
          </>
        }
        title={<em className="italic">{workout.title || 'Workout'}</em>}
        description={formatWorkoutHeader(workout)}
      />
      <WorkoutDetailClient
        workout={workout}
        roster={rosterStudents}
        addableStudents={availableStudents}
        exercises={resolvedExercises}
        addableExercises={addableExercises}
        setMap={setMap}
        readOnly={seasonCtx.isArchived}
      />
    </>
  );
}

function formatWorkoutHeader(w: Activity): string {
  const parts: string[] = [];
  parts.push(new Date(w.occurred_on + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }));
  if (w.starts_at) parts.push(w.starts_at.slice(0, 5));
  if (w.duration_minutes) parts.push(`${w.duration_minutes} min`);
  if (w.off_ice_category) {
    const label = w.off_ice_category === 'custom' && w.custom_category_name
      ? w.custom_category_name
      : w.off_ice_category === 'strength_conditioning' ? 'Strength & Conditioning'
      : w.off_ice_category === 'pilates' ? 'Pilates'
      : w.off_ice_category === 'fight_club' ? 'Fight Club'
      : w.off_ice_category;
    parts.push(label);
  }
  return parts.join(' · ');
}
