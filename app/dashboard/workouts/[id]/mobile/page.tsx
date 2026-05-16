import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { MobileWorkoutLogger } from './MobileWorkoutLogger';
import type {
  Activity, WorkoutExercise, WorkoutExerciseSet, Exercise,
} from '@/lib/supabase/types';
import type { RosterStudent, ResolvedExercise, SetMap } from '../page';

export const dynamic = 'force-dynamic';

export default async function MobileWorkoutPage({ params }: { params: { id: string } }) {
  const profile = await requireRole('admin', 'director', 'trainer', 'student', 'player');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();

  // Phase 18b: resolve own student-row id for both student AND player roles.
  // Used for self-only data filtering AND for the isCreator check below.
  let selfStudentId: string | null = null;
  if (profile.role === 'student' || profile.role === 'player') {
    const { data: selfRow } = await supabase
      .from('students').select('id').eq('profile_id', profile.id).maybeSingle();
    if (!selfRow) {
      // Has no linked athlete record yet — can't log workouts
      redirect('/dashboard');
    }
    selfStudentId = (selfRow as { id: string }).id;
  }

  const { data: actRow } = await supabase.from('activities').select('*').eq('id', params.id).single();
  if (!actRow) notFound();
  const workout = actRow as Activity;
  if (workout.activity_type !== 'off_ice_workout') notFound();

  // Roster
  const { data: rosterLinks } = await supabase
    .from('activity_students').select('student_id').eq('activity_id', workout.id);
  const rosterIds = ((rosterLinks ?? []) as Array<{ student_id: string }>).map((l) => l.student_id);

  // Q10: students/players see only their own data, never other athletes'.
  // If they open a workout they're not on, RLS prevents reads anyway, but fail loudly here too.
  if (profile.role === 'student' || profile.role === 'player') {
    if (!selfStudentId || !rosterIds.includes(selfStudentId)) {
      redirect('/dashboard');
    }
  }

  let rosterStudents: RosterStudent[] = [];
  if (rosterIds.length > 0) {
    const { data: sRows } = await supabase
      .from('students').select('id, full_name, jersey_number')
      .in('id', rosterIds).order('full_name');
    rosterStudents = (sRows ?? []) as RosterStudent[];
  }

  // For students AND players (Phase 18b), filter roster to themselves only.
  // `studentMode` is the legacy name; "athlete in self-log mode" is the
  // semantics — applies to both student and player roles.
  const studentMode = profile.role === 'student' || profile.role === 'player';
  if (studentMode && selfStudentId) {
    rosterStudents = rosterStudents.filter((r) => r.id === selfStudentId);
  }

  // Q7 = C: students can delete sets only when they're the sole athlete on the workout.
  // We pass the *full* roster size (before filtering) so the logger can decide. With
  // studentMode + isSoleAthlete = true → delete buttons enabled. Otherwise hidden.
  const isSoleAthlete = rosterIds.length === 1;

  // Workout exercises
  const { data: wExRows } = await supabase
    .from('workout_exercises').select('*').eq('activity_id', workout.id).order('sequence');
  const workoutExercises = (wExRows ?? []) as WorkoutExercise[];
  const wExIds = workoutExercises.map((we) => we.id);

  // Resolve exercise titles
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

  // Set map keyed by `${workout_exercise_id}:${student_id}` -> SetCell[] (ordered by set_number)
  const setMap: SetMap = {};
  if (wExIds.length > 0) {
    let setQuery = supabase.from('workout_exercise_sets').select('*')
      .in('workout_exercise_id', wExIds)
      .order('set_number');
    // For students, only fetch their own sets
    if (studentMode && selfStudentId) {
      setQuery = setQuery.eq('student_id', selfStudentId);
    }
    const { data: setRows } = await setQuery;
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
    Object.keys(setMap).forEach((k) => {
      setMap[k].sort((a, b) => a.set_number - b.set_number);
    });
  }

  // Phase 18b: detect "viewer created this" — gates the manage-exercises
  // affordance and "Edit metadata" CTAs on the mobile logger.
  const isCreator = workout.logged_by === profile.id;

  // Phase 18b: only load the exercise library when the viewer is the creator
  // (since only they see the manage panel). Avoids wasted query for trainers
  // and athletes opening trainer-scheduled workouts.
  let addableExercises: Array<{ id: string; name: string; category: string | null; body_part: string | null }> = [];
  if (isCreator) {
    const { data: exRows } = await supabase
      .from('exercises')
      .select('id, name, category, body_part')
      .order('name')
      .limit(500);
    addableExercises = (exRows ?? []) as Array<{
      id: string; name: string; category: string | null; body_part: string | null;
    }>;
  }

  // Empty-state shortcut: nothing to log if either the roster or the exercise list is empty.
  // Exception: a creator with zero exercises still sees the full logger so they can
  // open the Manage panel and add their first exercise.
  const hasContent = rosterStudents.length > 0 && (resolvedExercises.length > 0 || isCreator);

  // Exit destination differs by role: students don't have access to /dashboard/workouts/[id]
  // (the trainer-style desktop view), so they exit to their dashboard instead.
  const exitHref = studentMode ? '/dashboard' : `/dashboard/workouts/${workout.id}`;

  return (
    <div className="-mx-4 md:-mx-10 -mt-6 md:-mt-12 flex flex-col">
      <MobileLoggerHeader workout={workout} exitHref={exitHref} />
      {!hasContent ? (
        <div className="p-8">
          <div className="card-base p-6 text-center max-w-sm mx-auto">
            <p className="text-sm text-ink-dim mb-4">
              {rosterStudents.length === 0
                ? (studentMode
                    ? "You're not on the roster for this workout."
                    : 'This workout has no athletes assigned. ')
                : 'This workout has no exercises planned yet. '}
              {!studentMode && 'Set it up on desktop first.'}
            </p>
            <Link href={exitHref}
              className="btn-secondary !h-10 !px-5 text-[13px]">
              {studentMode ? '← Back to dashboard' : 'Open desktop view →'}
            </Link>
          </div>
        </div>
      ) : (
        <MobileWorkoutLogger
          workout={workout}
          roster={rosterStudents}
          exercises={resolvedExercises}
          setMap={setMap}
          readOnly={seasonCtx.isArchived || (studentMode && !workout.released_at)}
          locked={studentMode && !workout.released_at}
          studentMode={studentMode}
          canDeleteSets={!studentMode || isSoleAthlete}
          isCreator={isCreator}
          addableExercises={addableExercises}
        />
      )}
    </div>
  );
}

function MobileLoggerHeader({ workout, exitHref }: { workout: Activity; exitHref: string }) {
  const date = new Date(workout.occurred_on + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
  return (
    <div className="bg-paper border-b border-ink-hair">
      <div className="flex items-center gap-3 px-3 py-3">
        <Link href={exitHref}
          className="w-11 h-11 -ml-1 grid place-items-center rounded-lg active:bg-ivory text-ink-dim"
          aria-label="Exit mobile mode">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[17px] text-ink leading-none truncate">
            {workout.title || 'Workout'}
          </div>
          <div className="kicker mt-1">
            {date}
            {workout.starts_at ? ` · ${workout.starts_at.slice(0, 5)}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
