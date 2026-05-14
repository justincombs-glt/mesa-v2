# MESA v2 — Phase 15e: Historical Daily Log Access

**Status:** Ready to deploy
**No SQL migration required.** All work is frontend.

This phase fills the gap in the nutrition feature: players can now see what they ate on past days, not just today. Two surfaces:

1. **Inline expand on the 7-day strip** — tap any past day's bar to see that day's entries below the grid
2. **`/dashboard/nutrition/history`** — a dedicated page showing every day with logged entries, all-time, sorted most recent first

Both surfaces are **view-only** (Q4 = A). Past entries can be viewed but not edited or deleted from these pages. Today's section retains full edit/delete; only history is immutable.

---

## How it works (player's perspective)

### Inline expand
1. Open `/dashboard/nutrition`
2. Scroll to the "Last 7 days" strip
3. **Tap any past day's bar** (today and zero-entry days aren't tappable)
4. The day's entries appear below the grid: time, name, calorie count
5. Shows the day's total and "X% of N goal" indicator at the top
6. Tap "Close" or tap a different bar to switch days

### Full history page
1. From the 7-day strip, tap "View full history →" link below the grid
2. Lands on `/dashboard/nutrition/history`
3. Scroll through cards, one per day, most recent first
4. Each card: date label, total, vs-goal percentage, time-stamped entries
5. Days with zero entries are hidden (Q10 = A)
6. Read-only — no edit, no delete buttons anywhere

For parents, both surfaces work identically at `/dashboard/family/[studentId]/nutrition` (inline expand) and `/dashboard/family/[studentId]/nutrition/history` (full history page).

---

## Files added/changed

### New
- `lib/nutrition.ts` — added `buildNutritionHistory()` for all-time loading (filters zero-entry days, sorts newest-first)
- `components/nutrition/HistoryListView.tsx` — server component rendering the day-card list for the history page
- `app/dashboard/nutrition/history/page.tsx` — student history route
- `app/dashboard/family/[studentId]/nutrition/history/page.tsx` — parent history route
- `PHASE-15E-README.md`

### Modified
- `components/nutrition/NutritionTracker.tsx`
  - Each 7-day-strip bar is now a `<button>` with tap-to-expand behavior
  - Today and zero-entry days are non-tappable (skip and disabled, respectively)
  - New `ExpandedDayPanel` shows below the grid when a day is selected — header with date + total + "% of goal", followed by entries list
  - New `ExpandedDayEntryRow` displays time + name + calories per row (view-only)
  - New "View full history →" link below the grid pointing to the appropriate history page based on viewer role
- `next/link` import added

### Files to delete from GitHub: none

### Action count
97 → 97 (unchanged — this is a pure read-side feature, no server actions needed beyond the existing read paths).

---

## What's NOT in this phase

- **No edit on past entries.** Q4 = A. If you want to fix a typo from 3 days ago, you can't — by design. If this becomes painful, the natural extension is to allow edit on past days only for today + last N days, or to allow undelete. Left for a future phase.
- **No delete on past entries.** Same reasoning. The "Delete all" button in the Danger Zone still works as the nuclear option.
- **No date jumping or calendar picker.** Just a scroll-through list. At MESA's scale this is fine; if a player has 2 years of history they scroll. Could add a year/month filter later.
- **No charts beyond the 7-day strip.** No monthly average, no rolling trend lines. Could add later.
- **Trainer view unchanged.** Q9 = B. Trainers still see today + 7-day rollup only; no expand-past-day or full history page on trainer routes.

---

## Deploy

### Step 1: Push code to GitHub
1. Unzip `mesa-v2-phase-15e-clean.zip`
2. Upload contents to GitHub via Add file → Upload files (replace conflicts)
3. Commit: "Phase 15e: historical daily log access"

### Step 2: Vercel auto-deploys
No SQL migration, no new npm dependencies. ~90 seconds.

### Step 3: Verify

**Best test (account with several days of history):**

1. Sign in as a student or parent
2. Open the nutrition page — scroll to the 7-day strip
3. **Tap a past day's bar** (any one with a green fill) → expanded panel appears below
4. Verify: date in header, total + percentage of goal, entries listed with timestamps
5. Tap a different day's bar → panel switches to the new day
6. Tap "Close" → panel collapses
7. **Tap "View full history →"** below the strip → lands on `/dashboard/nutrition/history`
8. Verify: all days with entries listed, most recent first, days without entries omitted
9. Read-only — no edit/delete affordances visible anywhere
10. Navigate back via the breadcrumb kicker at the top

**As parent on a child's account:**
1. Navigate to `/dashboard/family/[studentId]/nutrition`
2. Same inline expand on the strip
3. "View full history →" → goes to `/dashboard/family/[studentId]/nutrition/history`
4. Same view, same read-only behavior

**Edge cases:**
- Today's bar isn't tappable — confirmed by the disabled state on its button
- A day with zero entries isn't tappable — bar is shown for grid layout consistency but disabled
- History page with no logged days ever → friendly "No history yet" empty state

---

## Why view-only? (Q4 = A reasoning)

You explicitly chose Q4 = A in the locked answers. The case for it:

- **Data integrity.** Once a day passes, the log is a record of what was. Allowing arbitrary edits backwards makes the log less trustworthy as a personal history.
- **Cognitive simplicity.** "Today is editable; past is sealed" is a simple mental model. "Past 7 days editable, older locked" creates an arbitrary boundary.
- **Disordered eating considerations.** This is subtle. Letting a player retroactively delete a binge or revise a high-calorie day creates a path to disguising the historical record. The view-only constraint nudges the log toward truthfulness.

If you ever want to revisit this, easy to add an edit affordance — the row component already has the data; just wire in a state toggle.

---

## Known limits / cosmetic notes

- **The goal value in vs-goal indicators is the CURRENT goal**, not the goal set on that historical day. We don't store goal-per-day history (the `nutrition_goals` table is one-row-per-student). If a player's goal was 2200 in January and 2400 in February, all days display as percentages of 2400. Minor inaccuracy; documenting for transparency.
- **Time zone bucketing** continues to use UTC for the date key (matches Phase 15a). For Eastern Time users near midnight, an entry logged at 11:45pm Mon EST could appear under Tuesday's bucket. The 7-day strip and history page both inherit this behavior. Fix would be to use the user's local timezone explicitly throughout — out of scope for 15e.
- **No pagination on the history page.** Loads everything client-side per Q5 = C. At MESA's scale (a student logging 5 items/day for 2 years = ~3,650 rows ≈ 100KB JSON), this is fine. If a power user starts hitting performance issues, the natural fix is virtualized scrolling or pagination — easy to add later.
- **The 7-day strip footer now has TWO captions** ("Tap a past day to see what you ate · today shown above" + the "View full history →" link). A bit busy; could be merged into one line if visually noisy.
- **Mobile tap targets on the strip**: each bar is ~40px wide. On smaller phones this can feel tight. The whole button column is tappable (not just the bar), which helps.
- **Closing the expanded panel uses a small text link.** A larger close affordance might be clearer for mobile users; left as-is for design consistency with the rest of MESA's understated UI.

---

## Suggested next steps

- **Pagination or virtual scroll** on the history page if any student crosses ~1000 rows
- **Per-day goal history** — store the goal at the time, so vs-goal indicators are accurate retroactively
- **Calendar/date picker** for jumping to a specific date
- **Monthly summary view** — weekly averages, days-met-goal, etc.
- **Apple Health export** of nutrition data (long-deferred)
- **Frequency-weighted autocomplete** instead of recency
- **Macros tracking** (protein/carbs/fat)
- **Phase 8 notifications via Resend** (still gated on signup)
