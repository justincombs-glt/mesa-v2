# MESA v2 — Phase 15g: Nutrition History Macros + Macro Chart

**Status:** Ready to deploy
**SQL migration required:** None
**New env vars required:** None
**Action count:** 111 (unchanged)

Two improvements that build directly on Phase 15f:

1. **History page** now displays the same macro/micro lines and per-entry subtitles as the Today section. Previously History was unchanged from Phase 15e.
2. **7-day strip chart** has a new "Macros" mode that splits each day's bar into stacked colored segments for protein, carbs, and fat. Toggleable — defaults to calories-only.

The chart treatment also appears on the History page (small bar per day card).

---

## Files in this zip

### New
- `components/nutrition/MacroBar.tsx` — shared vertical bar component used by both the 7-day strip and the History list. Two modes: solid calorie bar OR stacked macro segments.

### Modified (full replacement)
- `components/nutrition/NutritionTracker.tsx` — adds chart-mode toggle button + uses MacroBar in SevenDaySection
- `components/nutrition/HistoryListView.tsx` — adds macro/micro lines, per-entry subtitle, MacroBar on each day card, chart-mode toggle

---

## How the macro chart works

When you click the "Macros" toggle (top-right of the 7-day strip), each day's bar becomes a stacked composition:

```
       ┌─────┐
       │ FAT │  ← muted terracotta
       ├─────┤
       │CARBS│  ← warm amber
       │CARBS│
       ├─────┤
       │PRTN │  ← sage-dark (same color as calorie bar)
       └─────┘
```

Segment heights are proportional to each macro's kcal contribution (atwater factors: protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g). Total bar height is unchanged from calorie mode, so day-vs-day comparison is preserved.

**Days with no macro data** (only manual entries) show a solid calorie bar even in macros mode — visually flagging missing data without separate UI.

**Partial-macro days** (some entries with macros, some without) show stacked macros at the bottom and a muted "untracked" segment on top to make up the remaining calorie height.

A small legend appears below the chart when macros mode is active.

---

## How the toggle works

- **Defaults to "Calories"** — preserves the existing visual for users not interested in macro detail
- **Hidden entirely when no day in the window has macro data** — no point showing a toggle that wouldn't change anything
- **State is local to each component** — toggling on the main 7-day strip doesn't affect the History page and vice versa

---

## Deploy

### Push code

```bash
cd ~/Desktop/mesa-v2
claude
```

```
Unzip ~/Downloads/mesa-v2-phase-15g-clean.zip into the current directory,
overwriting existing files. Then run git status. Stop there.
```

Should show 3 files: 1 new (`MacroBar.tsx`), 2 modified (`NutritionTracker.tsx`, `HistoryListView.tsx`). If clean:

```
Commit "Phase 15g: nutrition history macros + macro chart" and push.
```

Vercel rebuilds. No migration, no env vars, no server actions changed.

### Verify

1. Sign in as student, navigate to `/dashboard/nutrition`
2. Scroll to the 7-day strip
3. If any of the last 7 days has macro data, you should see a "Calories / Macros" toggle in the top-right of the strip
4. Click "Macros" — each day's bar should switch to a stacked colored bar (sage protein + amber carbs + terracotta fat)
5. Days without macro data stay solid sage (the calorie color)
6. A legend appears below the chart
7. Click "Calories" — bars revert to the original solid sage
8. Click "View full history" at the bottom
9. On the History page, each day card now shows macro/micro lines under the calorie subtitle (matches Today display), and a small bar on the right side of each day header
10. Same toggle works on the History page

---

## What's intentionally NOT in 15g

- **Micros in the chart** — too many fields to fit cleanly. Display-only.
- **Macro goals** — still no protein/carbs/fat targets. Same as 15f.
- **Goal-vs-actual indicator per macro** — would require macro goals first.
- **Toggle state persistence** — switching to macros mode doesn't survive a page reload. Always defaults to calories. Intentional to keep the lighter default.

---

## Verification checklist

- [ ] 3 files in zip applied successfully
- [ ] Toggle button appears on 7-day strip when ≥1 day has macros
- [ ] Toggle button appears on History page when any day has macros
- [ ] "Macros" mode renders stacked bars correctly
- [ ] "Calories" mode is the default and matches the pre-15g visual
- [ ] Days with no macro data render as solid bars even in macros mode
- [ ] History page shows macro/micro lines per day
- [ ] History page shows per-entry macro subtitles
- [ ] Trainer view still works (unchanged in 15g)
- [ ] No console errors

---

## What's next

- **Phase 15h** (if trainer asks) — macro goal-setting. Adds daily protein/carbs/fat targets. Worth a design conversation re: restrictive-eating risk first.
- **Phase 15i** (optional) — extend macro capture to text-search autocomplete picks + history-item picks (currently only barcode scans capture macros).
- **Back to the 9-series** when Whoop device arrives or when ready to submit Google verification.
