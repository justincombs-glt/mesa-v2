import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { PlanDetailClient } from '@/app/dashboard/goal-management/[planId]/PlanDetailClient';
import { getLinkedStudentForProfile } from '@/lib/student-dashboard';
import type {
  GoalPlan, GoalPlanGoal, GoalPlanComposite,
  Review, PerformanceTest, GoalTemplate,
  CompositePerformanceTest, CompositePerformanceTestItem,
  CPTSession, PerformanceTestResult,
} from '@/lib/supabase/types';
import type { AttachedComposite } from '@/app/dashboard/goal-management/[planId]/page';

export const dynamic = 'force-dynamic';

export default async function MyPlanDetailPage({ params }: { params: { planId: string } }) {
  const profile = await requireRole('student');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();

  const student = await getLinkedStudentForProfile(profile.id);
  if (!student) notFound();

  const { data: planRow } = await supabase.from('goal_plans').select('*').eq('id', params.planId).single();
  if (!planRow) notFound();
  const plan = planRow as GoalPlan;

  // Authorization: plan must belong to the student
  if (plan.student_id !== student.id) notFound();

  // Goals
  const { data: goalRows } = await supabase
    .from('goal_plan_goals').select('*').eq('plan_id', plan.id).order('sequence');
  const goals = (goalRows ?? []) as GoalPlanGoal[];

  // Attached composite tests (same logic as admin path)
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

    const testIds = [...new Set(compItems.map((i) => i.test_id))];
    const { data: testRows } = testIds.length > 0
      ? await supabase.from('performance_tests').select('*').in('id', testIds)
      : { data: [] };
    const testMap = new Map(((testRows ?? []) as PerformanceTest[]).map((t) => [t.id, t]));

    const seasonId = seasonCtx.selected?.id;
    let sessionQuery = supabase
      .from('cpt_sessions').select('*').in('composite_id', compIds).order('session_date');
    if (seasonId) sessionQuery = sessionQuery.eq('season_id', seasonId);
    const { data: sessionRows } = await sessionQuery;
    const sessions = (sessionRows ?? []) as CPTSession[];

    let results: PerformanceTestResult[] = [];
    if (sessions.length > 0) {
      const sessionIds = sessions.map((s) => s.id);
      const { data: resultRows } = await supabase
        .from('performance_test_results').select('*')
        .in('cpt_session_id', sessionIds)
        .eq('student_id', plan.student_id);
      results = (resultRows ?? []) as PerformanceTestResult[];
    }

    attachedComposites = compLinks.map((link) => {
      const comp = composites.find((c) => c.id === link.composite_id);
      const items = compItems.filter((i) => i.composite_id === link.composite_id);
      const subTests = items
        .map((i) => ({ test: testMap.get(i.test_id), sequence: i.sequence }))
        .filter((x): x is { test: PerformanceTest; sequence: number } => !!x.test);
      const compSessions = sessions.filter((s) => s.composite_id === link.composite_id);

      const sessionViews = compSessions.map((s) => {
        const resultsMap = new Map<string, number>();
        results.filter((r) => r.cpt_session_id === s.id).forEach((r) => {
          resultsMap.set(r.test_id, r.value);
        });
        return { session: s, results: resultsMap };
      });

      let baselineSessionId: string | null = null;
      const flagged = compSessions.find((s) => s.is_baseline);
      if (flagged) baselineSessionId = flagged.id;
      else if (compSessions.length > 0) baselineSessionId = compSessions[0].id;

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

  // Reviews
  const { data: reviewRows } = await supabase
    .from('reviews').select('*').eq('plan_id', plan.id).order('created_at', { ascending: false });
  const reviews = (reviewRows ?? []) as Review[];

  // Templates not used in read-only mode, but client expects the prop
  const templates: GoalTemplate[] = [];

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/dashboard/my-goals" className="hover:text-ink">My Goals</Link>
            <span className="mx-2">·</span>
            {seasonCtx.selected?.name ?? 'Current season'}
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
        availableComposites={[]}
        reviews={reviews}
        templates={templates}
        tests={[]}
        readOnly={true}
      />
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
