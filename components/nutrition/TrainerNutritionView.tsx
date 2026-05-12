import type { NutritionEntry } from '@/lib/supabase/types';
import type { NutritionData } from '@/lib/nutrition';

interface Props {
  studentName: string;
  data: NutritionData;
}

/**
 * Read-only nutrition view for trainers. Shows the same daily total + 7-day
 * strip + entries list as the household view, but with no write affordances:
 * no log button, no delete buttons, no goal editor, no danger zone.
 *
 * Designed to slot into an existing student detail page as a section, or be
 * used standalone on the trainer's per-student route.
 */
export function TrainerNutritionView({ studentName, data }: Props) {
  const { goal, today, last7Days } = data;
  const hasGoal = !!goal;
  const hasAnyData = hasGoal || last7Days.some((d) => d.entries.length > 0);

  if (!hasAnyData) {
    return (
      <div className="card-base p-6 text-center text-sm text-ink-dim">
        {studentName.split(' ')[0]} hasn&apos;t set a goal or logged anything yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <TodayPanel
        today={today}
        goal={goal?.daily_calories ?? null}
      />

      {hasGoal && (
        <SevenDayPanel days={last7Days} goal={goal!.daily_calories} />
      )}

      {today.entries.length > 0 && (
        <EntriesList entries={today.entries} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Today summary (read-only)
// ----------------------------------------------------------------------------

function TodayPanel({ today, goal }: {
  today: { date: string; entries: NutritionEntry[]; total: number };
  goal: number | null;
}) {
  if (goal === null) {
    return (
      <div className="card-base p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="kicker mb-1">Today</div>
            <div className="font-serif text-4xl text-ink">{today.total.toLocaleString()}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
              calories logged
            </div>
          </div>
          <div className="text-xs text-ink-faint text-right max-w-[200px]">
            No daily goal set.
          </div>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, (today.total / goal) * 100);
  const remaining = goal - today.total;

  return (
    <div className="card-base p-5">
      <div className="kicker mb-3">Today</div>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="font-serif text-4xl text-ink">{today.total.toLocaleString()}</div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
            of {goal.toLocaleString()} kcal
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg text-ink">
            {remaining > 0 ? remaining.toLocaleString() : '\u2014'}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
            {remaining > 0 ? 'to go' : 'goal met'}
          </div>
        </div>
      </div>
      <div className="h-2 bg-sand-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-sage-dark"
          style={{ width: `${pct}%` }}
          aria-label={`${Math.round(pct)} percent of daily goal`}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 7-day strip (read-only)
// ----------------------------------------------------------------------------

function SevenDayPanel({ days, goal }: {
  days: { date: string; entries: NutritionEntry[]; total: number }[];
  goal: number;
}) {
  return (
    <div>
      <div className="kicker mb-3">Last 7 days</div>
      <div className="card-base p-4">
        <div className="grid grid-cols-7 gap-2">
          {[...days].reverse().map((day) => {
            const date = new Date(day.date + 'T00:00:00');
            const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
            const dayNum = date.getDate();
            const pct = goal > 0 ? Math.min(100, (day.total / goal) * 100) : 0;
            const isToday = day.date === new Date().toISOString().slice(0, 10);

            return (
              <div key={day.date} className="flex flex-col items-center gap-1.5">
                <div className={`text-[10px] font-mono uppercase ${isToday ? 'text-crimson' : 'text-ink-faint'}`}>
                  {dayLabel}
                </div>
                <div className={`text-xs ${isToday ? 'text-ink font-medium' : 'text-ink-dim'}`}>
                  {dayNum}
                </div>
                <div className="h-16 w-full bg-sand-100 rounded relative overflow-hidden">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-sage-dark"
                    style={{ height: `${pct}%` }}
                    aria-label={`${day.total} calories on ${day.date}`}
                  />
                </div>
                <div className="text-[10px] font-mono text-ink-dim">
                  {day.total > 0 ? day.total.toLocaleString() : '\u2014'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Today's entries (read-only, no delete buttons)
// ----------------------------------------------------------------------------

function EntriesList({ entries }: { entries: NutritionEntry[] }) {
  return (
    <div>
      <div className="kicker mb-3">Today&apos;s entries</div>
      <div className="card-base overflow-hidden">
        {entries.map((entry, idx) => {
          const time = new Date(entry.occurred_at).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit',
          });
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-4 py-3 ${idx === 0 ? '' : 'border-t border-ink-hair'}`}
            >
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
        })}
      </div>
    </div>
  );
}
