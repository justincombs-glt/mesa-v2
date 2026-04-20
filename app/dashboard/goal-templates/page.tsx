import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { GoalTemplatesClient } from './GoalTemplatesClient';
import type { GoalTemplate } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function GoalTemplatesPage() {
  await requireRole('admin', 'director');
  const supabase = createClient();
  const { data } = await supabase.from('goal_templates').select('*').eq('active', true).order('title');
  const templates = (data ?? []) as GoalTemplate[];

  return (
    <>
      <PageHeader
        kicker="Admin · Goal Templates"
        title={<>Goal <em className="italic text-crimson">template library</em>.</>}
        description="Reusable goal examples. The director picks from these when building a student's goal management plan."
        actions={<GoalTemplatesClient templates={[]} addOnly />}
      />
      <GoalTemplatesClient templates={templates} />
    </>
  );
}
