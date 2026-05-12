import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { buildNutritionOverview } from '@/lib/nutrition';

export const dynamic = 'force-dynamic';

export default async function NutritionOverviewPage() {
  await requireRole('trainer');
  const rows = await buildNutritionOverview();

  return (
    <>
      <PageHeader
        kicker="Trainer"
        title={<>Athlete <em className="italic text-crimson">nutrition</em>.</>}
        description="Read-only view of each athlete's daily calorie totals and goals. Tap a name to see their last 7 days."
      />

      {rows.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            No active students yet.
          </p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 border-b border-ink-hair text-[10px] font-mono tracking-wider uppercase text-ink-faint">
            <div>Athlete</div>
            <div className="text-right">Today</div>
            <div className="text-right">Goal</div>
            <div className="text-right pr-1">7-day avg</div>
          </div>
          {rows.map((row, idx) => {
            const sevenDayAvg = Math.round(
              row.last7DayTotals.reduce((s, v) => s + v, 0) / 7
            );
            return (
              <Link
                key={row.student.id}
                href={`/dashboard/nutrition-overview/${row.student.id}`}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3 ${
                  idx === 0 ? '' : 'border-t border-ink-hair'
                } hover:bg-ivory group transition-colors`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {row.student.jersey_number && (
                      <span className="text-crimson font-serif text-sm flex-shrink-0">
                        #{row.student.jersey_number}
                      </span>
                    )}
                    <span className="text-ink truncate">{row.student.full_name}</span>
                  </div>
                </div>
                <div className="text-right font-mono text-sm text-ink">
                  {row.todayTotal > 0 ? row.todayTotal.toLocaleString() : <span className="text-ink-faint">&mdash;</span>}
                </div>
                <div className="text-right font-mono text-sm text-ink-dim">
                  {row.goal !== null ? row.goal.toLocaleString() : <span className="text-ink-faint">&mdash;</span>}
                </div>
                <div className="text-right font-mono text-sm text-ink-dim pr-1">
                  {sevenDayAvg > 0 ? sevenDayAvg.toLocaleString() : <span className="text-ink-faint">&mdash;</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
