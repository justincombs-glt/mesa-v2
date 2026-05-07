import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { getLinkedStudentForProfile } from '@/lib/student-dashboard';
import type { PerformanceTest, PerformanceTestResult } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function MyPerformancePage() {
  const profile = await requireRole('student');
  const supabase = createClient();

  const student = await getLinkedStudentForProfile(profile.id);
  if (!student) {
    return (
      <PageHeader
        kicker="My Performance"
        title={<><em className="italic text-crimson">No</em> student link.</>}
        description="Your account isn't linked to a student record yet. Ask the academy to link them."
      />
    );
  }

  const { data: resultRows } = await supabase
    .from('performance_test_results').select('*')
    .eq('student_id', student.id)
    .order('recorded_at', { ascending: false });
  const results = (resultRows ?? []) as PerformanceTestResult[];

  const testIds = [...new Set(results.map((r) => r.test_id))];
  let testById = new Map<string, PerformanceTest>();
  if (testIds.length > 0) {
    const { data: testRows } = await supabase
      .from('performance_tests').select('*').in('id', testIds);
    testById = new Map(((testRows ?? []) as PerformanceTest[]).map((t) => [t.id, t]));
  }

  // Group by test → list of results ordered by date desc
  const grouped = new Map<string, { test: PerformanceTest; history: PerformanceTestResult[] }>();
  results.forEach((r) => {
    const test = testById.get(r.test_id);
    if (!test) return;
    const entry = grouped.get(r.test_id) ?? { test, history: [] };
    entry.history.push(r);
    grouped.set(r.test_id, entry);
  });
  const sorted = Array.from(grouped.values()).sort((a, b) => a.test.title.localeCompare(b.test.title));

  return (
    <>
      <PageHeader
        kicker="My Performance"
        title={<><em className="italic text-crimson">Your</em> test history.</>}
        description="Every performance test you've completed — grouped by test, most recent first. Baseline results are flagged."
      />
      {sorted.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            No test results recorded yet. Once your trainer records a CPT session, your results will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {sorted.map(({ test, history }) => (
            <section key={test.id} className="card-base p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-serif text-lg text-ink">{test.title}</h3>
                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                  {history.length} result{history.length === 1 ? '' : 's'}
                  {test.unit ? ` · unit: ${test.unit}` : ''}
                  {` · ${test.direction === 'higher_is_better' ? 'higher = better' : 'lower = better'}`}
                </span>
              </div>
              <div className="overflow-hidden">
                {history.map((r, idx) => {
                  const prev = history[idx + 1];
                  let delta: string | null = null;
                  let deltaGood: boolean | null = null;
                  if (prev) {
                    const change = r.value - prev.value;
                    const pct = prev.value !== 0 ? (change / prev.value) * 100 : 0;
                    deltaGood = test.direction === 'higher_is_better' ? change > 0 : change < 0;
                    const sign = change > 0 ? '+' : '';
                    delta = `${sign}${pct.toFixed(1)}%`;
                  }
                  return (
                    <div key={r.id}
                      className={`flex items-center gap-3 py-2 ${idx > 0 ? 'border-t border-ink-hair/60' : ''}`}>
                      <div className="flex-1 text-xs text-ink-dim font-mono">
                        {formatDate(r.recorded_at)}
                        {r.is_baseline && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-sage text-paper text-[9px] uppercase tracking-wider">
                            Baseline
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-base text-ink">
                        {r.value}{test.unit ? <span className="text-ink-faint text-xs ml-1">{test.unit}</span> : null}
                      </div>
                      {delta && (
                        <div className={`font-mono text-xs w-16 text-right ${
                          deltaGood ? 'text-sage-dark' : 'text-crimson'
                        }`}>
                          {delta}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
