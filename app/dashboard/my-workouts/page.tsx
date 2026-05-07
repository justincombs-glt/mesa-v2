import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Activity } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

interface WorkoutWithSetCount extends Activity {
  my_set_count: number;
}

export default async function MyWorkoutsPage() {
  const profile = await requireRole('student');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();
  const seasonId = seasonCtx.selected?.id ?? null;

  // Resolve linked student record
  const { data: selfRow } = await supabase
    .from('students').select('id, full_name').eq('profile_id', profile.id).maybeSingle();
  if (!selfRow) {
    return (
      <>
        <PageHeader
          kicker="Student"
          title="My workouts"
          description="Log your off-ice workouts."
        />
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            Your account isn&apos;t linked to a student record yet. Ask your coach or the academy office to link you.
          </p>
        </div>
      </>
    );
  }
  const selfStudent = selfRow as { id: string; full_name: string };

  // Workouts this student is rostered into (off-ice only)
  let workouts: WorkoutWithSetCount[] = [];
  if (seasonId) {
    const { data: linkRows } = await supabase
      .from('activity_students').select('activity_id').eq('student_id', selfStudent.id);
    const activityIds = ((linkRows ?? []) as Array<{ activity_id: string }>).map((r) => r.activity_id);

    if (activityIds.length > 0) {
      const { data: actRows } = await supabase
        .from('activities').select('*')
        .in('id', activityIds)
        .eq('activity_type', 'off_ice_workout')
        .eq('season_id', seasonId)
        .order('occurred_on', { ascending: false })
        .limit(50);
      const activities = (actRows ?? []) as Activity[];

      // For each, count this student's logged sets
      let setCounts = new Map<string, number>();
      if (activities.length > 0) {
        // Need to map activity_id → workout_exercise_ids → sets
        const { data: weRows } = await supabase
          .from('workout_exercises').select('id, activity_id')
          .in('activity_id', activities.map((a) => a.id));
        const weList = ((weRows ?? []) as Array<{ id: string; activity_id: string }>);
        const weToActivity = new Map(weList.map((we) => [we.id, we.activity_id]));

        if (weList.length > 0) {
          const { data: setRows } = await supabase
            .from('workout_exercise_sets').select('workout_exercise_id')
            .eq('student_id', selfStudent.id)
            .in('workout_exercise_id', weList.map((w) => w.id));
          ((setRows ?? []) as Array<{ workout_exercise_id: string }>).forEach((s) => {
            const aid = weToActivity.get(s.workout_exercise_id);
            if (aid) setCounts.set(aid, (setCounts.get(aid) ?? 0) + 1);
          });
        }
      }

      workouts = activities.map((a) => ({
        ...a,
        my_set_count: setCounts.get(a.id) ?? 0,
      }));
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = workouts.filter((w) => w.occurred_on >= today).sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  const past = workouts.filter((w) => w.occurred_on < today);

  return (
    <>
      <PageHeader
        kicker={`Student · ${seasonCtx.selected?.name ?? 'No season'}`}
        title={<>My <em className="italic text-crimson">workouts</em>.</>}
        description="Off-ice workouts your trainer has scheduled. Tap one to log your sets."
      />

      <div className="flex flex-col gap-8">
        <section>
          <div className="kicker mb-3">Upcoming · {upcoming.length}</div>
          {upcoming.length === 0 ? (
            <div className="card-base p-6 text-center text-sm text-ink-dim">
              Nothing on the schedule. Check back when your trainer adds something.
            </div>
          ) : (
            <div className="card-base overflow-hidden">
              {upcoming.map((w, idx) => <WorkoutRow key={w.id} workout={w} first={idx === 0} />)}
            </div>
          )}
        </section>

        <section>
          <div className="kicker mb-3">Past · {past.length}</div>
          {past.length === 0 ? (
            <div className="card-base p-6 text-center text-sm text-ink-dim">No past workouts yet.</div>
          ) : (
            <div className="card-base overflow-hidden">
              {past.map((w, idx) => <WorkoutRow key={w.id} workout={w} first={idx === 0} />)}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function WorkoutRow({ workout, first }: { workout: WorkoutWithSetCount; first: boolean }) {
  const date = new Date(workout.occurred_on + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  return (
    <Link
      href={`/dashboard/workouts/${workout.id}/mobile`}
      className={`flex items-center gap-4 px-5 py-3.5 ${first ? '' : 'border-t border-ink-hair'} group hover:bg-ivory active:bg-ivory transition-colors`}
    >
      <div className="flex-shrink-0 w-16 text-right">
        <div className="font-serif text-sm text-ink">{date}</div>
        {workout.starts_at && (
          <div className="text-[10px] font-mono text-ink-faint mt-0.5">{workout.starts_at.slice(0, 5)}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-sage-dark text-paper">
            Off-ice
          </span>
          <span className="text-sm font-medium text-ink truncate">{workout.title || 'Workout'}</span>
        </div>
        <div className="text-xs text-ink-faint truncate">
          {workout.my_set_count > 0
            ? `${workout.my_set_count} set${workout.my_set_count === 1 ? '' : 's'} logged`
            : 'No sets logged yet'}
          {workout.focus && ` · ${workout.focus}`}
        </div>
      </div>
      <div className="flex-shrink-0 text-[10px] font-mono uppercase tracking-wider text-ink-faint group-hover:text-crimson">
        Log →
      </div>
    </Link>
  );
}
