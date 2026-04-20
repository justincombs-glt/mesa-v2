import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActivitiesClient } from './ActivitiesClient';
import type { Activity, Student } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface GameRow extends Activity {
  roster_count: number;
  stats_recorded: number;
}

export default async function ActivitiesPage() {
  await requireRole('admin', 'director', 'coach');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();
  const seasonId = seasonCtx.selected?.id;

  // Only games (activity_type = 'game'), scoped to current season
  let gamesQuery = supabase.from('activities').select('*')
    .eq('activity_type', 'game')
    .order('occurred_on', { ascending: false })
    .limit(200);
  if (seasonId) {
    gamesQuery = gamesQuery.eq('season_id', seasonId);
  }

  const [{ data: gameRows }, { data: studentRows }] = await Promise.all([
    gamesQuery,
    supabase.from('students').select('id, full_name, jersey_number, position, active').eq('active', true).order('full_name'),
  ]);

  const games = (gameRows ?? []) as Activity[];
  const students = (studentRows ?? []) as Array<Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position' | 'active'>>;

  // Count roster + stats per game
  const gameIds = games.map((g) => g.id);
  const rosterCounts = new Map<string, number>();
  const statsCounts = new Map<string, number>();
  if (gameIds.length > 0) {
    const [{ data: rosterRows }, { data: statRows }] = await Promise.all([
      supabase.from('activity_students').select('activity_id').in('activity_id', gameIds),
      supabase.from('game_stats').select('activity_id').in('activity_id', gameIds),
    ]);
    ((rosterRows ?? []) as Array<{ activity_id: string }>).forEach((r) => {
      rosterCounts.set(r.activity_id, (rosterCounts.get(r.activity_id) ?? 0) + 1);
    });
    ((statRows ?? []) as Array<{ activity_id: string }>).forEach((s) => {
      statsCounts.set(s.activity_id, (statsCounts.get(s.activity_id) ?? 0) + 1);
    });
  }

  const rows: GameRow[] = games.map((g) => ({
    ...g,
    roster_count: rosterCounts.get(g.id) ?? 0,
    stats_recorded: statsCounts.get(g.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        kicker={seasonCtx.selected ? `Coach · Activities · ${seasonCtx.selected.name}` : 'Coach · Activities'}
        title={<><em className="italic text-crimson">Games</em> logged.</>}
        description="Log games with opponent, score, and per-player stats. Goalie stats tracked separately."
        actions={<ActivitiesClient games={[]} seasonId={seasonId ?? null} seasonArchived={seasonCtx.isArchived} addOnly />}
      />
      <ActivitiesClient games={rows} seasonId={seasonId ?? null} seasonArchived={seasonCtx.isArchived} />
    </>
  );
}
