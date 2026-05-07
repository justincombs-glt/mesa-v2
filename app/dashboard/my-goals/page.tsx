import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSeasonContext } from '@/lib/season';
import { PageHeader } from '@/components/ui/PageHeader';
import { getLinkedStudentForProfile } from '@/lib/student-dashboard';
import type { GoalPlan } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function MyGoalsPage() {
  const profile = await requireRole('student');
  const supabase = createClient();
  const seasonCtx = await getSeasonContext();
  const seasonId = seasonCtx.selected?.id;

  const student = await getLinkedStudentForProfile(profile.id);
  if (!student) {
    return (
      <>
        <PageHeader
          kicker="My Goals"
          title={<><em className="italic text-crimson">No</em> student link.</>}
          description="Your account isn't linked to a student record yet. Ask the academy to link them."
        />
      </>
    );
  }

  let q = supabase.from('goal_plans').select('*').eq('student_id', student.id)
    .order('created_at', { ascending: false });
  if (seasonId) q = q.eq('season_id', seasonId);
  const { data: planRows } = await q;
  const plans = (planRows ?? []) as GoalPlan[];

  // Goal counts
  const planIds = plans.map((p) => p.id);
  const goalCounts = new Map<string, number>();
  if (planIds.length > 0) {
    const { data: goalRows } = await supabase
      .from('goal_plan_goals').select('plan_id').in('plan_id', planIds);
    ((goalRows ?? []) as Array<{ plan_id: string }>).forEach((g) => {
      goalCounts.set(g.plan_id, (goalCounts.get(g.plan_id) ?? 0) + 1);
    });
  }

  return (
    <>
      <PageHeader
        kicker={seasonCtx.selected ? `My Goals · ${seasonCtx.selected.name}` : 'My Goals'}
        title={<><em className="italic text-crimson">Your</em> goal plans.</>}
        description="Your goal plans for the current season. Tap one to see all goals, attached tests, and reviews."
      />
      {plans.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            No goal plans {seasonCtx.selected ? `for ${seasonCtx.selected.name} ` : ''}yet. Your director will create a plan with you during your next goal-setting session.
          </p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {plans.map((p, idx) => (
            <Link key={p.id} href={`/dashboard/my-goals/${p.id}`}
              className={`flex items-center gap-4 px-5 py-4 group ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink group-hover:text-crimson transition-colors">{p.title}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
                  {p.status} · {goalCounts.get(p.id) ?? 0} goal{(goalCounts.get(p.id) ?? 0) === 1 ? '' : 's'}
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint group-hover:text-ink">
                Open →
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
