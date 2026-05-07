import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { PracticePlansClient } from './PracticePlansClient';
import type { PracticePlan, PracticePlanItem } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface PracticePlanRow extends PracticePlan {
  drill_count: number;
  skill_count: number;
}

export default async function PracticePlansPage() {
  await requireRole('admin', 'director', 'coach');
  const supabase = createClient();

  const { data: planRows } = await supabase
    .from('practice_plans').select('*').eq('is_template', true).order('title');
  const plans = (planRows ?? []) as PracticePlan[];

  const counts = new Map<string, { drill: number; skill: number }>();
  if (plans.length > 0) {
    const { data: itemRows } = await supabase
      .from('practice_plan_items').select('plan_id, item_type').in('plan_id', plans.map((p) => p.id));
    ((itemRows ?? []) as Pick<PracticePlanItem, 'plan_id' | 'item_type'>[]).forEach((it) => {
      const c = counts.get(it.plan_id) ?? { drill: 0, skill: 0 };
      if (it.item_type === 'drill') c.drill += 1;
      else if (it.item_type === 'skill') c.skill += 1;
      counts.set(it.plan_id, c);
    });
  }

  const rows: PracticePlanRow[] = plans.map((p) => {
    const c = counts.get(p.id) ?? { drill: 0, skill: 0 };
    return { ...p, drill_count: c.drill, skill_count: c.skill };
  });

  return (
    <>
      <PageHeader
        kicker="Director · Practice Plans"
        title={<>Practice <em className="italic text-crimson">plan templates</em>.</>}
        description="Build reusable plans of drills and skills. Coaches use these as starting points when scheduling actual practices (Phase 4)."
        actions={<PracticePlansClient plans={[]} addOnly />}
      />
      <PracticePlansClient plans={rows} />
    </>
  );
}
