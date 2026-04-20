import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { CompositeTestsClient } from './CompositeTestsClient';
import type { CompositePerformanceTest, CompositePerformanceTestItem, PerformanceTest } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface CompositeWithItems extends CompositePerformanceTest {
  items: Array<{
    id: string;
    sequence: number;
    test: Pick<PerformanceTest, 'id' | 'title' | 'domain' | 'unit' | 'direction'>;
  }>;
}

export default async function CompositeTestsPage() {
  await requireRole('admin', 'director');
  const supabase = createClient();

  const [{ data: cptRows }, { data: itemRows }, { data: testRows }] = await Promise.all([
    supabase.from('composite_performance_tests').select('*').eq('active', true).order('title'),
    supabase.from('composite_performance_test_items').select('*').order('sequence'),
    supabase.from('performance_tests').select('id, title, domain, unit, direction').eq('active', true).order('title'),
  ]);

  const composites = (cptRows ?? []) as CompositePerformanceTest[];
  const items = (itemRows ?? []) as CompositePerformanceTestItem[];
  const tests = (testRows ?? []) as Pick<PerformanceTest, 'id' | 'title' | 'domain' | 'unit' | 'direction'>[];
  const testMap = new Map(tests.map((t) => [t.id, t]));

  const composed: CompositeWithItems[] = composites.map((c) => ({
    ...c,
    items: items
      .filter((it) => it.composite_id === c.id)
      .map((it) => ({
        id: it.id,
        sequence: it.sequence,
        test: testMap.get(it.test_id) ?? {
          id: it.test_id, title: '(deleted test)', domain: 'off_ice' as const, unit: null, direction: 'higher_is_better' as const,
        },
      })),
  }));

  return (
    <>
      <PageHeader
        kicker="Admin · Composite Performance Tests"
        title={<>Composite <em className="italic text-crimson">performance tests</em>.</>}
        description="A composite performance test (CPT) bundles several individual tests into one standard evaluation. Trainers administer them as a session — recording all the sub-test values for each student at once."
        actions={<CompositeTestsClient composites={[]} availableTests={tests} addOnly />}
      />
      <CompositeTestsClient composites={composed} availableTests={tests} />
    </>
  );
}
