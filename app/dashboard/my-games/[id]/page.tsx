import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { getLinkedStudentForProfile } from '@/lib/student-dashboard';
import type { Activity, GameStat, Attendance, Student } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function MyGameDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  const supabase = createClient();

  // Phase 14: this route now accepts students AND parents. Other roles fall
  // through to a 404 since they have their own staff detail surface.
  if (profile.role !== 'student' && profile.role !== 'parent') {
    notFound();
  }

  // Identify which student we're showing. For students it's their linked record;
  // for parents it's the student linked to this game's roster (single-student
  // games for sure, but multi-student legacy games take the first linked child).
  let student: Student | null = null;

  if (profile.role === 'student') {
    student = await getLinkedStudentForProfile(profile.id);
  } else {
    // Parent: find the student in this game's roster that the parent has access to
    const { data: rosterRows } = await supabase
      .from('activity_students').select('student_id').eq('activity_id', params.id);
    const rosterIds = ((rosterRows ?? []) as Array<{ student_id: string }>).map((r) => r.student_id);
    if (rosterIds.length > 0) {
      const { data: linkRows } = await supabase
        .from('family_links').select('student_id')
        .eq('parent_id', profile.id).in('student_id', rosterIds);
      const myChildIds = ((linkRows ?? []) as Array<{ student_id: string }>).map((r) => r.student_id);
      if (myChildIds.length > 0) {
        const { data: sRow } = await supabase
          .from('students').select('*').eq('id', myChildIds[0]).single();
        student = (sRow as unknown as Student) ?? null;
      }
    }
  }

  if (!student) {
    return (
      <>
        <PageHeader kicker={profile.role === 'parent' ? 'Parent' : 'Student'} title="Game" description="Couldn't load." />
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim">
            {profile.role === 'parent'
              ? "You don't have access to this game."
              : "Your account isn't linked to a student record yet."}
          </p>
        </div>
      </>
    );
  }

  const { data: actRow } = await supabase
    .from('activities').select('*').eq('id', params.id).eq('activity_type', 'game').single();
  if (!actRow) notFound();
  const game = actRow as Activity;

  // Verify student is rostered onto this game
  const { data: rosterCheck } = await supabase
    .from('activity_students').select('student_id').eq('activity_id', game.id).eq('student_id', student.id).maybeSingle();
  if (!rosterCheck) notFound();

  // My stats (if recorded)
  const { data: statRow } = await supabase
    .from('game_stats').select('*').eq('activity_id', game.id).eq('student_id', student.id).maybeSingle();
  const stats = statRow as GameStat | null;

  // My attendance
  const { data: attRow } = await supabase
    .from('attendance').select('*').eq('activity_id', game.id).eq('student_id', student.id).maybeSingle();
  const attendance = attRow as Attendance | null;

  // Roster size
  const { count: rosterCount } = await supabase
    .from('activity_students').select('*', { count: 'exact', head: true }).eq('activity_id', game.id);

  const date = new Date(game.occurred_on + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const hasScore = game.our_score !== null && game.opp_score !== null;
  const won = hasScore && (game.our_score ?? 0) > (game.opp_score ?? 0);
  const lost = hasScore && (game.our_score ?? 0) < (game.opp_score ?? 0);
  const isGoalie = student.position === 'G';

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/my-games" className="hover:text-ink">My games</Link>
            <span className="mx-2">&middot;</span>
            Game
          </>
        }
        title={
          <>
            <em className="italic">
              {game.home_away === 'away' ? '@ ' : 'vs '}{game.opponent ?? 'TBD'}
            </em>
          </>
        }
        description={[
          date,
          game.starts_at ? game.starts_at.slice(0, 5) : null,
          game.venue ? game.venue : null,
        ].filter(Boolean).join(' \u00b7 ')}
      />

      {hasScore && (
        <div className={`card-base p-5 mb-6 flex items-center justify-between border-2 ${
          won ? 'border-sage/40' : lost ? 'border-crimson/40' : 'border-sand-200'
        }`}>
          <div className="kicker">{won ? 'Win' : lost ? 'Loss' : 'Tie'}</div>
          <div className="font-serif text-3xl text-ink">
            {game.our_score} <span className="text-ink-faint mx-2">&ndash;</span> {game.opp_score}
          </div>
        </div>
      )}

      {/* Phase 14: Reviewed-with-player banner (read-only for student) */}
      {game.reviewed_with_player && (
        <div className="card-base p-3 mb-6 flex items-center gap-3 border border-sage/30 bg-sage/5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sage-dark flex-shrink-0">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <div className="text-sm text-ink">
            <span className="font-medium">Reviewed with your coach</span>
            {game.reviewed_at && (
              <span className="text-ink-faint text-xs ml-2">
                &middot; {new Date(game.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-6">
          <section>
            <div className="kicker mb-3">My stats</div>
            {!stats ? (
              <div className="card-base p-6 text-center text-sm text-ink-dim">
                {game.occurred_on > new Date().toISOString().slice(0, 10)
                  ? 'Stats appear after the game.'
                  : 'No stats recorded yet.'}
              </div>
            ) : isGoalie ? (
              <div className="card-base p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCell label="Saves" value={stats.saves} />
                <StatCell label="Shots Against" value={stats.shots_against} />
                <StatCell label="Goals Against" value={stats.goals_against} />
                <StatCell label="Save %"
                  value={stats.shots_against && stats.shots_against > 0 && stats.saves !== null
                    ? ((stats.saves / stats.shots_against) * 100).toFixed(1)
                    : null}
                />
              </div>
            ) : (
              <div className="card-base p-5 grid grid-cols-3 md:grid-cols-6 gap-4">
                <StatCell label="G" value={stats.goals} />
                <StatCell label="A" value={stats.assists} />
                <StatCell label={<>+/&minus;</>} value={stats.plus_minus} signed />
                <StatCell label="Shots" value={stats.shots} />
                <StatCell label="PIM" value={stats.penalty_mins} />
                <StatCell label="TOI" value={stats.time_on_ice} string />
              </div>
            )}
            {stats?.notes && (
              <div className="mt-3 text-sm text-ink-dim p-3 card-base">
                <div className="kicker text-[9px] mb-1">Coach notes</div>
                {stats.notes}
              </div>
            )}
            {/* Phase 14: split performance notes */}
            <BulletNotesDisplay
              positive={stats?.positive_notes}
              improvement={stats?.improvement_notes}
            />
          </section>

          {game.notes && (
            <section>
              <div className="kicker mb-2">Coach notes</div>
              <div className="card-base p-4 text-sm text-ink whitespace-pre-wrap">{game.notes}</div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <section>
            <div className="kicker mb-2">My attendance</div>
            <AttendanceCard attendance={attendance} occurredOn={game.occurred_on} />
          </section>

          <section>
            <div className="kicker mb-2">Roster</div>
            <div className="card-base p-4 text-sm text-ink-dim">
              {rosterCount ?? 0} player{rosterCount === 1 ? '' : 's'} scheduled
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function StatCell({ label, value, signed, string }: {
  label: React.ReactNode; value: number | string | null | undefined;
  signed?: boolean; string?: boolean;
}) {
  let display: React.ReactNode;
  if (value === null || value === undefined) {
    display = <span className="text-ink-faint">&mdash;</span>;
  } else if (string) {
    display = String(value);
  } else if (signed && typeof value === 'number' && value > 0) {
    display = `+${value}`;
  } else {
    display = String(value);
  }
  return (
    <div className="text-center">
      <div className="kicker text-[9px] mb-1">{label}</div>
      <div className="font-mono text-lg text-ink">{display}</div>
    </div>
  );
}

function BulletNotesDisplay({ positive, improvement }: {
  positive: string[] | null | undefined;
  improvement: string[] | null | undefined;
}) {
  const hasPositive = positive && positive.length > 0;
  const hasImprovement = improvement && improvement.length > 0;
  if (!hasPositive && !hasImprovement) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
      {hasPositive && (
        <div className="rounded-lg border border-sage/30 bg-sage/5 p-3">
          <div className="kicker text-[9px] mb-2">Positive performance</div>
          <ul className="text-sm text-ink flex flex-col gap-1.5">
            {positive!.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-sage-dark mt-1.5" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {hasImprovement && (
        <div className="rounded-lg border border-crimson/20 bg-crimson/5 p-3">
          <div className="kicker text-[9px] mb-2">Opportunities for improvement</div>
          <ul className="text-sm text-ink flex flex-col gap-1.5">
            {improvement!.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-crimson mt-1.5" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AttendanceCard({ attendance, occurredOn }: { attendance: Attendance | null; occurredOn: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const isPast = occurredOn < today;

  if (!attendance || attendance.attended === null) {
    return (
      <div className="card-base p-4 text-sm text-ink-dim">
        {isPast ? 'No attendance recorded.' : 'Not yet recorded \u2014 game hasn\u2019t happened yet.'}
      </div>
    );
  }

  const styles = attendance.attended
    ? 'bg-sage/10 text-sage-dark border-sage/30'
    : 'bg-crimson/5 text-crimson border-crimson/30';

  return (
    <div className={`card-base p-4 border ${styles}`}>
      <div className="font-medium">{attendance.attended ? 'Present' : 'Absent'}</div>
    </div>
  );
}
