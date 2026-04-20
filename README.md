# MESA v2 — Phase 3b: Director Module (Part 2)

Completes the Director module. Both remaining director sidebar items are now real:

- **Goal Management** (`/dashboard/goal-management`)
- **Performance Management** (`/dashboard/performance-management`)

---

## What's new in Phase 3b

### Goal Management list (`/dashboard/goal-management`)
- Search by plan title or student name
- Filter by status (draft / active / completed / archived)
- Each row shows plan title, student (with jersey if present), status pill, goals / tests / reviews counts
- Click a row → plan detail page
- **New plan** button launches a modal to pick a student and set basics

### Goal Plan detail (`/dashboard/goal-management/[planId]`)

Four stacked sections:

**1. Plan metadata** (status, date range, agreement notes)
- Edit button swaps the header into a full edit form
- Status change via dropdown (draft → active → completed → archived)
- Delete button (cascades to goals, test links, reviews)

**2. Goals section** — 1-3 goals per plan (enforced in UI)
- Add Goal button disabled at 3 goals
- Each goal card shows domain + category pills, target value, current value, progress bar, due date, status pill
- "Start from template" dropdown pre-fills the form from your Goal Templates library
- Edit goal: title, description, target/current/progress/due date/status
- Status: active / achieved / abandoned (achieved auto-sets `achieved_at` timestamp)
- Delete goal button inside edit modal

**3. Performance Tests section**
- Attach individual performance tests from the library to this plan
- Each attached test shows:
  - Baseline value (set at attach time, or edited)
  - Latest recorded value (pulled from `performance_test_results` for this student × test)
  - **Direction-aware trend indicator** — ↑ improving, ↓ declining, = flat, — no data
  - "Lower is better" tests flip the trend logic correctly
- Detach button per test
- Empty state: "No performance tests attached yet" with guidance

**4. Reviews section** (Option C — review form with basic fields; auto-populated data deferred to Phase 7)
- **New review** modal — type (scheduled / ad-hoc) + scheduled date
- List of existing reviews in a card with status pills (Completed / Draft)
- Click a review → edit modal with:
  - Summary, Concerns, Next Steps (all textareas)
  - Save draft (stays editable)
  - Complete review (locks it — completed reviews become read-only documents)
  - Delete (only before completion)
- Completed reviews show a "locked" indicator + readonly fields

### Performance Management (`/dashboard/performance-management`)

Read-only cross-cutting activity view.

- Three stat cards at top: Games / Practices / Off-Ice Workouts
- Filter by:
  - Activity type
  - Specific student
  - Date range (from / to)
- Each row shows date, type pill, game result (if applicable), participants, duration
- Empty state: "Once coaches log practices and trainers log workouts, everything shows here"

Activities are created by **coaches** (practices, games) and **trainers** (workouts) in Phases 4 and 5. This page just consolidates them.

---

## What's NOT in Phase 3b

- **Recording test results** — attached tests show "— no data" until Phase 5 trainer UI lands
- **Review auto-population** — the attendance_pct, goal progress snapshots, test trend commentary fields exist in the schema but aren't auto-filled yet. Phase 7 adds that.
- **Activity detail pages** — clicking an activity row does nothing yet. Detail pages ship with Phase 4/5 when activities can actually be created.

---

## No new SQL migration needed

All tables were created in Phase 1 + 2.5 migrations.

---

## Deployment

1. Unzip `mesa-v2-phase3b-clean.zip`
2. GitHub → `mesa-2` → Add file → Upload files → drag contents of `mesa/` folder
3. Commit: `Phase 3b - Goal Management + Performance Management`
4. Vercel auto-deploys ~90s

---

## Testing Phase 3b

Prerequisite: you need at least one student. If you haven't enrolled anyone from Phase 3a, do that first.

### Test 1 — Create a goal plan

1. Director sidebar → **Goal Management** → empty state
2. Click **New plan**
3. Pick a student (e.g., Billy Smith)
4. Title: "Fall 2025 Season Plan"
5. Start date: 2025-09-01, End date: 2025-12-15
6. Agreement notes: "Discussed with Billy and parents 8/20. Focus on skating and speed."
7. Create plan → redirects to detail page

### Test 2 — Add goals

1. On the plan detail page → **+ Add goal** in the Goals section
2. Pick a template or skip
3. Title: "Land 10 crossovers in a row"
4. Domain: On-Ice, Category: Skating
5. Target: 10, Unit: crossovers
6. Due date: 2025-11-15
7. Add goal → appears as card with 0% progress bar
8. Add 2 more goals → button disables at 3
9. Click a goal card → edit modal → change progress to 40%, current value to "4" → Save
10. Progress bar fills to 40%
11. Edit again → Status to "achieved" → Save → pill changes to achieved, bar turns green

### Test 3 — Attach performance tests

Prerequisite: admin has created some Performance Tests (e.g., 40-yard dash, 1RM squat).

1. On plan detail → **+ Attach test** in Performance Tests section
2. Pick "40-yard dash" from dropdown
3. Description and unit auto-show in the info panel
4. Baseline: 5.1, Target: 4.8, Unit pre-filled from test
5. Attach test → row appears with baseline 5.1, latest "—", trend "no data"
6. Attach another test → same
7. Try the same test again — the dropdown won't show it (already attached)

### Test 4 — Reviews

1. Plan detail → **+ New review** in Reviews section
2. Type: Scheduled, Scheduled date: 2025-09-30
3. Create review → appears as card with "Scheduled" + "Draft" badges
4. Click the review → edit modal
5. Fill Summary: "Billy's first month. Strong on crossovers, needs more mile repeats."
6. Fill Concerns: "Mile time hasn't improved. May need off-ice plan."
7. Next steps: "Add 2 off-ice sessions per week focused on conditioning."
8. Click **Save draft** → stays editable, badge still "Draft"
9. Click **Complete review** → confirmation → modal closes → badge flips to "Completed"
10. Click the completed review → fields are read-only, footer shows "Completed [date]. This review is locked."

### Test 5 — Performance Management

1. Director sidebar → **Performance Management**
2. Empty state: "No activities yet" with guidance about Phases 4/5
3. Stats show 0/0/0
4. Filters are present but unused (no data to filter)

When Phase 4 ships and a coach logs a practice, that practice appears here with its student roster.

### Test 6 — Edit plan metadata and status transitions

1. Plan detail → **Edit plan** button in header
2. Change status to "active" → Save → status pill updates
3. Change dates, agreement notes → Save → persists
4. Cancel works too

### Test 7 — Delete a plan

1. Edit plan → **Delete plan** button → confirm → redirects to list
2. Plan (and all its goals, tests, reviews) is gone
3. Plan list refreshes to reflect

---

## Permissions at Phase 3b

| Action | Admin | Director | Coach | Trainer | Student | Parent |
|--------|-------|----------|-------|---------|---------|--------|
| View goal plans | ✓ | ✓ | — | — | — | — |
| Create/edit goal plans | ✓ | ✓ | — | — | — | — |
| Add/edit goals in plan | ✓ | ✓ | — | — | — | — |
| Attach/detach performance tests | ✓ | ✓ | — | — | — | — |
| Create/edit reviews | ✓ | ✓ | — | — | — | — |
| Complete review (lock) | ✓ | ✓ | — | — | — | — |
| View Performance Management | ✓ | ✓ | — | — | — | — |

Student/Parent read access to their own plans will be enabled in Phase 6 when their dashboards ship. The RLS policies are already in place — just no UI yet.

---

## Key design notes

### The 1-3 goals rule
Enforced only in the UI. The DB has no constraint. If you hit the 3-goal limit and want to change one, edit an existing goal to "abandoned" (which removes it from the visible count for planning purposes) or delete one.

Actually wait — abandoned goals DO still count toward the 3. If you want more than 3 active goals, delete completed/abandoned ones. The design assumes 1-3 live goals per plan to maintain focus. If this becomes painful, we relax the UI limit.

### Test trend calculation
For each attached test + student combination:
1. The LATEST result (most recent `recorded_at`) is pulled
2. Compared to the `baseline_value` on the plan link
3. Direction awareness:
   - "Higher is better" test: latest > baseline = improving
   - "Lower is better" test: latest < baseline = improving
4. Flat is shown when difference is < 0.0001 (effectively equal)
5. "No data" when no results recorded yet

### Review completion is one-way
Once you click "Complete review," the `completed_at` timestamp is set and all fields become readonly. The delete button also disappears. This is intentional — reviews are formal evaluation documents.

If you need to "amend" a completed review, create a new ad-hoc review. If you genuinely need to delete a completed one, you'd have to do it in Supabase directly (SQL). We can relax this in the future if it becomes annoying.

### Agreement Notes
Free text, no workflow. The director is documenting they had the discussion. Per the spec decision #4.

---

## What to report back

- **"All works — plan created, goals added, test attached, review completed"** → Phase 4 (Coach module) begins
- **"Build error: [paste]"** → debug
- **"[Section] is broken: [describe]"** → debug
- **"Works but [X] should change"** → feedback

---

## Phase 4 preview (Coach module)

Next:
- **Drills** — coaches see it (already present from Phase 2 admin build, just permission-wise)
- **Practices** — schedule a practice (from plan template or fresh), add students to roster, log attendance, add drills/skills
- **Activities → games** — log a game with stats grid (goals/assists/+/-/shots/penalties per player, goalie stats)
- **Students** — read-only directory

Practices and games are the biggest features. Expect ~15 files. Will likely need a split into 4a + 4b.

After Phase 4 deploys and activities exist, the Performance Management page from this phase starts populating with real data automatically — you'll see the full picture.
