import Link from 'next/link';
import type { StudentDashboardData } from '@/lib/student-dashboard';

interface Props {
  data: StudentDashboardData;
  /**
   * When true, renders the dashboard in parent-viewing-child mode (read-only cues + no self-service nav links).
   */
  isParentView?: boolean;
}

export function StudentDashboardView({ data, isParentView }: Props) {
  const {
    student, seasonName, activePlans,
    upcomingActivities, recentActivities,
    latestTestResults, workoutSetsLogged, attendanceTotal,
  } = data;

  const hasAttendance = attendanceTotal.present + attendanceTotal.absent > 0;
  const attendancePct = hasAttendance
    ? Math.round((attendanceTotal.present / (attendanceTotal.present + attendanceTotal.absent)) * 100)
    : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Summary strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Active goals" value={String(activePlans.reduce((sum, p) => sum + p.goal_count, 0))} />
        <SummaryCard label="Attendance" value={attendancePct !== null ? `${attendancePct}%` : '—'}
          sub={hasAttendance ? `${attendanceTotal.present}/${attendanceTotal.present + attendanceTotal.absent}` : 'No activities yet'} />
        <SummaryCard label="Sets logged" value={String(workoutSetsLogged)} sub="All-time" />
        <SummaryCard label="Season" value={seasonName ?? '—'} />
      </section>

      {/* Goal plans */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="kicker">Goal plans</div>
          {!isParentView && (
            <Link href="/dashboard/my-goals"
              className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-ink">
              View all →
            </Link>
          )}
        </div>
        {activePlans.length === 0 ? (
          <div className="card-base p-6 text-center text-sm text-ink-dim">
            No active goal plans{seasonName ? ` for ${seasonName}` : ''}.
          </div>
        ) : (
          <div className="card-base overflow-hidden">
            {activePlans.map((p, idx) => (
              <div key={p.id}
                className={`flex items-center gap-4 px-5 py-4 ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{p.title}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
                    {p.status} · {p.goal_count} goal{p.goal_count === 1 ? '' : 's'}
                  </div>
                </div>
                {!isParentView && (
                  <Link href={`/dashboard/my-goals/${p.id}`}
                    className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson">
                    Open →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming + recent activities */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="kicker mb-3">Upcoming</div>
          {upcomingActivities.length === 0 ? (
            <div className="card-base p-6 text-center text-sm text-ink-dim">Nothing scheduled.</div>
          ) : (
            <div className="card-base overflow-hidden">
              {upcomingActivities.map((a, idx) => (
                <ActivityRow key={a.id} activity={a} first={idx === 0} />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="kicker mb-3">Recent</div>
          {recentActivities.length === 0 ? (
            <div className="card-base p-6 text-center text-sm text-ink-dim">No recent activities.</div>
          ) : (
            <div className="card-base overflow-hidden">
              {recentActivities.map((a, idx) => (
                <ActivityRow key={a.id} activity={a} first={idx === 0} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Latest test results */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="kicker">Latest test results</div>
          {!isParentView && (
            <Link href="/dashboard/my-performance"
              className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-ink">
              View all →
            </Link>
          )}
        </div>
        {latestTestResults.length === 0 ? (
          <div className="card-base p-6 text-center text-sm text-ink-dim">
            No test results recorded yet.
          </div>
        ) : (
          <div className="card-base overflow-hidden">
            {latestTestResults.map((r, idx) => (
              <div key={`${r.test_title}-${r.recorded_at}`}
                className={`flex items-center gap-4 px-5 py-3 ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink">{r.test_title}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-0.5">
                    {formatResultDate(r.recorded_at)}
                    {r.is_baseline && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-sage text-paper text-[9px]">Baseline</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-base text-ink">
                    {r.value}{r.test_unit ? <span className="text-ink-faint text-xs ml-1">{r.test_unit}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Student meta */}
      <section>
        <div className="kicker mb-3">About</div>
        <div className="card-base p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <MetaField label="Name" value={student.full_name} />
          <MetaField label="Jersey #" value={student.jersey_number ?? '—'} />
          <MetaField label="Position" value={positionLabel(student.position)} />
          <MetaField label="Hand" value={student.dominant_hand ?? '—'} />
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-base p-4">
      <div className="kicker text-[9px] mb-1.5">{label}</div>
      <div className="font-serif text-2xl text-ink leading-tight">{value}</div>
      {sub && <div className="text-[10px] font-mono text-ink-faint mt-1">{sub}</div>}
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="kicker text-[9px] mb-1">{label}</div>
      <div className="text-ink">{value ?? '—'}</div>
    </div>
  );
}

function ActivityRow({ activity, first }: { activity: import('@/lib/supabase/types').Activity; first: boolean }) {
  const typeLabel = activity.activity_type === 'game' ? 'Game'
    : activity.activity_type === 'practice' ? 'Practice'
    : 'Off-ice';
  const typeBg = activity.activity_type === 'game' ? 'bg-crimson'
    : activity.activity_type === 'practice' ? 'bg-ink'
    : 'bg-sage-dark';

  const title =
    activity.activity_type === 'game'
      ? `vs ${activity.opponent ?? 'TBD'}`
      : activity.title || (activity.activity_type === 'practice' ? 'Practice' : 'Workout');

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="flex-shrink-0 w-16 text-right">
        <div className="font-serif text-sm text-ink">{formatShortDate(activity.occurred_on)}</div>
        {activity.starts_at && (
          <div className="text-[10px] font-mono text-ink-faint mt-0.5">{activity.starts_at.slice(0, 5)}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded text-paper ${typeBg}`}>
            {typeLabel}
          </span>
          <span className="text-sm font-medium text-ink truncate">{title}</span>
        </div>
        {activity.focus && <div className="text-xs text-ink-faint truncate">{activity.focus}</div>}
      </div>
    </div>
  );
}

function positionLabel(p: string | null): string {
  if (!p) return '—';
  return p === 'F' ? 'Forward' : p === 'D' ? 'Defense' : p === 'G' ? 'Goalie' : p;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatResultDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
