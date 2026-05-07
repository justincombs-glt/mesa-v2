import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { SeasonsClient } from './SeasonsClient';
import type { Season, GoalPlan } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface SeasonRow extends Season {
  plan_count: number;
  activity_count: number;
  draft_or_active_plan_count: number;
  open_review_count: number;
  enrollment_count: number;
}

export default async function SeasonsPage() {
  await requireRole('admin', 'director');
  const supabase = createClient();

  const { data: seasonRows } = await supabase.from('seasons').select('*').order('starts_on', { ascending: false });
  const seasons = (seasonRows ?? []) as Season[];

  const rows: SeasonRow[] = [];
  for (const s of seasons) {
    const [{ data: plans }, { data: acts }, { data: enrolls }] = await Promise.all([
      supabase.from('goal_plans').select('id, status').eq('season_id', s.id),
      supabase.from('activities').select('id').eq('season_id', s.id),
      supabase.from('season_enrollments').select('id').eq('season_id', s.id).is('departed_on', null),
    ]);

    const planList = (plans ?? []) as Array<Pick<GoalPlan, 'id' | 'status'>>;
    const draftOrActive = planList.filter((p) => p.status === 'draft' || p.status === 'active').length;

    let openReviews = 0;
    if (planList.length > 0) {
      const { data: reviewRows } = await supabase
        .from('reviews').select('id')
        .in('plan_id', planList.map((p) => p.id))
        .is('completed_at', null);
      openReviews = reviewRows?.length ?? 0;
    }

    rows.push({
      ...s,
      plan_count: planList.length,
      activity_count: (acts ?? []).length,
      draft_or_active_plan_count: draftOrActive,
      open_review_count: openReviews,
      enrollment_count: (enrolls ?? []).length,
    });
  }

  return (
    <>
      <PageHeader
        kicker="Admin · Seasons"
        title={<>Academy <em className="italic text-crimson">seasons</em>.</>}
        description="Each season is a discrete period with its own students, goal plans, activities, and results. Archive a season to preserve its data as read-only history."
        actions={<SeasonsClient seasons={[]} addOnly />}
      />
      <SeasonsClient seasons={rows} />
    </>
  );
}
