import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { PracticePlanEditorClient } from './PracticePlanEditorClient';
import type { PracticePlan, PracticePlanItem, Drill } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface ResolvedItem {
  item_type: 'drill' | 'skill';
  drill?: Pick<Drill, 'id' | 'title' | 'category' | 'duration_minutes'>;
  skill_title?: string;
  duration_override?: number | null;
  coach_notes?: string | null;
  sequence: number;
}

export default async function PracticePlanDetailPage({ params }: { params: { id: string } }) {
  await requireRole('admin', 'director', 'coach');
  const supabase = createClient();

  const { data: planRow } = await supabase.from('practice_plans').select('*').eq('id', params.id).single();
  if (!planRow) notFound();
  const plan = planRow as PracticePlan;

  const { data: itemRows } = await supabase
    .from('practice_plan_items').select('*').eq('plan_id', plan.id).order('sequence');
  const items = (itemRows ?? []) as PracticePlanItem[];

  const drillIds = items.filter((i) => i.drill_id).map((i) => i.drill_id as string);
  let drillMap = new Map<string, Pick<Drill, 'id' | 'title' | 'category' | 'duration_minutes'>>();
  if (drillIds.length > 0) {
    const { data: drillRows } = await supabase
      .from('drills').select('id, title, category, duration_minutes').in('id', drillIds);
    drillMap = new Map(((drillRows ?? []) as Pick<Drill, 'id' | 'title' | 'category' | 'duration_minutes'>[]).map((d) => [d.id, d]));
  }

  const resolvedItems: ResolvedItem[] = items.map((it) => ({
    item_type: it.item_type,
    drill: it.drill_id ? drillMap.get(it.drill_id) : undefined,
    skill_title: it.skill_title ?? undefined,
    duration_override: it.duration_override,
    coach_notes: it.coach_notes,
    sequence: it.sequence,
  }));

  // Available drills for the picker
  const { data: allDrillsRow } = await supabase
    .from('drills').select('id, title, category, duration_minutes').eq('active', true).order('title');
  const availableDrills = (allDrillsRow ?? []) as Pick<Drill, 'id' | 'title' | 'category' | 'duration_minutes'>[];

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/practice-plans" className="hover:text-ink">Practice Plans</Link>
            <span className="mx-2">·</span>
            Edit
          </>
        }
        title={<em className="italic">{plan.title}</em>}
        description={plan.focus ?? undefined}
      />

      <PracticePlanEditorClient plan={plan} initialItems={resolvedItems} availableDrills={availableDrills} />
    </>
  );
}
