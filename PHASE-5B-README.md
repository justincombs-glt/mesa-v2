# MESA v2 — Phase 5b: Off-Ice Workouts + Per-Set Logging

**Status:** Ready to deploy
**What's new:** Trainers can now build gym workout plans, schedule off-ice workouts, and log actual weight / reps / RPE for every set.

---

## What shipped

### Workout Plans (`/dashboard/workout-plans`)
Reusable gym workout templates. Mirrors `/dashboard/practice-plans` for the ice side.

- **List page**: each plan shows exercise count + duration
- **"New plan" modal**: title, focus, description, duration
- **Detail page**:
  - Edit meta, delete plan
  - Ordered list of exercises, each with target fields: **sets, reps, weight (lb), duration (s), rest (s), coach notes** (all optional per Q1 = A)
  - Reorder via up/down arrows on each row (writes `sequence` via `reorderWorkoutPlanItems`)
  - Add/edit/remove exercise items inline

### Off-Ice Workouts (`/dashboard/workouts`)
Scheduled gym sessions.

- **List page**: each workout shows date, category badge, title, roster count, exercise count, sets-logged count
- **"Schedule workout" modal**:
  - Date, time, duration
  - Title + focus
  - Category: Strength & Conditioning / Pilates / Fight Club / Custom (with name field)
  - Optional **Plan template** dropdown — picking a plan copies its exercises into the session
  - **Checkbox roster** with check-all/uncheck-all — all active students pre-checked
- **Detail page** — the hero of this phase:
  - Meta edit / delete
  - Roster section (add/remove players — picker filtered to current-season enrolled per Q4 answer from Phase 4)
  - **Exercises section** with exercise-focused logging grid (Q2 = C):
    - One card per workout exercise (ordered by `sequence`)
    - Card header: exercise title, target sets, coach notes, Edit/Remove buttons
    - Inside: one row per rostered student, each with a grid of **set cards** — one per set_number
    - **Each set card has weight, reps, RPE inputs** (Q4 = B)
    - `onBlur` save — border flashes green on save, red on error
    - **"+ Add set" button per student** (Q3 = A) — dynamically increases visible set count for that student
    - All blank → underlying row deleted on blur (clean)
    - **"+ Add exercise" button** lets trainer add exercises ad-hoc — no plan template required (Q5 = A)

### Role access (Q4 = B from original Phase 5 scope)
Admin, director, trainer. Coaches can't access these pages.

### Sidebar update
Trainer sidebar now has **Workout Plans** added between Exercises and Off-Ice Workouts.

---

## Files added/changed

**New files:**
```
app/dashboard/workout-plans/page.tsx
app/dashboard/workout-plans/WorkoutPlansClient.tsx
app/dashboard/workout-plans/[id]/page.tsx
app/dashboard/workout-plans/[id]/WorkoutPlanDetailClient.tsx
app/dashboard/workouts/WorkoutsClient.tsx
app/dashboard/workouts/[id]/page.tsx
app/dashboard/workouts/[id]/WorkoutDetailClient.tsx
supabase/migrations/0010_workouts_phase5b.sql
PHASE-5B-README.md
```

**Replaced files:**
```
app/dashboard/workouts/page.tsx  (was ComingSoon stub)
components/layout/AppShell.tsx    (trainer sidebar adds Workout Plans)
lib/supabase/types.ts              (WorkoutPlanItem interface extended)
```

**Actions added to `app/actions.ts`** (15 new, **81 total**, no duplicates):
```
createWorkoutPlan, updateWorkoutPlan, deleteWorkoutPlan
addWorkoutPlanItem, updateWorkoutPlanItem, deleteWorkoutPlanItem
reorderWorkoutPlanItems
createWorkout, updateWorkout, deleteWorkout
addWorkoutExercise, updateWorkoutExercise, deleteWorkoutExercise
upsertWorkoutSet, deleteWorkoutSet
```

---

## Database

**One new migration**: `supabase/migrations/0010_workouts_phase5b.sql`

What it does:
- Adds three columns to `workout_plan_items`: `default_weight_lbs`, `default_duration_seconds`, `default_rest_seconds`. Gives plan items the same target flexibility as practice plans (Q1 = A).
- Rebuilds `WorkoutExercises` and `WorkoutSets` RLS write policies so trainers can explicitly write (previous policy used `is_staff()` which already includes trainer — this is defense-in-depth).
- Refreshes PostgREST schema cache

**No new tables** — all of `workout_plans`, `workout_plan_items`, `activities` (with `activity_type='off_ice_workout'`), `workout_exercises`, `workout_exercise_sets` already exist from migration 0006.

Idempotent. Safe to re-run.

---

## Deploy steps

### Step 1 — Run the SQL migration (REQUIRED, do this FIRST)
1. Open Supabase → **SQL Editor** → New query
2. Paste the contents of `supabase/migrations/0010_workouts_phase5b.sql`
3. Click **Run**
4. Expect "Success. No rows returned."

**If you skip this step:** the new target fields (`default_weight_lbs`, `default_duration_seconds`, `default_rest_seconds`) won't exist in the database and workout plan item inserts/updates will fail.

### Step 2 — Upload source files
1. **Unzip** `mesa-v2-phase5b-clean.zip` on your Mac
2. **GitHub → `mesa-2` repo → Add file → Upload files**
3. **Drag the CONTENTS** of the unzipped folder (not the folder itself). Replace any conflicts.
4. **Commit message:** `Phase 5b: Off-ice workouts + per-set logging`
5. **Wait ~90 seconds** for Vercel to redeploy
6. **Hard refresh** (`Cmd+Shift+R`) or open Incognito

No env var changes.

---

## How to test

### Prerequisites
- A current season must be active
- Some students enrolled in the current season
- A handful of exercises in `/dashboard/exercises` (admin creates these)

### Walk-through

#### 1. Build a workout plan
- Sign in as trainer (or admin) → sidebar → **Workout Plans**
- Click **New plan** → title "Lower Body Day" + duration 60
- On the detail page, click **+ Add exercise** → pick Squat → set **4 sets × 6 reps × 185 lb** → save
- Repeat for 2–3 more exercises
- Use the up/down arrows to reorder items

#### 2. Schedule a workout
- Sidebar → **Off-Ice Workouts** → **Schedule workout**
- Date = today, duration = 60
- Category = Strength & Conditioning
- **Plan template** dropdown → pick "Lower Body Day"
- Roster: leave all checked (or uncheck a few)
- Click **Schedule** → lands on detail page with exercises pre-populated from the plan

#### 3. Log sets
- On the detail page, each exercise card shows one row per student
- Each row has 4 "Set 1/2/3/4" cards (because you set target = 4)
- Type **weight + reps + RPE** in each card's inputs
- Tab to move → when you leave an input, that cell's border flashes green (saved)
- Try adding a 5th set for one student via **+ Add set**
- Delete all values in a cell → on blur, the row gets removed

#### 4. Ad-hoc workout
- Go back to Off-Ice Workouts → **Schedule workout**
- Leave **Plan template** as `— Ad-hoc —` → schedule
- On the detail page, exercises section is empty
- Click **+ Add exercise** → pick one → set target sets → add
- Log sets as above

#### 5. Archive test
- Archive the season
- Workout Plans: can still browse but Delete/Edit still works (plans are not season-scoped — they're reusable templates)
- Off-Ice Workouts: "Schedule workout" button disabled
- Open an existing workout: Edit/Delete buttons hidden, set inputs disabled

---

## Known limits / deferred

- **Supersets / circuits** — the data model supports it (via `sequence`), but the UI groups exercises one at a time. Superset structure could be a Phase 6+ enhancement.
- **Student self-view of their workout history** — trainer sees all rosters; students can't yet see "my lifting history across workouts". Shipped in Phase 6 with student dashboards.
- **Exercise alternatives / substitutions per player** — not yet. Currently all rostered students see the same exercise list.
- **Admin-defined custom stats** — still deferred from Phase 4.
- **Reorder workout exercises on the fly** — currently exercises inherit `sequence` from the plan; no up/down arrows on the workout detail page (kept simple). Editable via re-adding exercises.

---

## Next phase (Phase 6)

- Student self-registration with 13+ DOB age gate
- Parent self-registration with family linking
- Student dashboard: goals, test progress, workout history
- Parent dashboard: view-only access to their linked students
