'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ActivityType, Student, Activity } from '@/lib/supabase/types';

type StudentLite = Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'active'>;

export interface ActivityRowData extends Activity {
  student_names: string[];
}

interface Props {
  activities: ActivityRowData[];
  students: StudentLite[];
  /**
   * When true (home page mode):
   * - Defaults to "current week" filter pre-applied
   * - Hides the "Manage →" link on each row (no click-through)
   * - Adds a "View all activities" footer link to the editable surface
   * When false (performance-management mode):
   * - Defaults to no date filter (shows all in current season)
   * - Shows "Manage →" link on each row, routing to the activity's detail page
   */
  readOnly?: boolean;
  /**
   * If readOnly: the URL where "Manage activities" footer link points to.
   * Defaults to /dashboard/performance-management (director's editable workbench).
   * Coach home should pass /dashboard/practices since coach has no workbench page.
   */
  manageHref?: string;
  /**
   * Type filter dropdown options + activity type scope. Defaults to all three
   * activity types. Coach home passes ['practice', 'game'] to exclude workouts.
   * Stat cards also adjust to show only the available types.
   */
  availableTypes?: ActivityType[];
}

const TYPE_LABELS: Record<ActivityType, string> = {
  game: 'Game',
  practice: 'Practice',
  off_ice_workout: 'Off-Ice Workout',
};

const TYPE_LABELS_PLURAL: Record<ActivityType, string> = {
  game: 'Games',
  practice: 'Practices',
  off_ice_workout: 'Off-Ice Workouts',
};

const ALL_TYPES: ActivityType[] = ['practice', 'game', 'off_ice_workout'];

function startOfThisWeek(): string {
  // Monday as start of week
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function endOfThisWeek(): string {
  // Sunday as end of week
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + diff);
  return sunday.toISOString().slice(0, 10);
}

export function ActivityLogView({
  activities,
  students,
  readOnly = false,
  manageHref = '/dashboard/performance-management',
  availableTypes = ALL_TYPES,
}: Props) {
  // Initial filters: current week if readOnly (home), no date filter if editable (perf-mgmt)
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'all'>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [dateStart, setDateStart] = useState(readOnly ? startOfThisWeek() : '');
  const [dateEnd, setDateEnd] = useState(readOnly ? endOfThisWeek() : '');

  const filtered = useMemo(() => {
    const studentNameMap = new Map(students.map((s) => [s.id, s.full_name]));
    const studentFilterName = studentFilter !== 'all' ? studentNameMap.get(studentFilter) : null;

    return activities.filter((a) => {
      if (typeFilter !== 'all' && a.activity_type !== typeFilter) return false;
      if (studentFilterName && !a.student_names.includes(studentFilterName)) return false;
      if (dateStart && a.occurred_on < dateStart) return false;
      if (dateEnd && a.occurred_on > dateEnd) return false;
      return true;
    });
  }, [activities, typeFilter, studentFilter, dateStart, dateEnd, students]);

  const countsByType = useMemo(() => {
    const counts: Record<ActivityType, number> = {
      game: 0, practice: 0, off_ice_workout: 0,
    };
    filtered.forEach((a) => { counts[a.activity_type] += 1; });
    return counts;
  }, [filtered]);

  const resetToThisWeek = () => {
    setDateStart(startOfThisWeek());
    setDateEnd(endOfThisWeek());
  };
  const clearDates = () => {
    setDateStart('');
    setDateEnd('');
  };

  if (activities.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No activities yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          Once coaches schedule practices and games and trainers schedule off-ice workouts, everything will show up here.
        </p>
      </div>
    );
  }

  // Tailwind JIT can't extract dynamic class names, so map availableTypes count to a static class
  const gridColsClass = availableTypes.length === 1
    ? 'md:grid-cols-1'
    : availableTypes.length === 2
    ? 'md:grid-cols-2'
    : 'md:grid-cols-3';

  return (
    <>
      <div className={`grid grid-cols-1 ${gridColsClass} gap-3 mb-6`}>
        {availableTypes.map((t) => (
          <StatCard key={t} label={TYPE_LABELS_PLURAL[t]} value={countsByType[t]} />
        ))}
      </div>

      <div className="flex flex-col md:flex-row md:flex-wrap gap-3 mb-6 p-4 bg-paper border border-ink-hair rounded-xl">
        <div>
          <label className="kicker block mb-1">Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ActivityType | 'all')}
            className="input-base !h-9 text-xs md:!w-auto">
            <option value="all">All types</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS_PLURAL[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="kicker block mb-1">Student</label>
          <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}
            className="input-base !h-9 text-xs md:!w-auto">
            <option value="all">All students</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.jersey_number ? `#${s.jersey_number} ` : ''}{s.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="kicker block mb-1">From</label>
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
            className="input-base !h-9 text-xs" />
        </div>
        <div>
          <label className="kicker block mb-1">To</label>
          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
            className="input-base !h-9 text-xs" />
        </div>
        <div className="flex items-end gap-2">
          <button onClick={resetToThisWeek}
            className="text-[11px] font-mono uppercase tracking-wider text-ink-dim hover:text-ink">
            This week
          </button>
          <button onClick={clearDates}
            className="text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-ink">
            Clear dates
          </button>
        </div>
      </div>

      <div className="kicker mb-3">{filtered.length} of {activities.length} activities</div>

      {filtered.length === 0 ? (
        <div className="card-base p-8 text-center text-sm text-ink-dim">No matches for these filters.</div>
      ) : (
        <div className="card-base overflow-hidden">
          {filtered.map((a, idx) => (
            <ActivityItem key={a.id} activity={a} first={idx === 0} readOnly={readOnly} />
          ))}
        </div>
      )}

      {readOnly && (
        <div className="mt-5 text-center">
          <Link href={manageHref} className="text-[11px] font-mono uppercase tracking-wider text-ink-dim hover:text-ink">
            Manage activities &rarr;
          </Link>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-base p-4">
      <div className="kicker mb-1">{label}</div>
      <div className="font-serif text-2xl text-ink">{value}</div>
    </div>
  );
}

function activityHref(a: ActivityRowData): string {
  switch (a.activity_type) {
    case 'practice': return `/dashboard/practices/${a.id}`;
    case 'game': return `/dashboard/activities/${a.id}`;
    case 'off_ice_workout': return `/dashboard/workouts/${a.id}`;
  }
}

function ActivityItem({ activity, first, readOnly }: {
  activity: ActivityRowData; first: boolean; readOnly: boolean;
}) {
  const typeLabel = TYPE_LABELS[activity.activity_type];
  const typeStyle = activity.activity_type === 'game'
    ? 'bg-crimson text-paper'
    : activity.activity_type === 'practice'
    ? 'bg-ink text-paper'
    : 'bg-sage/10 text-sage-dark border border-sage/30';

  const Inner = (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${first ? '' : 'border-t border-ink-hair'} ${!readOnly ? 'group hover:bg-ivory transition-colors' : ''}`}>
      <div className="flex-shrink-0 w-16 text-right">
        <div className="font-serif text-sm text-ink">{formatDate(activity.occurred_on)}</div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${typeStyle}`}>
            {typeLabel}
          </span>
          <span className="font-medium text-ink">
            {activity.activity_type === 'game' && activity.opponent
              ? `vs ${activity.opponent}`
              : activity.title ?? typeLabel}
          </span>
          {activity.activity_type === 'game' && activity.our_score !== null && activity.opp_score !== null && (
            <span className="font-mono text-xs text-ink-faint">
              {activity.our_score}–{activity.opp_score}
            </span>
          )}
        </div>
        {activity.student_names.length > 0 && (
          <div className="text-xs text-ink-faint truncate">
            {activity.student_names.length} player{activity.student_names.length === 1 ? '' : 's'}: {activity.student_names.slice(0, 5).join(', ')}
            {activity.student_names.length > 5 && ` +${activity.student_names.length - 5} more`}
          </div>
        )}
      </div>

      {activity.duration_minutes && (
        <div className="text-xs font-mono text-ink-faint flex-shrink-0 hidden md:block">{activity.duration_minutes} min</div>
      )}

      {!readOnly && (
        <div className="flex-shrink-0 text-[10px] font-mono uppercase tracking-wider text-ink-faint group-hover:text-crimson">
          Manage &rarr;
        </div>
      )}
    </div>
  );

  if (readOnly) return Inner;
  return <Link href={activityHref(activity)} className="block">{Inner}</Link>;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
