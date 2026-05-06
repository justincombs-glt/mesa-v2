import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { getLinkedStudentForProfile } from '@/lib/student-dashboard';
import type { Activity, GameStat, Attendance } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function MyGameDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireRole('student');
  const supabase = createClient();

  const student = await getLinkedStudentForProfile(profile.id);
  if (!student) {
    return (
      <>
        <PageHeader kicker="Student" title="Game" description="Couldn't load." />
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim">Your account isn&apos;t linked to a student record yet.</p>
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
