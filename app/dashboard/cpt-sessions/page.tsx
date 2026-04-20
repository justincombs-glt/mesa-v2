import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { CptSessionsClient } from './CptSessionsClient';
import type { CPTSession, CompositePerformanceTest } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface CptSessionRow extends CPTSession {
  composite_title: string;
  results_count: number;
}

export default async function CptSessionsPage() {
  await requireRole('admin', 'director', 'trainer');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();
  const seasonId = seasonCtx.selected?.id;

  let sessionsQuery = supabase.from('cpt_sessions').select('*')
    .order('session_date', { ascending: false })
    .limit(200);
  if (seasonId) {
    sessionsQuery = sessionsQuery.eq('season_id', seasonId);
  }

  const [{ data: sessionRows }, { data: compRows }] = await Promise.all([
    sessionsQuery,
    supabase.from('composite_performance_tests').select('id, title, description, active').eq('active', true).order('title'),
  ]);

  const sessions = (sessionRows ?? []) as CPTSession[];
  const composites = (compRows ?? []) as Array<Pick<CompositePerformanceTest, 'id' | 'title' | 'description' | 'active'>>;
  const compTitleById = new Map(composites.map((c) => [c.id, c.title]));

  // Count results per session
  const resultsCount = new Map<string, number>();
  if (sessions.length > 0) {
    const { data: resultRows } = await supabase
      .from('performance_test_results').select('cpt_session_id')
      .in('cpt_session_id', sessions.map((s) => s.id));
    ((resultRows ?? []) as Array<{ cpt_session_id: string | null }>).forEach((r) => {
      if (r.cpt_session_id) {
        resultsCount.set(r.cpt_session_id, (resultsCount.get(r.cpt_session_id) ?? 0) + 1);
      }
    });
  }

  const rows: CptSessionRow[] = sessions.map((s) => ({
    ...s,
    composite_title: compTitleById.get(s.composite_id) ?? '(Unknown composite)',
    results_count: resultsCount.get(s.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        kicker={seasonCtx.selected ? `Trainer · CPT Sessions · ${seasonCtx.selected.name}` : 'Trainer · CPT Sessions'}
        title={<><em className="italic text-crimson">Composite</em> testing.</>}
        description="Record composite performance test sessions — vertical jump, sprint, agility, strength — all at once. Mark one session per composite as the season baseline; subsequent sessions track progress."
        actions={
          <CptSessionsClient
            sessions={[]}
            composites={composites}
            seasonId={seasonId ?? null}
            seasonArchived={seasonCtx.isArchived}
            addOnly
          />
        }
      />
      <CptSessionsClient
        sessions={rows}
        composites={composites}
        seasonId={seasonId ?? null}
        seasonArchived={seasonCtx.isArchived}
      />
    </>
  );
}
