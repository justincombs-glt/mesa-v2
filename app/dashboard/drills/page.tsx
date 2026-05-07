import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { DrillsClient } from './DrillsClient';
import type { Drill } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function DrillsPage() {
  await requireRole('admin', 'director', 'coach');
  const supabase = createClient();
  const { data } = await supabase.from('drills').select('*').eq('active', true).order('title');
  const drills = (data ?? []) as Drill[];

  return (
    <>
      <PageHeader
        kicker="Admin · Drills"
        title={<>On-ice <em className="italic text-crimson">drill library</em>.</>}
        description="Canonical drill collection. Reusable across practice plans."
        actions={<DrillsClient drills={[]} addOnly />}
      />
      <DrillsClient drills={drills} />
    </>
  );
}
