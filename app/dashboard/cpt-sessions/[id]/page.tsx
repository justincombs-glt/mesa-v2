import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { CptSessionDetailClient } from './CptSessionDetailClient';
import type {
  CPTSession, CompositePerformanceTest, CompositePerformanceTestItem,
  PerformanceTest, PerformanceTestResult, Student, SeasonEnrollment,
} from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface TestColumn {
  id: string;                         // performance_test id
  title: string;
  unit: string | null;
  direction: 'higher_is_better' | 'lower_is_better';
  sequence: number;
}

export interface ResultCell {
  value: number;
}

export interface SessionData {
  session: CPTSession;
  composite: CompositePerformanceTest;
  tests: TestColumn[];
  students: Array<Pick<Student, 'id' | 'full_name' | 'jersey_number'>>;
  // Map keyed by `${student_id}:${test_id}` -> cell
  resultMap: Record<string, ResultCell>;
}

export default async function CptSessionDetailPage({ params }: { params: { id: string } }) {
  await requireRole('admin', 'director', 'trainer');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();

  const { data: sessRow } = await supabase
    .from('cpt_sessions').select('*').eq('id', params.id).single();
  if (!sessRow) notFound();
  const session = sessRow as CPTSession;

  // Composite
  const { data: compRow } = await supabase
    .from('composite_performance_tests').select('*').eq('id', session.composite_id).single();
  if (!compRow) notFound();
  const composite = compRow as CompositePerformanceTest;

  // Composite items = ordered tests
  const { data: itemRows } = await supabase
    .from('composite_performance_test_items')
    .select('test_id, sequence')
    .eq('composite_id', composite.id)
    .order('sequence');
  const items = (itemRows ?? []) as Array<Pick<CompositePerformanceTestItem, 'test_id' | 'sequence'>>;
  const testIds = items.map((i) => i.test_id);

  let tests: TestColumn[] = [];
  if (testIds.length > 0) {
    const { data: testRows } = await supabase
      .from('performance_tests')
      .select('id, title, unit, direction')
      .in('id', testIds);
    const testById = new Map<string, Pick<PerformanceTest, 'id' | 'title' | 'unit' | 'direction'>>();
    ((testRows ?? []) as Array<Pick<PerformanceTest, 'id' | 'title' | 'unit' | 'direction'>>).forEach((t) => {
      testById.set(t.id, t);
    });
    tests = items.flatMap((i) => {
      const t = testById.get(i.test_id);
      return t ? [{ id: t.id, title: t.title, unit: t.unit, direction: t.direction, sequence: i.sequence }] : [];
    });
  }

  // Students: current-season-enrolled (active not departed)
  let students: Array<Pick<Student, 'id' | 'full_name' | 'jersey_number'>> = [];
  if (session.season_id) {
    const { data: enrollRows } = await supabase
      .from('season_enrollments').select('student_id')
      .eq('season_id', session.season_id).is('departed_on', null);
    const enrolledIds = ((enrollRows ?? []) as Array<Pick<SeasonEnrollment, 'student_id'>>).map((e) => e.student_id);
    if (enrolledIds.length > 0) {
      const { data: studentRows } = await supabase
        .from('students').select('id, full_name, jersey_number')
        .in('id', enrolledIds).eq('active', true).order('full_name');
      students = (studentRows ?? []) as Array<Pick<Student, 'id' | 'full_name' | 'jersey_number'>>;
    }
  }

  // Existing results for this session
  const { data: resultRows } = await supabase
    .from('performance_test_results')
    .select('student_id, test_id, value')
    .eq('cpt_session_id', session.id);
  const results = (resultRows ?? []) as Array<Pick<PerformanceTestResult, 'student_id' | 'test_id' | 'value'>>;

  const resultMap: Record<string, ResultCell> = {};
  results.forEach((r) => {
    resultMap[`${r.student_id}:${r.test_id}`] = { value: r.value };
  });

  const data: SessionData = { session, composite, tests, students, resultMap };

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/cpt-sessions" className="hover:text-ink">CPT Sessions</Link>
            <span className="mx-2">·</span>
            Session
          </>
        }
        title={
          <>
            <em className="italic">{composite.title}</em>
            {session.is_baseline && (
              <span className="ml-3 inline-block text-[10px] font-mono tracking-[0.15em] uppercase px-2 py-0.5 align-middle rounded bg-sage text-paper">
                Baseline
              </span>
            )}
          </>
        }
        description={formatSessionHeader(session)}
      />

      <CptSessionDetailClient data={data} readOnly={seasonCtx.isArchived} />
    </>
  );
}

function formatSessionHeader(s: CPTSession): string {
  const parts: string[] = [];
  parts.push(new Date(s.session_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }));
  if (s.conditions_notes) parts.push(s.conditions_notes);
  return parts.join(' · ');
}
