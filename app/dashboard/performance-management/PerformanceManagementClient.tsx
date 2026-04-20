'use client';

import { useMemo, useState } from 'react';
import type { ActivityType, Student } from '@/lib/supabase/types';
import type { ActivityRow } from './page';

type StudentLite = Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'active'>;

interface Props {
  activities: ActivityRow[];
  students: StudentLite[];
}

const TYPE_LABELS: Record<ActivityType, string> = {
  game: 'Game',
  practice: 'Practice',
  off_ice_workout: 'Off-Ice Workout',
};

export function PerformanceManagementClient({ activities, students }: Props) {
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'all'>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

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

  const countsByType = {
    game: activities.filter((a) => a.activity_type === 'game').length,
    practice: activities.filter((a) => a.activity_type === 'practice').length,
    off_ice_workout: activities.filter((a) => a.activity_type === 'off_ice_workout').length,
  };

  if (activities.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No activities yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          Once coaches start logging practices and games (Phase 4) and trainers log off-ice workouts (Phase 5), everything shows up here consolidated. Filterable by student, type, and date range.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Games" value={countsByType.game} />
        <StatCard label="Practices" value={countsByType.practice} />
        <StatCard label="Off-Ice Workouts" value={countsByType.off_ice_workout} />
      </div>

      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-paper border border-ink-hair rounded-xl">
        <div>
          <label className="kicker block mb-1">Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ActivityType | 'all')}
            className="input-base !h-9 text-xs !w-auto">
            <option value="all">All types</option>
            <option value="game">Games</option>
            <option value="practice">Practices</option>
            <option value="off_ice_workout">Off-Ice Workouts</option>
          </select>
        </div>
        <div>
          <label className="kicker block mb-1">Student</label>
          <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}
            className="input-base !h-9 text-xs !w-auto">
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
      </div>

      <div className="kicker mb-3">{filtered.length} of {activities.length} activities</div>

      {filtered.length === 0 ? (
        <div className="card-base p-8 text-center text-sm text-ink-dim">No matches for these filters.</div>
      ) : (
        <div className="card-base overflow-hidden">
          {filtered.map((a, idx) => (
            <ActivityItem key={a.id} activity={a} first={idx === 0} />
          ))}
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

function ActivityItem({ activity, first }: { activity: ActivityRow; first: boolean }) {
  const typeLabel = TYPE_LABELS[activity.activity_type];
  const typeStyle = activity.activity_type === 'game'
    ? 'bg-crimson text-paper'
    : activity.activity_type === 'practice'
    ? 'bg-ink text-paper'
    : 'bg-sage/10 text-sage-dark border border-sage/30';

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${first ? '' : 'border-t border-ink-hair'}`}>
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
        <div className="text-xs font-mono text-ink-faint flex-shrink-0">{activity.duration_minutes} min</div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
