# MESA v2 — Phase 11: APA Session Split by Domain (Off-Ice + On-Ice)

**Status:** Ready to deploy
**No SQL migration required.** Performance tests already have a `domain` column (`'on_ice' | 'off_ice'`). Pure UI rearrangement.

The Athletic Performance Assessment session detail page now visually separates sub-tests into two distinct sections — Off-Ice on top, On-Ice below — each with its own results sub-grid. The same split applies to the goal-plan composite tables shown in both director and student views.

---

## What shipped

### Q1 = B — Two distinct sub-grids in session detail
**Route:** `/dashboard/cpt-sessions/[id]` (admin/director/trainer)

- The single big results grid is replaced by **two stacked sections**, each with its own header and results matrix
- **Off-Ice section first** (Q3 = B), labeled with a sage-dark "OFF-ICE" pill
- **On-Ice section below**, labeled with an ink "ON-ICE" pill
- Each section has its own student count and test count in the kicker
- Mobile: each section gets its own collection of student cards
- Desktop: each section gets its own table
- Same per-cell entry UX (tap to edit, autosave) — no functional changes to result entry, just visual organization

### Q2 = A / Q6 = A — Single-domain composites only show one section
- Composites with all off-ice tests render only the Off-Ice section (full width)
- Composites with all on-ice tests render only the On-Ice section
- No empty section, no "(no on-ice tests)" note

### Q5 = B — Same split in goal-plan composite tables
**Routes:**
- `/dashboard/goal-management/[planId]` (director)
- `/dashboard/my-goals/[planId]` (student/parent)

The `<CompositeTable>` component (used in both director and student views of attached composites) now splits its sub-tests rows into two stacked sub-tables:

- **Off-Ice sub-table** with its own header pill and column headers (baseline + each session)
- **On-Ice sub-table** below, sharing the same baseline + session columns
- Each sub-table is its own table for clean visual separation
- Empty composites still render the "No sessions recorded yet" empty state once (no per-domain duplication)

### Removed: per-row domain pill
Previously each sub-test row in the goal-plan CompositeTable had a small domain pill next to the test title (e.g., "ON-ICE Vertical Jump"). With the split, the pill is redundant — the section header already conveys the domain. Pills removed from individual rows.

---

## What did NOT change

- **No database migration.** `performance_tests.domain` already exists.
- **No new server actions.** Pure UI work.
- **`upsertCptResult` action**: unchanged. Result entry still works per-cell exactly as before.
- **APA session list page** (`/dashboard/cpt-sessions`): unchanged.
- **Composite definition / edit UI** (`/dashboard/composite-performance-tests`): unchanged. (Q5 = B scoped this out — admin-only and rarely viewed.)
- **Empty-composite, empty-roster guards** in session detail: unchanged.
- **Action count: 87 (no change).**

---

## Files added/changed

**New:**
- PHASE-11-README.md

**Changed:**
- app/dashboard/cpt-sessions/[id]/page.tsx
  - Added `domain` to the SELECT from `performance_tests`
  - Added `domain: GoalDomain` to the `TestColumn` exported interface
  - Added `GoalDomain` to the type import
- app/dashboard/cpt-sessions/[id]/CptSessionDetailClient.tsx
  - `<ResultsGrid>` now splits its tests into off-ice / on-ice arrays and renders each as a `<ResultsGridSection>` (or skips that section when empty)
  - New `<ResultsGridSection>` helper component renders the same mobile/desktop result entry layout as the original grid, parameterized by label, accent color, and a filtered tests array
- app/dashboard/goal-management/[planId]/PlanDetailClient.tsx
  - `<CompositeTable>` now splits its sub-tests by domain and renders one `<CompositeDomainTable>` per domain
  - New `<CompositeDomainTable>` helper component renders one results sub-table for the given domain, sharing baseline/session column structure
  - Per-row domain pill removed from the table body (now redundant with section header)

**Files to delete from GitHub:** none.

---

## Database

**No migration required.** The `domain` column on `performance_tests` already exists (added in `0006_v2_full_rewrite.sql` with `goal_domain` enum). Every test has a domain (`not null` constraint), so no edge case handling needed.

---

## Deploy steps

1. Unzip `mesa-v2-phase-11-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
3. Commit: `Phase 11: Split APA session and composite tables by domain`
4. Vercel auto-deploys ~90s
5. Hard refresh

---

## How to test

### Setup
For best testing, you want a composite that has **both** on-ice and off-ice sub-tests (e.g., "Fall Baseline" with vertical jump, sprint, plus skating speed). If your existing composite is single-domain, the split will work correctly but you'll only see one section — try editing the composite to add a sub-test of the other domain to exercise the split.

### 1. APA session detail — mixed-domain composite
1. Sign in as trainer or director
2. Open an existing CPT session: `/dashboard/cpt-sessions/[id]`
3. Above the session metadata: unchanged "Edit session" section
4. Below: TWO results sections instead of one
5. **Off-Ice section on top** — sage-dark "OFF-ICE" pill, then the off-ice tests in a results matrix (mobile cards or desktop table)
6. **On-Ice section below** — ink "ON-ICE" pill, then the on-ice tests in their own matrix
7. Enter values in cells: same UX as before (tap, type, autosave)
8. Switch from desktop to mobile (or open in mobile): each section becomes its own collection of student cards

### 2. APA session detail — single-domain composite
1. Open a CPT session whose composite has only off-ice tests (e.g., gym-only assessment)
2. Only the Off-Ice section renders, full width
3. No "On-Ice" section, no empty placeholder
4. Same for on-ice-only composite

### 3. Goal plan composite table (director view)
1. As director, open `/dashboard/goal-management/[planId]` for a plan with an attached mixed-domain composite
2. The composite card now contains TWO sub-tables stacked vertically:
   - Off-Ice sub-table (with sage-dark pill in header)
   - On-Ice sub-table (with ink pill in header)
3. Each sub-table has the same baseline + session columns
4. Per-row domain pills (the small "ON-ICE" / "OFF-ICE" labels next to test names) are gone — section headers handle that

### 4. Goal plan composite table (student view)
1. As student, open `/dashboard/my-goals/[planId]`
2. Same split: composite card now shows Off-Ice + On-Ice sub-tables
3. Read-only display, but the split still applies

### 5. Empty composite
1. Open the goal-plan view of a composite with no sessions yet recorded
2. Still shows the single "No sessions recorded yet" empty state inside the card
3. No per-domain duplication

### 6. Single-session composite
1. Open the goal-plan view of a composite with exactly one session (the baseline)
2. Off-Ice and On-Ice sub-tables each show the Baseline column with the recorded values
3. No additional session columns yet (no progress to compute)

---

## Known limits / cosmetic notes

- **The Off-Ice / On-Ice pill colors match the academy palette.** Off-Ice uses sage-dark (matches the off-ice activity rows in dashboards). On-Ice uses ink (matches practice rows).
- **Composite-edit UI was scoped out (Q5 = B).** When the director picks tests to bundle into a composite, the picker doesn't visually group by domain. This is fine because the test entries already display their domain badge, and the picker is admin-only and infrequently used. If you want this added later, it's a small follow-up.
- **No data migration.** All existing sessions and composites continue to work exactly as before — they just render differently. If you've never tagged a test as on-ice or off-ice, that's impossible (the column is `not null` and every test was created with a domain), but if somehow a legacy test exists with an unexpected domain value, it would default to whichever section's filter matches.

---

## Next phase candidates

- **Composite-edit UI: visually group test pickers by domain** — small follow-up if you want consistency across all surfaces
- **Self-create workouts** for students (deferred Q1=C from Phase 9)
- **Phase 8 notifications via Resend** — still gated on signup
- **Weekly digest emails** — last topic discussed; needs Resend
