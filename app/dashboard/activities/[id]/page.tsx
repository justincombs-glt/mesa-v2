import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { GameDetailClient } from './GameDetailClient';
import type { Activity, Student, GameStat, SeasonEnrollment } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface RosterEntry {
  student: Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position'>;
  stats: GameStat | null;
}

export default async function GameDetailPage({ params }: { params: { id: string } }) {
  await requireRole('admin', 'director', 'coach');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();

  const { data: actRow } = await supabase.from('activities').select('*').eq('id', params.id).single();
  if (!actRow) notFound();
  const game = actRow as Activity;

  if (game.activity_type !== 'game') {
    // Not a game — redirect path could be better, but notFound is fine for Phase 4
    notFound();
  }

  // Roster
  const { data: rosterLinks } = await supabase
    .from('activity_students').select('student_id').eq('activity_id', game.id);
  const rosterIds = ((rosterLinks ?? []) as Array<{ student_id: string }>).map((l) => l.student_id);

  let rosterStudents: Array<Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position'>> = [];
  if (rosterIds.length > 0) {
    const { data: studentRows } = await supabase
      .from('students').select('id, full_name, jersey_number, position')
      .in('id', rosterIds).order('full_name');
    rosterStudents = (studentRows ?? []) as Array<Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position'>>;
  }

  // Existing stats
  const { data: statsRows } = await supabase
    .from('game_stats').select('*').eq('activity_id', game.id);
  const stats = (statsRows ?? []) as GameStat[];
  const statsByStudent = new Map(stats.map((s) => [s.student_id, s]));

  const roster: RosterEntry[] = rosterStudents.map((s) => ({
    student: s,
    stats: statsByStudent.get(s.id) ?? null,
  }));

  // Available students: ONLY those enrolled in the current season (Q4 = B)
  // And not already on the roster
  const rosterSet = new Set(rosterIds);
  let availableStudents: Array<Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position'>> = [];

  if (game.season_id) {
    const { data: enrollRows } = await supabase
      .from('season_enrollments').select('student_id')
      .eq('season_id', game.season_id).is('departed_on', null);
    const enrolledIds = ((enrollRows ?? []) as Array<Pick<SeasonEnrollment, 'student_id'>>).map((e) => e.student_id);
    const enrolledNotRostered = enrolledIds.filter((id) => !rosterSet.has(id));
    if (enrolledNotRostered.length > 0) {
      const { data: availRows } = await supabase
        .from('students').select('id, full_name, jersey_number, position')
        .in('id', enrolledNotRostered).eq('active', true).order('full_name');
      availableStudents = (availRows ?? []) as Array<Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position'>>;
    }
  }

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/activities" className="hover:text-ink">Activities</Link>
            <span className="mx-2">·</span>
            Game
          </>
        }
        title={
          <>
            <em className="italic">vs {game.opponent ?? 'TBD'}</em>
            {game.our_score !== null && game.opp_score !== null && (
              <span className="ml-4 font-mono text-2xl text-crimson">
                {game.our_score}&ndash;{game.opp_score}
              </span>
            )}
          </>
        }
        description={formatGameHeader(game)}
      />

      <GameDetailClient
        game={game}
        roster={roster}
        availableStudents={availableStudents}
        readOnly={seasonCtx.isArchived}
      />
    </>
  );
}

function formatGameHeader(g: Activity): string {
  const parts: string[] = [];
  parts.push(new Date(g.occurred_on + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
  if (g.home_away) parts.push(g.home_away === 'home' ? 'Home game' : 'Away game');
  if (g.venue) parts.push(g.venue);
  return parts.join(' · ');
}
