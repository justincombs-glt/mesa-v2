/**
 * MacroBar — vertical bar rendering for the 7-day strip and history days.
 *
 * Two modes:
 *
 *   - "calories": single solid sage-dark bar, height proportional to calories
 *     vs goal. The pre-Phase-15g visual.
 *
 *   - "macros": stacked bar with up to 3 colored segments for protein, carbs,
 *     and fat. Segment heights proportional to that macro's kcal contribution
 *     (protein and carbs = 4 kcal/g, fat = 9 kcal/g). Total bar height matches
 *     the calorie-mode height so the toggle preserves the day-vs-day comparison.
 *
 *     When a day has NO macro data (all macros NULL across all entries),
 *     macro mode falls back to the solid calorie bar — visually flagging
 *     that data is missing.
 *
 * Caller decides which mode by passing `mode`. Day data comes via `totalCalories`
 * and `totals` (macro/micro aggregations from NutritionTotals). Goal is for
 * height scaling.
 *
 * No client interactivity — used in both server and client components.
 */

import type { NutritionTotals } from '@/lib/nutrition';

// Tailwind hex map — these mirror the palette used elsewhere
// (sage-dark for "good", crimson for accent, ink-faint for muted).
// Inline hex used so the SVG actually picks them up; can't trust Tailwind to
// inject class-based colors inside SVG.
const COLOR_CALORIES = '#7a9b7e';   // sage-dark (matches existing bar)
const COLOR_PROTEIN = '#7a9b7e';    // sage-dark
const COLOR_CARBS = '#d4a056';      // warm amber
const COLOR_FAT = '#c9785c';        // muted terracotta
const COLOR_EMPTY = '#e8e3d8';      // sand-100 (matches existing background)

interface MacroBarProps {
  /** Total calories for the day. */
  totalCalories: number;
  /** Goal calories — used to scale bar height. */
  goal: number;
  /** Aggregated macros + micros for the day. */
  totals: NutritionTotals;
  /** Which display mode. */
  mode: 'calories' | 'macros';
  /** Optional aria-label override. */
  ariaLabel?: string;
}

export function MacroBar({ totalCalories, goal, totals, mode, ariaLabel }: MacroBarProps) {
  // Scale: bar fills 0-100% of container, capped at 100 even if over goal.
  const totalPct = goal > 0 ? Math.min(100, (totalCalories / goal) * 100) : 0;

  // Macro mode requires macro data — fall back to calorie mode when empty
  const useMacros = mode === 'macros' && totals.entries_with_macros > 0;

  if (!useMacros) {
    // Solid calorie bar (existing visual)
    return (
      <div className="h-full w-full bg-sand-100 rounded relative overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: `${totalPct}%`, backgroundColor: COLOR_CALORIES }}
          aria-label={ariaLabel ?? `${totalCalories} calories`}
        />
      </div>
    );
  }

  // Stacked macro mode
  // Compute kcal contribution per macro (atwater factors)
  const proteinKcal = totals.protein_g * 4;
  const carbsKcal = totals.carbs_g * 4;
  const fatKcal = totals.fat_g * 9;
  const accountedKcal = proteinKcal + carbsKcal + fatKcal;

  // If macros add up to less than total calories (some entries had no macro
  // data), the "untracked" portion gets a muted color at the top of the bar
  // so the total height still matches the calorie reading.
  const untrackedKcal = Math.max(0, totalCalories - accountedKcal);

  // Convert kcals to percentages of total bar height (totalPct)
  const proteinPct = totalCalories > 0 ? (proteinKcal / totalCalories) * totalPct : 0;
  const carbsPct = totalCalories > 0 ? (carbsKcal / totalCalories) * totalPct : 0;
  const fatPct = totalCalories > 0 ? (fatKcal / totalCalories) * totalPct : 0;
  const untrackedPct = totalCalories > 0 ? (untrackedKcal / totalCalories) * totalPct : 0;

  return (
    <div
      className="h-full w-full bg-sand-100 rounded relative overflow-hidden"
      aria-label={ariaLabel ?? `${totalCalories} calories, ${totals.protein_g}g protein, ${totals.carbs_g}g carbs, ${totals.fat_g}g fat`}
    >
      {/* Stack from bottom up: protein, then carbs, then fat, then untracked */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: 0,
          height: `${proteinPct}%`,
          backgroundColor: COLOR_PROTEIN,
        }}
      />
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: `${proteinPct}%`,
          height: `${carbsPct}%`,
          backgroundColor: COLOR_CARBS,
        }}
      />
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: `${proteinPct + carbsPct}%`,
          height: `${fatPct}%`,
          backgroundColor: COLOR_FAT,
        }}
      />
      {untrackedKcal > 0 && (
        <div
          className="absolute left-0 right-0"
          style={{
            bottom: `${proteinPct + carbsPct + fatPct}%`,
            height: `${untrackedPct}%`,
            backgroundColor: COLOR_EMPTY,
            opacity: 0.6,
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// MacroBarLegend — small inline legend showing which color is which macro.
// Render once near the chart, not per-bar.
// ----------------------------------------------------------------------------

export function MacroBarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-wider text-ink-faint">
      <LegendDot color={COLOR_PROTEIN} label="protein" />
      <LegendDot color={COLOR_CARBS} label="carbs" />
      <LegendDot color={COLOR_FAT} label="fat" />
      <LegendDot color={COLOR_EMPTY} label="no macro data" />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span>{label}</span>
    </span>
  );
}
