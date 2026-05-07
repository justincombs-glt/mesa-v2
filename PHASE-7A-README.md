# MESA v2 — Phase 7a: Per-Student Insights + Auto Goal Progress

**Status:** Ready to deploy

The platform's data finally tells a story. Pull up any student to see attendance trends, performance test history with sparklines, workout consistency, and goal progress that computes itself when goals are linked to tests.

---

## What shipped

### Per-student insights page (`/dashboard/students/[id]/insights`)
A dedicated review surface, accessible to all staff (Q7 = B): admin, director, coach, trainer.

Lives as a sub-route of the student admin page — sub-route per Q6 = A, keeps the admin page focused on roster management and the insights page focused on review.

Sections, top to bottom:

1. **Summary cards (4-card strip)**: current season name, attendance %, goals achieved/total, workouts attended (last 30d count)
2. **Goal progress**: every active plan's goals with progress bars
   - Auto-computed when `linked_test_id` + `target_numeric` are set: pulls latest test result, computes `(latest - baseline) / (target - baseline) × 100` (sign-flipped for lower-is-better tests)
   - Manual fallback: respects the existing `progress_pct` field for non-quantitative goals
   - "auto" badge appears next to goals that compute themselves
   - Shows baseline → now → target progression as a one-liner
3. **Performance test trends** (Q4 = C): table with baseline / latest / Δ% / sparkline / sample count for every test the student has results for
   - Sparklines color-coded: sage when improving (direction-aware), crimson when worsening, gray when flat
   - Δ% sign-corrected: positive always means "better" relative to the test's direction
4. **Attendance breakdown** (Q3 = D): cards for practices / games / off-ice workouts / lifetime — each shows percent + raw "X/Y" count
5. **Off-ice workouts** (Q5 = B): workouts attended count (season-scoped), total sets logged (lifetime), average RPE (1-10 self-reported)

### Automatic goal progress (Q2 = C)
A new section in both `Add goal` and `Edit goal` modals:

> **Auto-track via test (optional)**
> Linked test [dropdown of all active performance tests]
> Numeric target [number input]

When both are set, the insights page (and the goal plan detail) shows auto-computed progress. When either is blank, the manual `progress_pct` value is used. Mixed plans are fine — some goals can be auto-tracked, others manual.

### Entry point
The student admin page (`/dashboard/students/[id]`) gets a "View insights →" button in its page header.

---

## Files added/changed

**New:**
- supabase/migrations/0014_phase7a_insights.sql
- lib/student-insights.ts
- components/insights/Sparkline.tsx
- components/insights/InsightsView.tsx
- app/dashboard/students/[id]/insights/page.tsx
- PHASE-7A-README.md

**Changed:**
- lib/supabase/types.ts — `GoalPlanGoal` interface gains `linked_test_id` and `target_numeric` fields
- app/actions.ts — `createGoalInPlan` and `updateGoalInPlan` both handle the new fields
- app/dashboard/goal-management/[planId]/PlanDetailClient.tsx — `tests` prop added; AddGoalModal and EditGoalModal each gained the linked-test picker and numeric target input
- app/dashboard/goal-management/[planId]/page.tsx — fetches active performance tests and passes them to PlanDetailClient
- app/dashboard/my-goals/[planId]/page.tsx — passes `tests={[]}` (student view doesn't edit goals so the picker is unused)
- app/dashboard/students/[id]/page.tsx — adds "View insights" header action

**Actions:** 83 total, no duplicates. No new actions added — Phase 7a only modified two existing ones.

---

## Database

**One new migration:** `supabase/migrations/0014_phase7a_insights.sql`

What it does:
1. Adds `linked_test_id` (uuid → performance_tests.id) and `target_numeric` (numeric) columns to `goal_plan_goals`
2. Adds index on `linked_test_id` for trend lookups
3. Adds `student_attendance_pct(student_id, season_id)` SQL helper for any future reporting that wants pct from the DB layer
4. Refreshes PostgREST schema cache

Idempotent. Safe to re-run.

---

## Deploy steps

### Step 1 — Run the SQL migration (REQUIRED, do this FIRST)
1. Open Supabase → SQL Editor → New query
2. Paste `supabase/migrations/0014_phase7a_insights.sql`
3. Run
4. Expect "Success. No rows returned."

Without this, the goal modals will fail when submitting because `linked_test_id` and `target_numeric` columns won't exist.

### Step 2 — Upload source files
1. Unzip `mesa-v2-phase7a-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
3. Commit: `Phase 7a: Per-student insights + auto goal progress`
4. Vercel redeploys in ~90s
5. Hard refresh

---

## How to test

### Prerequisites
- A current season is active with at least 1 student enrolled
- The student has been on the roster for at least one practice/game/workout with attendance marked
- At least 2 performance tests exist (one with `direction=higher_is_better`, one `lower_is_better`)
- The student has at least 2 performance test results recorded (so a trend can be drawn)
- Optionally: at least one workout with sets logged for that student (RPE values are nice for the avg RPE card)
- An active goal plan for the student with at least one goal

### 1. View insights
1. Sign in as admin (or director/coach/trainer)
2. Go to `/dashboard/students` → click any student
3. On the admin page, click the "View insights" button in the header
4. You land on the insights page. All four sections render with whatever data exists

### 2. Auto-link a goal to a test
1. Go to `/dashboard/goal-management` → open the student's plan
2. Click "+ Add goal" (or edit an existing one)
3. Fill in title (e.g., "Improve vertical jump")
4. Scroll to **Auto-track via test (optional)** section
5. Linked test = pick a performance test (e.g., "Vertical Jump")
6. Numeric target = e.g., 28
7. Save
8. Go back to the student's insights page → the goal now shows an "auto" badge with computed progress: baseline → now → target

### 3. Direction-aware test trends
1. Add a few results to two tests: one higher-is-better (vertical jump, increasing values) and one lower-is-better (40-yard sprint time, decreasing values)
2. On the insights page, both trends should show:
   - Sparkline color = sage (improving)
   - Δ% column = positive value with green color
3. If you record a value that goes the wrong direction, the sparkline turns crimson and Δ% goes negative red

### 4. Attendance breakdown
1. Mark this student present at a practice and absent at another in the current season
2. Insights page → Attendance breakdown → Practices card shows the percentage
3. Lifetime card aggregates all-time across all activity types

### 5. Workouts + RPE
1. As trainer, log some sets with RPE values for this student via `/dashboard/workouts/[id]`
2. Insights page → Off-ice workouts section shows count + total sets + average RPE

---

## Known limits / deferred to Phase 7b

- **Snapshot reviews (Q1 = C, Q8 = A)**: clicking "Save as review" to freeze the current insights as an immutable record — coming in 7b. Phase 7a is live data only.
- **Manual goal status override on top of auto** (Q2 = C, "manual rating layered on top with optional override"): right now if `linked_test_id` is set and data exists, the auto value is shown — there's no UI to manually override "this auto value is wrong, mark as on-track regardless." Will add at review time in 7b.
- **Tonnage** (Q5 = D): not shipped, deferred per recommendation
- **Student/parent self-view of insights** (Q7 considered C): not shipped — staff only. Could ship as a "My insights" route for student/parent if you want it later.
- **The existing year-over-year composite test table on goal plan detail** is unchanged. Phase 7a's per-test trends complement it but don't replace it. They serve different purposes: composite tables are session-by-session snapshots aligned to baseline; insights trends are longitudinal across all sessions.

---

## Next phase (7b)

- Snapshot review records: director clicks "Save as review" → app freezes the current state (attendance pct, every test's latest value, every goal's computed progress, every plan's full state) into a `review_snapshots` table as JSON
- Past reviews accessible from a timeline on the insights page
- Per-goal manual rating ("on track / behind / met / not met") layered on at review time
- Optional reviewer notes per section
