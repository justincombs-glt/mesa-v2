import type { NutritionEntry } from '@/lib/supabase/types';
import type { NutritionDay } from '@/lib/nutrition';

interface Props {
  days: NutritionDay[];
  /** Current daily calorie goal (or null if not set) — used for "vs goal" indicator per day. */
  goal: number | null;
}

/**
 * Server component. Renders all-time nutrition history as a list of day cards,
 * most recent first. View-only (Q4 = A) — no edit or delete controls.
 *
 * Days with zero entries are omitted (filtered at the loader per Q10 = A).
 * If there's nothing to show, the component renders a friendly empty state.
 *
 * The goal value used in vs-goal indicators is the CURRENT goal, not what was
 * set on each historical day. The user's actual goal at the time isn't stored
 * per-day; using the current one is a documented simplification.
 */
export function HistoryListView({ days, goal }: Props) {
  if (days.length === 0) {
    return (
      <div className="card-base p-8 text-center">
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          No history yet. Once you start logging on the nutrition page, your past days will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
        {days.length} {days.length === 1 ? 'day' : 'days'} of logged entries
      </div>
      {days.map((day) => (
        <DayCard key={day.date} day={day} goal={goal} />
      ))}
    </div>
  );
}

function DayCard({ day, goal }: { day: NutritionDay; goal: number | null }) {
  const date = new Date(day.date + 'T00:00:00');
  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });

  const pct = goal !== null && goal > 0
    ? Math.round((day.total / goal) * 100)
    : null;

  return (
    <div className="card-base overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-sand-50 border-b border-ink-hair">
        <div className="min-w-0">
          <div className="font-serif text-lg text-ink truncate">{dateLabel}</div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-0.5">
            {day.total.toLocaleString()} kcal
            {pct !== null && (
              <>
                {' \u00b7 '}
                {pct}% of {goal!.toLocaleString()} goal
              </>
            )}
          </div>
        </div>
      </div>
      <div>
        {day.entries.map((entry, idx) => (
          <EntryRow key={entry.id} entry={entry} first={idx === 0} />
        ))}
      </div>
    </div>
  );
}

function EntryRow({ entry, first }: { entry: NutritionEntry; first: boolean }) {
  const time = new Date(entry.occurred_at).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
  const borderClass = first ? '' : 'border-t border-ink-hair';

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${borderClass}`}>
      <div className="flex-shrink-0 w-16 text-right">
        <div className="font-mono text-xs text-ink-faint">{time}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ink truncate">{entry.name}</div>
      </div>
      <div className="flex-shrink-0 font-mono text-sm text-ink">
        {entry.calories.toLocaleString()}
      </div>
    </div>
  );
}
