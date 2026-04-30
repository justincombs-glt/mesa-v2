import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { PlanDetailClient } from './PlanDetailClient';
import type {
  GoalPlan, GoalPlanGoal, GoalPlanComposite,
  Student, Review, PerformanceTest, GoalTemplate,
  CompositePerformanceTest, CompositePerformanceTestItem,
  CPTSession, PerformanceTestResult,
} from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface AttachedComposite {
  link: GoalPlanComposite;
  composite: CompositePerformanceTest;
  subTests: Array<{
    test: PerformanceTest;
    sequence: number;
  }>;
  sessions: Array<{
    session: CPTSession;
    results: Map<string, number>; // test_id -> value
  }>;
  baselineSessionId: string | null;
}

export default async function PlanDetailPage({ params }: { params: { planId: string } }) {
  await requireRole('admin', 'director');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();

  const { data: planRow } = await supabase.from('goal_plans').select('*').eq('id', params.planId).single();
  if (!planRow) notFound();
  const plan = planRow as GoalPlan;

  // Student
  const { data: studentRow } = await supabase
    .from('students').select('id, full_name, jersey_number, position').eq('id', plan.student_id).single();
  const student = studentRow
    ? (studentRow as unknown as Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position'>)
    : null;

  // Goals
  const { data: goalRows } = await supabase
    .from('goal_plan_goals').select('*').eq('plan_id', plan.id).order('sequence');
  const goals = (goalRows ?? []) as GoalPlanGoal[];

  // Attached composite tests
  const { data: compLinkRows } = await supabase
    .from('goal_plan_composites').select('*').eq('plan_id', plan.id);
  const compLinks = (compLinkRows ?? []) as GoalPlanComposite[];

  let attachedComposites: AttachedComposite[] = [];
  if (compLinks.length > 0) {
    const compIds = compLinks.map((l) => l.composite_id);

    const [{ data: compRows }, { data: compItemRows }] = await Promise.all([
      supabase.from('composite_performance_tests').select('*').in('id', compIds),
      supabase.from('composite_performance_test_items').select('*').in('composite_id', compIds).order('sequence'),
    ]);
    const composites = (compRows ?? []) as CompositePerformanceTest[];
    const compItems = (compItemRows ?? []) as CompositePerformanceTestItem[];

    // Get all individual tests involved
    const testIds = [...new Set(compItems.map((i) => i.test_id))];
    const { data: testRows } = testIds.length > 0
      ? await supabase.from('performance_tests').select('*').in('id', testIds)
      : { data: [] };
    const testMap = new Map(((testRows ?? []) as PerformanceTest[]).map((t) => [t.id, t]));

    // Get sessions for these composites (scoped to current season + this student)
    const seasonId = seasonCtx.selected?.id;
    let sessionQuery = supabase
      .from('cpt_sessions').select('*').in('composite_id', compIds).order('session_date');
    if (seasonId) {
      sessionQuery = sessionQuery.eq('season_id', seasonId);
    }
    const { data: sessionRows } = await sessionQuery;
    const sessions = (sessionRows ?? []) as CPTSession[];

    // Get results for these sessions and this student
    let results: PerformanceTestResult[] = [];
    if (sessions.length > 0) {
      const sessionIds = sessions.map((s) => s.id);
      const { data: resultRows } = await supabase
        .from('performance_test_results').select('*')
        .in('cpt_session_id', sessionIds)
        .eq('student_id', plan.student_id);
      results = (resultRows ?? []) as PerformanceTestResult[];
    }

    // Assemble per-composite view
    attachedComposites = compLinks.map((link) => {
      const comp = composites.find((c) => c.id === link.composite_id);
      const items = compItems.filter((i) => i.composite_id === link.composite_id);
      const subTests = items
        .map((i) => ({ test: testMap.get(i.test_id), sequence: i.sequence }))
        .filter((x): x is { test: PerformanceTest; sequence: number } => !!x.test);
      const compSessions = sessions.filter((s) => s.composite_id === link.composite_id);

      // Build results map per session
      const sessionViews = compSessions.map((s) => {
        const resultsMap = new Map<string, number>();
        results.filter((r) => r.cpt_session_id === s.id).forEach((r) => {
          resultsMap.set(r.test_id, r.value);
        });
        return { session: s, results: resultsMap };
      });

      // Baseline: explicitly-flagged session, else earliest session
      let baselineSessionId: string | null = null;
      const flagged = compSessions.find((s) => s.is_baseline);
      if (flagged) {
        baselineSessionId = flagged.id;
      } else if (compSessions.length > 0) {
        baselineSessionId = compSessions[0].id;
      }

      return {
        link,
        composite: comp ?? {
          id: link.composite_id, title: '(deleted composite)',
          description: null, active: false, created_by: null, created_at: '',
        },
        subTests,
        sessions: sessionViews,
        baselineSessionId,
      };
    });
  }

  // Available composites for attaching
  const attachedCompIds = new Set(compLinks.map((l) => l.composite_id));
  const { data: allCompRows } = await supabase
    .from('composite_performance_tests').select('*').eq('active', true).order('title');
  const availableComposites = ((allCompRows ?? []) as CompositePerformanceTest[]).filter((c) => !attachedCompIds.has(c.id));

  // Reviews
  const { data: reviewRows } = await supabase
    .from('reviews').select('*').eq('plan_id', plan.id).order('created_at', { ascending: false });
  const reviews = (reviewRows ?? []) as Review[];

  // Goal templates for picker
  const { data: templateRows } = await supabase
    .from('goal_templates').select('*').eq('active', true).order('title');
  const templates = (templateRows ?? []) as GoalTemplate[];

  // Performance tests for goal-test linkage picker (Phase 7a)
  const { data: testRows } = await supabase
    .from('performance_tests').select('*').eq('active', true).order('title');
  const tests = (testRows ?? []) as PerformanceTest[];

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/goal-management" className="hover:text-ink">Goal Management</Link>
            <span className="mx-2">·</span>
            {student ? (
              <Link href={`/dashboard/students/${student.id}`} className="hover:text-ink">
                {student.jersey_number ? `#${student.jersey_number} ` : ''}{student.full_name}
              </Link>
            ) : '(student)'}
          </>
        }
        title={<em className="italic">{plan.title}</em>}
        description={plan.starts_on && plan.ends_on
          ? `Plan period: ${formatDate(plan.starts_on)} → ${formatDate(plan.ends_on)}`
          : undefined}
      />

      <PlanDetailClient
        plan={plan}
        goals={goals}
        attachedComposites={attachedComposites}
        availableComposites={availableComposites}
        reviews={reviews}
        templates={templates}
        tests={tests}
        readOnly={seasonCtx.isArchived}
      />
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
