import type { NutritionData, NutritionEntryExtended, NutritionTotals } from '@/lib/nutrition';

interface Props {
  studentName: string;
  data: NutritionData;
}

/**
 * Read-only nutrition view for trainers. Shows the same daily total + 7-day
 * strip + entries list as the household view, but with no write affordances:
 * no log button, no delete buttons, no goal editor, no danger zone.
 *
 * Phase 15f: surfaces macros and micros where available. Same display format
 * as the household NutritionTracker so trainers and the athlete see identical
 * information.
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
  today: { date: string; entries: NutritionEntryExtended[]; total: number; totals: NutritionTotals };
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
        <MacroMicroSummary totals={today.totals} />
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
      <MacroMicroSummary totals={today.totals} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Phase 15f: macro + micro summary (mirrors the household-view component)
// ----------------------------------------------------------------------------

function MacroMicroSummary({ totals }: { totals: NutritionTotals }) {
  if (totals.entries_with_macros === 0) return null;

  const macroBits: string[] = [];
  if (totals.protein_g > 0) macroBits.push(`${formatNum(totals.protein_g)}g protein`);
  if (totals.carbs_g > 0) macroBits.push(`${formatNum(totals.carbs_g)}g carbs`);
  if (totals.fat_g > 0) macroBits.push(`${formatNum(totals.fat_g)}g fat`);
  if (totals.fiber_g > 0) macroBits.push(`${formatNum(totals.fiber_g)}g fiber`);
  if (totals.sodium_mg > 0) macroBits.push(`${totals.sodium_mg.toLocaleString()}mg sodium`);

  const microBits: string[] = [];
  if (totals.iron_mg > 0) microBits.push(`${formatNum(totals.iron_mg)}mg iron`);
  if (totals.calcium_mg > 0) microBits.push(`${totals.calcium_mg.toLocaleString()}mg calcium`);
  if (totals.vitamin_d_mcg > 0) microBits.push(`${formatNum(totals.vitamin_d_mcg)}mcg vit D`);
  if (totals.potassium_mg > 0) microBits.push(`${totals.potassium_mg.toLocaleString()}mg potassium`);

  const partial = totals.entries_with_macros < totals.entries_total;

  return (
    <div className="mt-4 pt-4 border-t border-ink-hair space-y-1.5">
      {macroBits.length > 0 && (
        <div className="text-[11px] text-ink-dim">{macroBits.join(' \u00b7 ')}</div>
      )}
      {microBits.length > 0 && (
        <div className="text-[11px] text-ink-dim">{microBits.join(' \u00b7 ')}</div>
      )}
      {partial && (
        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-2">
          {totals.entries_with_macros} of {totals.entries_total} entries with macro data
        </div>
      )}
    </div>
  );
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

// ----------------------------------------------------------------------------
// 7-day strip (read-only, calorie-only — chart not changed in 15f)
// ----------------------------------------------------------------------------

function SevenDayPanel({ days, goal }: {
  days: { date: string; entries: NutritionEntryExtended[]; total: number; totals: NutritionTotals }[];
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
// Today's entries (read-only, no delete buttons). Phase 15f: macro subtitle.
// ----------------------------------------------------------------------------

function EntriesList({ entries }: { entries: NutritionEntryExtended[] }) {
  return (
    <div>
      <div className="kicker mb-3">Today&apos;s entries</div>
      <div className="card-base overflow-hidden">
        {entries.map((entry, idx) => {
          const time = new Date(entry.occurred_at).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit',
          });

          const macroBits: string[] = [];
          if (entry.protein_g !== null) macroBits.push(`${formatNum(Number(entry.protein_g))}g P`);
          if (entry.carbs_g !== null) macroBits.push(`${formatNum(Number(entry.carbs_g))}g C`);
          if (entry.fat_g !== null) macroBits.push(`${formatNum(Number(entry.fat_g))}g F`);

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
                {macroBits.length > 0 && (
                  <div className="text-[10px] font-mono text-ink-faint mt-0.5">
                    {macroBits.join(' \u00b7 ')}
                  </div>
                )}
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
