import Link from 'next/link';
import { Sparkline } from '@/components/insights/Sparkline';
import { SaveReviewButton } from '@/components/insights/SaveReviewButton';
import type { StudentInsights, AttendanceBreakdown, TestTrend, GoalProgressDetail } from '@/lib/student-insights';
import type { Review } from '@/lib/supabase/types';

interface Props {
  data: StudentInsights;
  reviews: Review[];
}

export function InsightsView({ data, reviews }: Props) {
  return (
    <div className="flex flex-col gap-10">
      <SummaryCards data={data} />
      <GoalsSection plans={data.plans} />
      <TestTrendsSection trends={data.testTrends} />
      <AttendanceDetailSection attendance={data.attendance} />
      <WorkoutSection workout={data.workout} seasonName={data.seasonName} />
      <PastReviewsSection insights={data} reviews={reviews} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Summary cards
// ----------------------------------------------------------------------------

function SummaryCards({ data }: { data: StudentInsights }) {
  const { attendance, workout, plans, seasonName } = data;
  const totalGoals = plans.reduce((acc, pg) => acc + pg.goals.length, 0);
  const goalsAchieved = plans.reduce(
    (acc, pg) => acc + pg.goals.filter((g) => g.status === 'achieved').length, 0,
  );

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card label="Season"
        value={seasonName ?? 'All time'}
        sub={attendance.overall_total > 0
          ? `${attendance.overall_present}/${attendance.overall_total} attended`
          : 'No tracked activities'}
      />
      <Card label="Attendance"
        value={attendance.overall_pct !== null ? `${attendance.overall_pct}%` : '—'}
        sub={attendance.overall_pct !== null ? 'In current season' : 'No data yet'}
      />
      <Card label="Goals"
        value={`${goalsAchieved}/${totalGoals}`}
        sub={totalGoals === 0 ? 'No goals yet' : `${goalsAchieved} achieved`}
      />
      <Card label="Workouts"
        value={String(workout.total_workouts_attended)}
        sub={`${workout.workouts_in_last_30_days} in last 30d`}
      />
    </section>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card-base p-4">
      <div className="kicker text-[9px] mb-1.5">{label}</div>
      <div className="font-serif text-2xl text-ink leading-tight">{value}</div>
      <div className="text-[10px] font-mono text-ink-faint mt-1">{sub}</div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Goals
// ----------------------------------------------------------------------------

function GoalsSection({ plans }: { plans: StudentInsights['plans'] }) {
  return (
    <section>
      <div className="kicker mb-3">Goal progress</div>
      {plans.length === 0 ? (
        <div className="card-base p-6 text-center text-sm text-ink-dim">
          No active goal plans for this season.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {plans.map((pg) => (
            <div key={pg.plan.id}>
              <div className="text-[11px] font-mono uppercase tracking-wider text-ink-dim mb-2">
                {pg.plan.title}
              </div>
              {pg.goals.length === 0 ? (
                <div className="card-base p-4 text-center text-xs text-ink-faint">
                  No goals defined in this plan.
                </div>
              ) : (
                <div className="card-base overflow-hidden">
                  {pg.goals.map((g, idx) => <GoalRow key={g.id} goal={g} first={idx === 0} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function GoalRow({ goal, first }: { goal: GoalProgressDetail; first: boolean }) {
  const statusColor =
    goal.status === 'achieved' ? 'bg-sage'
    : goal.status === 'abandoned' ? 'bg-ink-faint'
    : 'bg-crimson';

  return (
    <div className={`px-5 py-4 ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-ink">{goal.title}</span>
            {goal.is_auto && (
              <span className="text-[9px] font-mono tracking-wider uppercase text-sage-dark">
                auto
              </span>
            )}
            {goal.status === 'achieved' && (
              <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-sage text-paper">
                Achieved
              </span>
            )}
          </div>
          {goal.description && (
            <div className="text-xs text-ink-faint mb-2">{goal.description}</div>
          )}
          {goal.is_auto && goal.latest_value !== null && goal.baseline_value !== null && (
            <div className="text-[11px] font-mono text-ink-dim mb-2">
              Baseline {goal.baseline_value}{goal.target_unit ? ` ${goal.target_unit}` : ''}
              {' → '}
              Now {goal.latest_value}{goal.target_unit ? ` ${goal.target_unit}` : ''}
              {' · Target '}
              {goal.target_numeric}{goal.target_unit ? ` ${goal.target_unit}` : ''}
            </div>
          )}
          {!goal.is_auto && goal.target_value && (
            <div className="text-[11px] font-mono text-ink-dim mb-2">
              Target: {goal.target_value}{goal.target_unit ? ` ${goal.target_unit}` : ''}
              {goal.current_value && <> · Current: {goal.current_value}{goal.target_unit ? ` ${goal.target_unit}` : ''}</>}
            </div>
          )}
          <ProgressBar pct={goal.computed_pct} color={statusColor} />
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-serif text-2xl text-ink leading-none">{goal.computed_pct}<span className="text-sm text-ink-faint">%</span></div>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-ink-hair overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Test trends
// ----------------------------------------------------------------------------

function TestTrendsSection({ trends }: { trends: TestTrend[] }) {
  return (
    <section>
      <div className="kicker mb-3">Performance test trends</div>
      {trends.length === 0 ? (
        <div className="card-base p-6 text-center text-sm text-ink-dim">
          No test results recorded for this season yet.
        </div>
      ) : (
        <div className="card-base overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono tracking-wider uppercase text-ink-faint border-b border-ink-hair">
                <th className="text-left px-4 py-2.5 font-medium">Test</th>
                <th className="text-right px-2 py-2.5 font-medium">Baseline</th>
                <th className="text-right px-2 py-2.5 font-medium">Latest</th>
                <th className="text-right px-2 py-2.5 font-medium">Δ</th>
                <th className="text-center px-4 py-2.5 font-medium">Trend</th>
                <th className="text-right px-2 py-2.5 font-medium">N</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((t, idx) => <TestTrendRow key={t.test_id} trend={t} first={idx === 0} />)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TestTrendRow({ trend, first }: { trend: TestTrend; first: boolean }) {
  const change = trend.pct_change_from_baseline;
  const changeColor =
    change === null ? 'text-ink-faint' :
    change > 0 ? 'text-sage-dark' :
    change < 0 ? 'text-crimson' :
    'text-ink-faint';
  const changeText = change === null
    ? '—'
    : `${change > 0 ? '+' : ''}${change}%`;

  return (
    <tr className={first ? '' : 'border-t border-ink-hair'}>
      <td className="px-4 py-2.5">
        <div className="text-ink">{trend.test_title}</div>
        {trend.test_unit && (
          <div className="text-[9px] font-mono uppercase tracking-wider text-ink-faint mt-0.5">
            {trend.test_unit} · {trend.direction === 'higher_is_better' ? 'higher better' : 'lower better'}
          </div>
        )}
      </td>
      <td className="px-2 py-2.5 text-right font-mono text-ink">
        {trend.baseline ?? <span className="text-ink-faint">—</span>}
      </td>
      <td className="px-2 py-2.5 text-right font-mono text-ink">
        {trend.latest ?? <span className="text-ink-faint">—</span>}
      </td>
      <td className={`px-2 py-2.5 text-right font-mono ${changeColor}`}>
        {changeText}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-center">
          <Sparkline values={trend.results.map((r) => r.value)}
            lowerIsBetter={trend.direction === 'lower_is_better'} />
        </div>
      </td>
      <td className="px-2 py-2.5 text-right font-mono text-ink-faint text-xs">
        {trend.results.length}
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// Attendance detail
// ----------------------------------------------------------------------------

function AttendanceDetailSection({ attendance }: { attendance: AttendanceBreakdown }) {
  const { by_type, lifetime_pct, lifetime_present, lifetime_total } = attendance;

  return (
    <section>
      <div className="kicker mb-3">Attendance breakdown</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card label="Practices"
          value={by_type.practice.pct !== null ? `${by_type.practice.pct}%` : '—'}
          sub={`${by_type.practice.present}/${by_type.practice.total}`} />
        <Card label="Games"
          value={by_type.game.pct !== null ? `${by_type.game.pct}%` : '—'}
          sub={`${by_type.game.present}/${by_type.game.total}`} />
        <Card label="Off-ice"
          value={by_type.off_ice_workout.pct !== null ? `${by_type.off_ice_workout.pct}%` : '—'}
          sub={`${by_type.off_ice_workout.present}/${by_type.off_ice_workout.total}`} />
        <Card label="Lifetime"
          value={lifetime_pct !== null ? `${lifetime_pct}%` : '—'}
          sub={`${lifetime_present}/${lifetime_total}`} />
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Workout
// ----------------------------------------------------------------------------

function WorkoutSection({ workout, seasonName }: { workout: StudentInsights['workout']; seasonName: string | null }) {
  return (
    <section>
      <div className="kicker mb-3">Off-ice workouts</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card label="Workouts attended"
          value={String(workout.total_workouts_attended)}
          sub={seasonName ? `In ${seasonName}` : 'All time'} />
        <Card label="Sets logged"
          value={String(workout.total_sets_logged)}
          sub="All time across exercises" />
        <Card label="Avg RPE"
          value={workout.average_rpe !== null ? String(workout.average_rpe) : '—'}
          sub={workout.average_rpe !== null ? 'Self-reported intensity 1-10' : 'No RPE values yet'} />
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Past reviews + Save as review
// ----------------------------------------------------------------------------

function PastReviewsSection({ insights, reviews }: { insights: StudentInsights; reviews: Review[] }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="kicker">Past reviews · {reviews.length}</div>
        <SaveReviewButton insights={insights} />
      </div>
      {reviews.length === 0 ? (
        <div className="card-base p-6 text-center text-sm text-ink-dim">
          No reviews saved yet. Click <strong className="text-ink">+ Save as review</strong> to capture this snapshot as a permanent record.
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {reviews.map((r, idx) => (
            <ReviewRow key={r.id} review={r} studentId={insights.student.id} first={idx === 0} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewRow({ review, studentId, first }: { review: Review; studentId: string; first: boolean }) {
  return (
    <Link href={`/dashboard/students/${studentId}/insights/reviews/${review.id}`}
      className={`flex items-center gap-4 px-5 py-4 group ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="flex-shrink-0 w-24 text-right">
        <div className="font-serif text-sm text-ink">{formatReviewDate(review.completed_at ?? review.created_at)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          {review.finalized_at ? (
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-ink text-paper">
              Finalized
            </span>
          ) : (
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-sand-100 text-ink">
              Draft
            </span>
          )}
          <span className="text-[9px] font-mono tracking-wider uppercase text-ink-faint capitalize">
            {review.review_type.replace('_', ' ')}
          </span>
          {review.summary && (
            <span className="text-sm text-ink truncate">{review.summary}</span>
          )}
        </div>
        {review.snapshot_data ? null : (
          <div className="text-[10px] font-mono text-ink-faint">Notes only — no snapshot</div>
        )}
      </div>
      <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint group-hover:text-crimson">
        Open →
      </span>
    </Link>
  );
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
