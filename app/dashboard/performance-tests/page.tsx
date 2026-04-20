import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { PerformanceTestsClient } from './PerformanceTestsClient';
import type { PerformanceTest } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function PerformanceTestsPage() {
  await requireRole('admin', 'director');
  const supabase = createClient();
  const { data } = await supabase.from('performance_tests').select('*').eq('active', true).order('title');
  const tests = (data ?? []) as PerformanceTest[];

  return (
    <>
      <PageHeader
        kicker="Admin · Performance Tests"
        title={<>Standardized <em className="italic text-crimson">performance tests</em>.</>}
        description="Define the tests the academy administers — 40-yard dash, vertical jump, 1RM squat, skate laps. Directors attach tests to goal plans; results are tracked over time."
        actions={<PerformanceTestsClient tests={[]} addOnly />}
      />
      <PerformanceTestsClient tests={tests} />
    </>
  );
}
