'use client';

import { useState } from 'react';
import type { NutritionEntryExtended, NutritionDay, NutritionTotals } from '@/lib/nutrition';
import { MacroBar, MacroBarLegend } from '@/components/nutrition/MacroBar';

interface Props {
  days: NutritionDay[];
  /** Current daily calorie goal (or null if not set) — used for "vs goal" indicator per day. */
  goal: number | null;
}

/**
 * Client component (Phase 15g adds an interactive chart-mode toggle).
 * Renders all-time nutrition history as a list of day cards, most recent first.
 * View-only — no edit or delete controls.
 *
 * Days with zero entries are omitted (filtered at the loader per Q10 = A).
 * If there's nothing to show, the component renders a friendly empty state.
 *
 * The goal value used in vs-goal indicators is the CURRENT goal, not what was
 * set on each historical day. The user's actual goal at the time isn't stored
 * per-day; using the current one is a documented simplification.
 *
 * Phase 15g adds:
 *   - Macro and micro totals per day (under the calorie subtitle)
 *   - Stacked macro bar visualization for each day (toggle calories/macros)
 *   - Per-entry macro subtitle
 */
export function HistoryListView({ days, goal }: Props) {
  // Phase 15g: chart mode toggle, defaults to calories
  const [chartMode, setChartMode] = useState<'calories' | 'macros'>('calories');

  if (days.length === 0) {
    return (
      <div className="card-base p-8 text-center">
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          No history yet. Once you start logging on the nutrition page, your past days will appear here.
        </p>
      </div>
    );
  }

  const anyMacros = days.some((d) => d.totals.entries_with_macros > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
          {days.length} {days.length === 1 ? 'day' : 'days'} of logged entries
        </div>
        {anyMacros && <ChartModeToggle mode={chartMode} onChange={setChartMode} />}
      </div>
      {chartMode === 'macros' && anyMacros && (
        <div className="flex justify-center">
          <MacroBarLegend />
        </div>
      )}
      {days.map((day) => (
        <DayCard key={day.date} day={day} goal={goal} chartMode={chartMode} />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Day card — renders the header, the macro bar, and the entry list
// ----------------------------------------------------------------------------

function DayCard({
  day, goal, chartMode,
}: {
  day: NutritionDay;
  goal: number | null;
  chartMode: 'calories' | 'macros';
}) {
  const date = new Date(day.date + 'T00:00:00');
  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });

  const pct = goal !== null && goal > 0
    ? Math.round((day.total / goal) * 100)
    : null;

  // Bar height scaling needs a non-null goal. If no goal, scale to highest
  // day in the history (passed as prop), or fall back to total itself.
  // For simplicity here, use goal-or-total — if no goal, bar shows 100%
  // height for every day. Acceptable since the legend explains it.
  const effectiveGoal = goal && goal > 0 ? goal : Math.max(day.total, 1);

  return (
    <div className="card-base overflow-hidden">
      <div className="flex items-stretch gap-4 px-4 py-3 bg-sand-50 border-b border-ink-hair">
        <div className="min-w-0 flex-1">
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
          <MacroMicroSummary totals={day.totals} />
        </div>
        {/* Phase 15g: small bar visualization in the day card header */}
        <div className="flex-shrink-0 w-8 h-14">
          <MacroBar
            totalCalories={day.total}
            goal={effectiveGoal}
            totals={day.totals}
            mode={chartMode}
          />
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

// ----------------------------------------------------------------------------
// Macro/micro summary lines for a day. Matches the visual treatment in
// NutritionTracker's MacroMicroSummary.
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
    <div className="mt-2 space-y-0.5">
      {macroBits.length > 0 && (
        <div className="text-[11px] text-ink-dim">{macroBits.join(' \u00b7 ')}</div>
      )}
      {microBits.length > 0 && (
        <div className="text-[11px] text-ink-dim">{microBits.join(' \u00b7 ')}</div>
      )}
      {partial && (
        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
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
// Single entry row with per-entry macro subtitle
// ----------------------------------------------------------------------------

function EntryRow({ entry, first }: { entry: NutritionEntryExtended; first: boolean }) {
  const time = new Date(entry.occurred_at).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
  const borderClass = first ? '' : 'border-t border-ink-hair';

  const macroBits: string[] = [];
  if (entry.protein_g !== null) macroBits.push(`${formatNum(Number(entry.protein_g))}g P`);
  if (entry.carbs_g !== null) macroBits.push(`${formatNum(Number(entry.carbs_g))}g C`);
  if (entry.fat_g !== null) macroBits.push(`${formatNum(Number(entry.fat_g))}g F`);

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${borderClass}`}>
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
}

// ----------------------------------------------------------------------------
// Chart mode toggle button group (same component as in NutritionTracker but
// duplicated here to avoid a cross-file import cycle of a tiny component).
// ----------------------------------------------------------------------------

function ChartModeToggle({
  mode, onChange,
}: {
  mode: 'calories' | 'macros';
  onChange: (m: 'calories' | 'macros') => void;
}) {
  const baseBtn = 'text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded transition-colors';
  const activeBtn = 'bg-ink text-paper';
  const inactiveBtn = 'text-ink-faint hover:text-ink';

  return (
    <div className="inline-flex items-center gap-1 p-0.5 rounded bg-sand-100" role="group" aria-label="Chart view">
      <button
        type="button"
        onClick={() => onChange('calories')}
        className={`${baseBtn} ${mode === 'calories' ? activeBtn : inactiveBtn}`}
        aria-pressed={mode === 'calories'}
      >
        Calories
      </button>
      <button
        type="button"
        onClick={() => onChange('macros')}
        className={`${baseBtn} ${mode === 'macros' ? activeBtn : inactiveBtn}`}
        aria-pressed={mode === 'macros'}
      >
        Macros
      </button>
    </div>
  );
}
