import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { PlanDetailClient } from './PlanDetailClient';
import type {
  GoalPlan, GoalPlanGoal, GoalPlanTest,
  Student, Review, PerformanceTest, GoalTemplate,
} from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export interface AttachedTest {
  link: GoalPlanTest;
  test: PerformanceTest;
  latest_value: number | null;
  latest_recorded_at: string | null;
}

export default async function PlanDetailPage({ params }: { params: { planId: string } }) {
  await requireRole('admin', 'director');
  const supabase = createClient();

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

  // Attached tests + latest result per student×test
  const { data: testLinkRows } = await supabase
    .from('goal_plan_tests').select('*').eq('plan_id', plan.id);
  const testLinks = (testLinkRows ?? []) as GoalPlanTest[];

  let attachedTests: AttachedTest[] = [];
  if (testLinks.length > 0) {
    const testIds = testLinks.map((l) => l.test_id);
    const { data: testRows } = await supabase
      .from('performance_tests').select('*').in('id', testIds);
    const testMap = new Map(((testRows ?? []) as PerformanceTest[]).map((t) => [t.id, t]));

    // Most recent result per test for this student
    const { data: resultRows } = await supabase
      .from('performance_test_results')
      .select('test_id, value, recorded_at')
      .eq('student_id', plan.student_id)
      .in('test_id', testIds)
      .order('recorded_at', { ascending: false });
    const results = (resultRows ?? []) as Array<{ test_id: string; value: number; recorded_at: string }>;

    const latestMap = new Map<string, { value: number; recorded_at: string }>();
    results.forEach((r) => {
      if (!latestMap.has(r.test_id)) {
        latestMap.set(r.test_id, { value: r.value, recorded_at: r.recorded_at });
      }
    });

    attachedTests = testLinks.map((link) => {
      const test = testMap.get(link.test_id);
      const latest = latestMap.get(link.test_id);
      return {
        link,
        test: test ?? {
          id: link.test_id, title: '(deleted test)', domain: 'off_ice',
          description: null, instructions: null, unit: null,
          direction: 'higher_is_better', active: false, created_by: null, created_at: '',
        },
        latest_value: latest?.value ?? null,
        latest_recorded_at: latest?.recorded_at ?? null,
      };
    });
  }

  // Available tests for attaching
  const attachedTestIds = new Set(testLinks.map((l) => l.test_id));
  const { data: allTestsRows } = await supabase
    .from('performance_tests').select('*').eq('active', true).order('title');
  const availableTests = ((allTestsRows ?? []) as PerformanceTest[]).filter((t) => !attachedTestIds.has(t.id));

  // Reviews
  const { data: reviewRows } = await supabase
    .from('reviews').select('*').eq('plan_id', plan.id).order('created_at', { ascending: false });
  const reviews = (reviewRows ?? []) as Review[];

  // Goal templates for picker
  const { data: templateRows } = await supabase
    .from('goal_templates').select('*').eq('active', true).order('title');
  const templates = (templateRows ?? []) as GoalTemplate[];

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
        attachedTests={attachedTests}
        availableTests={availableTests}
        reviews={reviews}
        templates={templates}
      />
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
