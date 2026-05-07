# MESA v2 — Phase 3.5: Seasons, Archives, Composite-Based Tests

Big architectural batch. Introduces the **yearly/seasonal structure** to the entire app, rebuilds the Plan Detail page's Performance Tests section to use **composites** instead of individual tests, and adds the **year-over-year table view** with direction-aware change badges.

---

## What's new in Phase 3.5

### Seasons system
- New database table `seasons` — named periods with start/end dates
- New database table `season_enrollments` — per-season roster records
- `season_id` column added to `goal_plans`, `activities`, `performance_test_results`, `cpt_sessions`
- All existing data backfilled to a seeded default season ("2025-26 Season")
- Exactly one season can be flagged `is_current = true` at any time (DB-enforced)

### Season selector (left sidebar)
- Shows currently-selected season prominently
- Dropdown lists all seasons with CURRENT / ARCHIVED / UPCOMING badges
- Switching seasons persists via cookie — same selection across page reloads
- Selecting an archived season switches the entire UI into read-only mode with a banner at the top of the main content

### Seasons management page (`/dashboard/seasons`)
- Admin and Director access
- Table of all seasons with plan / activity / enrollment counts
- **New season** — create a named season with start + end dates
- **Activate** — make this the new "current" season (atomic swap)
- **Archive** — archive a season. System blocks archiving if:
  - Any goal plans in that season are `draft` or `active`
  - Any reviews in that season are not `completed`
  - Error message tells you exactly how many items are blocking
- **Delete** — only available if season has no plans or activities

### Students page — new tabbed layout
Two sub-tabs (per your Q12=C decision):
- **Current Roster** — students enrolled in the currently-selected season only
- **All Students** — three subsections:
  - Enrolled in current season
  - Not enrolled in current season (with one-click **Enroll** buttons)
  - Inactive students (with **Reactivate** button)

When enrolling a new student, they **auto-enroll in the current season** (per Q9=A).

When the current season is archived, all create/edit/enroll buttons are disabled.

### Goal Management — season-scoped
- Plan list filters by currently-selected season
- New plans get the current season's `season_id` automatically
- Archived seasons show read-only state, disabled create buttons
- Header shows season name in the kicker

### Performance Management — season-scoped
- Activity log filters by currently-selected season (still empty until Phase 4/5 ship)

### Plan Detail — rebuilt Performance Tests section with composites
Per your instruction: the section now pulls **composite performance tests** (CPTs), not individual tests.

Each attached composite renders as a table:
- **Rows** = individual sub-tests within the composite (in sequence order)
- **Columns** = CPT sessions administered for this student in the current season
- **First column** = baseline session (earliest session, or whichever is explicitly flagged `is_baseline`)
- **Subsequent columns** = other sessions with % change from baseline
- **Direction-aware indicators** — ↑ improving / ↓ declining / = flat, colored green/red/gray
- Empty state when no sessions have been recorded yet (expected until Phase 5 trainer UI ships)

Example view:

```
Fall Baseline                                             [Detach]
                         BASELINE          Oct '25
                         (Sep 1, 2025)     composite
  ──────────────────────────────────────────────────────────────
  ON-ICE  40-yard dash   5.1               4.9
          sec                               ↓ 3.9%
          ↓ better
  ──────────────────────────────────────────────────────────────
  OFF-ICE 1RM Squat      185               195
          lb                                ↑ 5.4%
          ↑ better
  ──────────────────────────────────────────────────────────────
  OFF-ICE Vertical       22                24
          in                                ↑ 9.1%
          ↑ better
```

### Goal plan composite attachment
New table `goal_plan_composites` with new server actions `attachCompositeToPlan` / `detachCompositeFromPlan`. Replaces the old `goal_plan_tests` wiring (still in DB but no longer used by UI).

---

## What's NOT in Phase 3.5

- **No "compare to previous year" expander yet** — Q6=C said optional; schema supports it; UI hook can be added later when there's actually previous-year data
- **Trainer CPT recording** — still coming in Phase 5. The composite tables on plan detail will show "no sessions recorded yet" until then
- **Year-end season rollover workflow** — you archive old season → create new season → students need to be manually re-enrolled (per Q8=A). Could add a "carry over roster" button later
- **Baseline override UI** — schema has `cpt_sessions.is_baseline`; no UI yet to flag a specific session as baseline. Defaults to earliest session for the student. Add later if needed.

---

## Deployment

### Step 1 — Run migration FIRST

1. Unzip `mesa-v2-phase3.5-clean.zip`
2. Open `supabase/migrations/0008_seasons.sql`
3. Supabase → SQL Editor → New query → paste contents → Run
4. Expected: "Success. No rows returned." (idempotent, safe to re-run)

### Step 2 — Verify migration

Run this diagnostic:

```sql
select
  (select count(*) from public.seasons) as seasons_count,
  (select name from public.seasons where is_current = true) as current_season_name,
  (select count(*) from public.season_enrollments) as enrollments_count,
  (select count(*) from public.goal_plan_composites) as plan_composites_count;
```

Expected:
- `seasons_count`: 1
- `current_season_name`: "2025-26 Season"
- `enrollments_count`: equal to your active student count (auto-enrolled)
- `plan_composites_count`: 0 (empty until you attach some)

### Step 3 — Deploy code

GitHub → mesa-2 repo → Add file → Upload files → drag contents of `mesa/` → commit "Phase 3.5 seasons".
Vercel auto-deploys in ~90s.

### Step 4 — Refresh Supabase schema cache

After migration + deploy, run this in SQL Editor (one-time for each new table — Supabase cache sometimes doesn't auto-refresh):

```sql
notify pgrst, 'reload schema';
```

---

## Testing Phase 3.5

### Test 1 — Seasons page

1. Sidebar → **Seasons**
2. You see "2025-26 Season" with CURRENT badge
3. Counts show your existing data backfilled

### Test 2 — Create and activate a new season

1. **New season** → "2026-27 Season", start 2026-09-01, end 2027-08-31 → Create
2. Appears in list with UPCOMING badge
3. **Activate** → 2026-27 now shows CURRENT, 2025-26 shows UPCOMING
4. Sidebar season selector now shows "2026-27 Season"

### Test 3 — Switch to empty season

1. Sidebar selector → pick "2026-27 Season" (which is empty)
2. Visit **Goal Management** → plan list is empty (scoped to 2026-27)
3. **New plan** button works — creates plan in 2026-27
4. Visit **Students** → Current Roster tab empty (no enrollments yet for 2026-27)
5. Switch to **All Students** tab → see all academy students in "Not enrolled" section with **Enroll** buttons

### Test 4 — Enroll into new season

1. All Students tab → click **Enroll** next to a student → they appear in Current Roster
2. Back to Current Roster tab → they show with enrollment date

### Test 5 — Attach composite to plan

1. Admin: make sure a CPT exists (e.g., "Fall Baseline" with 40yd + squat + vertical)
2. Director: create or open a goal plan
3. Performance tests section → **+ Attach composite** → pick one → Attach
4. Composite table renders with column headers but empty rows (no sessions yet)
5. Message: "No sessions recorded yet. Results will appear as the trainer administers this composite."

### Test 6 — Archive a season

1. First, make sure current season has no draft/active plans and no open reviews (or try with open items to see the block message)
2. Seasons page → **Archive** on 2026-27 (the test season)
3. If blocked: error shows count of blocking items
4. If OK: season becomes archived, banner appears when viewing it
5. Switch to archived season → top banner says "Viewing [name] — archived. Read-only mode."
6. Try to create a plan → button is disabled

---

## Permissions at Phase 3.5

| Action | Admin | Director |
|---|---|---|
| View seasons page | ✓ | ✓ |
| Create season | ✓ | ✓ |
| Activate season | ✓ | ✓ |
| Archive season | ✓ | ✓ |
| Delete empty season | ✓ | ✓ |
| Enroll student in season | ✓ | ✓ |
| Depart student from season | ✓ | ✓ |
| Attach composite to plan | ✓ | ✓ |
| Detach composite from plan | ✓ | ✓ |

Coaches, trainers, students, parents: can view season selector, can't archive/create/modify seasons.

---

## Schema reference — new and changed

### New tables
- `seasons` — named periods
- `season_enrollments` — per-season roster records
- `goal_plan_composites` — attach composites to plans

### New columns
- `goal_plans.season_id`
- `activities.season_id`
- `performance_test_results.season_id`
- `cpt_sessions.season_id`
- `cpt_sessions.is_baseline`

### Unique constraints
- `seasons(is_current) where is_current = true` — enforces only one current season
- `season_enrollments(season_id, student_id)` — one enrollment per student per season
- `goal_plan_composites(plan_id, composite_id)` — no double attachments

### Helper functions
- `current_season_id()` — returns the one current season's UUID
- `is_season_archived(sid uuid)` — returns true if that season's `archived_at` is set

---

## What to report back

- **"All works — created new season, switched between, built a plan with composite attached, archived the test season"** → Phase 4 (Coach module) begins
- **"Build error: [paste]"** → debug
- **"[X] is broken"** → debug
- **"Works but [X] should change"** → feedback

---

## Phase 4 preview (Coach module)

Once 3.5 is green, Coach module ships:

- **Phase 4a**: Practices (schedule, add students to roster, add drills/skills, log attendance). All activities automatically get the current season's `season_id`.
- **Phase 4b**: Activities → Games (log with stats grid).

Once 4a deploys, the Performance Management page you built in Phase 3b starts populating with real data from practices.
