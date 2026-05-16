# MESA v2 — Phase 18b: Self-Create Off-Ice Workouts

**Status:** Ready to deploy
**SQL migration required:** `0024_phase18b_self_create_workouts.sql` — **run this BEFORE deploying code.**

Players (and Students, per Q9 = B) can now create their own off-ice workouts: pick a date, optionally a template, pick exercises from the academy library, then log their sets in the same mobile logger Trainers use.

This is the completion of the Phase 18 arc started in 18a (Player role foundation). After this phase, a Player's "My Workouts" page becomes fully functional — they can self-schedule and log their own training.

---

## How it works

### Player / Student workflow
1. Go to **My Workouts** (sidebar)
2. Tap **+ New workout** at the top → modal opens
3. Pick a date (defaults to today; past or future allowed per Q7 = A)
4. Optional: title, focus tagline, category, notes
5. Optional: pick a workout template from the dropdown — prefills its exercises
6. Search the exercise library and tap to add any individual exercises
7. Tap **Create & log** → server creates the workout + roster + exercises → redirects to the mobile logger
8. Log sets normally (RPE chips, rep chips, weight inputs)

### Mid-session exercise management
If you forgot an exercise, want to reorder, or want to remove one mid-workout:
1. In the mobile logger, tap **Manage** (top-right of the exercise pills row — only visible to the creator)
2. See current exercise list with up/down arrows + Remove button
3. Search the library below to add more

### Editing / deleting
- **Delete** — inline button on the workout row in `/dashboard/my-workouts` (only shown to creators). Confirm prompt, then full cascade delete.
- **Reorder** — up/down arrows in the Manage panel (Q11 = B)
- **Remove an exercise** — also in the Manage panel; cascades any logged sets for that exercise
- **Edit metadata** (title, date, focus, notes) — `updateSelfWorkoutMeta` action exists but no UI surface yet in this phase; reachable via direct call. Add a UI later if needed.

---

## Auto-release (Q3 = A)

Self-created workouts get `released_at = now()` at creation time, with `released_by = creator.profile_id`. This means:

- The Phase 16 release-gating policy on `workout_exercise_sets` lets the creator log sets immediately (no waiting for trainer release).
- The creator's own profile is the "released by" attribution — accurate and self-consistent.
- The Phase 16 trainer release flow continues to work for trainer-scheduled workouts — only the self-create path auto-releases.

---

## What's NOT in this phase

- **No drag-to-reorder.** Up/down arrows only (Q11 = B). Drag handles are a future polish if reordering becomes daily friction.
- **No custom exercises.** Player can only pick from the academy's curated library (Q1 = A). If they want something not in the library, ask a trainer/admin to add it.
- **No "edit metadata" UI surface** for an existing self-created workout. The server action exists; the UI affordance does not. Players who want to change the title or date of an existing self-created workout currently can't (workaround: delete and recreate).
- **No sharing / publishing** — self-created workouts are visible only to the creator and academy staff (via existing RLS).
- **No "favorite this workout for reuse" mechanism** — every new workout is built from scratch (or from a coach template). A "save my workout as a template" feature is a natural future addition.
- **No exercise-level customization** (default sets, default reps) in the create modal — those are inherited from the library defaults at logging time. The mobile logger handles per-set logging; the create modal just picks which exercises are in scope.
- **No auto-detect "you've already done this workout today" warning.** Player can create duplicates if they want.

---

## Files added/changed

### New
- `supabase/migrations/0024_phase18b_self_create_workouts.sql` — widens `workout_exercises` write policy to include the activity's creator
- `app/dashboard/my-workouts/NewWorkoutTrigger.tsx` — "+ New workout" button + creation modal with date/title/focus/category/template/exercise picker
- `app/dashboard/my-workouts/WorkoutRowActions.tsx` — inline Delete button for self-created workout rows
- `app/dashboard/workouts/[id]/mobile/ManageExercisesPanel.tsx` — mid-session exercise management (reorder/remove/add)
- `PHASE-18B-README.md`

### Modified
- `app/actions.ts` — 6 new server actions (104 → 110): `createSelfWorkout`, `addSelfWorkoutExercise`, `removeSelfWorkoutExercise`, `reorderSelfWorkoutExercise`, `deleteSelfWorkout`, `updateSelfWorkoutMeta`. Plus internal helpers `_resolveSelfStudentId` and `_assertOwnsSelfWorkout` for defense-in-depth ownership checks
- `app/dashboard/my-workouts/page.tsx` — removed `season_id` filter so self-created workouts (which have null season) appear; loads exercise library + workout-plan templates for the New Workout modal; passes `viewerProfileId` to rows; row layout restructured to fit the Delete affordance
- `app/dashboard/workouts/[id]/mobile/page.tsx` — generalized `selfStudentId` resolution + `studentMode` + roster filter + redirect-checks to include player role (previously student-only); computes `isCreator`; loads `addableExercises` when creator; relaxes empty-state to let creators see the logger with zero exercises (so they can Add); passes `isCreator` + `addableExercises` to logger
- `app/dashboard/workouts/[id]/mobile/MobileWorkoutLogger.tsx` — new `isCreator` + `addableExercises` props; new `manageOpen` state; Manage button rendered in the exercise pills row when creator + not readOnly; mounts ManageExercisesPanel

### Files to delete from GitHub: none

---

## Action count: 104 → 110 (+6)

| Action | Purpose |
|---|---|
| `createSelfWorkout` | Creates activity (`logged_by` = caller, `released_at` = now), roster row for self, exercises from template + picked IDs |
| `addSelfWorkoutExercise` | Append exercise to existing self-workout (sequence = max + 1) |
| `removeSelfWorkoutExercise` | Remove exercise row + cascade its logged sets |
| `reorderSelfWorkoutExercise` | Swap sequence with up/down neighbor |
| `deleteSelfWorkout` | Full delete (cascades activity_students, workout_exercises, sets) |
| `updateSelfWorkoutMeta` | Update title/date/focus/notes (server only; no UI in 18b) |

Each mutation action calls `_assertOwnsSelfWorkout` for defense-in-depth — verifies the activity exists, is an off-ice workout, and `logged_by = caller.profile_id`. RLS also enforces this; the action check just surfaces a clearer error message than a generic RLS denial.

---

## Deploy

### Step 1: Run migration 0024 in Supabase SQL Editor (FIRST)
1. Supabase Studio → SQL Editor
2. Open `supabase/migrations/0024_phase18b_self_create_workouts.sql`
3. Paste into a new query, Run
4. The migration drops + recreates one policy on `workout_exercises`. Idempotent. Tiny.

### Step 2: Push code to GitHub
1. Unzip `mesa-v2-phase-18b-clean.zip`
2. Upload contents to GitHub via Add file → Upload files (replace conflicts)
3. Commit: "Phase 18b: self-create off-ice workouts"
4. Vercel auto-deploys ~90s

### Step 3: Verify

**As a Player:**
1. `/dashboard/my-workouts` → see "+ New workout" button at top
2. Tap → modal opens with date (today), category dropdown, title field, optional template selector, exercise picker
3. Search "squat" → see matching exercises → tap to select (sage checkmark appears)
4. Tap **Create & log** → redirects to mobile logger
5. Confirm: exercise pills show what you picked, **Manage** button appears top-right
6. Log a set on any exercise → it saves
7. Tap **Manage** → reorder with up/down arrows, remove an exercise (with confirm), add a new one
8. Go back to `/dashboard/my-workouts` → see your workout in list with "Self-logged" badge + Delete button on the right
9. Tap Delete → confirm → workout disappears

**As a Student** (Q9 = B):
1. Same flow — students can also self-create
2. Trainer-scheduled workouts continue to appear (no badge)
3. Self-created workouts get the "Self-logged" badge

**As a Trainer / Coach / Admin** opening someone else's self-created workout:
1. Can read it (existing staff-reads RLS)
2. Cannot see the Manage button (`isCreator` is false)
3. Can edit sets via existing staff-writes policy

**Defense test:**
1. Create a self-workout as one Player
2. Open the mobile logger as a different Player
3. RLS would block the read anyway, but if it leaked: no Manage button, no delete affordance, mutations would fail at `_assertOwnsSelfWorkout`

---

## Security model

| Attempt | Stops at |
|---|---|
| Player creates a workout | `requireRole('student','player', staff…)`; activity insert RLS allows `logged_by = auth.uid()` (Phase 14 widening) |
| Player adds self to roster | Phase 18a trigger allows because `activities.logged_by = player.profile_id` |
| Player inserts workout_exercises rows | NEW Phase 18b policy allows `activities.logged_by = auth.uid()` |
| Player logs their sets | Phase 16 student-write policy allows because `released_at` is non-null (auto-released at creation) |
| Player tries to edit another Player's workout | UI: no Manage button shown. Server: `_assertOwnsSelfWorkout` rejects. RLS: workout_exercises write policy rejects. |
| Player tries to add an exercise that's not in the library | Insert fails on FK to `exercises.id` |
| Player tries to add themselves to a workout they didn't create (and isn't theirs) | Phase 18a trigger raises `check_violation` |
| Trainer tries to delete a Player's self-created workout via `deleteSelfWorkout` | Rejected: `logged_by ≠ caller.profile_id`. Trainer would have to use a different (currently nonexistent) admin path. |

The migration only widens one policy. Everything else uses existing RLS infrastructure.

---

## Known limits / cosmetic notes

- **Players can add the same exercise twice.** The Manage picker shows all library exercises regardless of whether they're already in this workout. By design — sometimes you want to do dumbbell rows twice with different weights. Could filter later if it becomes confusing.
- **Reorder uses three sequential DB writes** (swap via temporary out-of-band value to avoid potential unique-index conflict). Fast for a single user but suboptimal; not worth a transaction wrapper given the tiny dataset.
- **No `updated_at` bump on add/remove/reorder exercise.** Only `updateSelfWorkoutMeta` touches `activities.updated_at`. If you start using `updated_at` as a stale-cache key, revisit.
- **Self-created workouts with zero exercises render the logger** so the creator can hit Manage. Trainer-scheduled workouts with zero exercises still show the empty state with "Set it up on desktop first" — unchanged.
- **The exercise picker in the create modal caps at 100 visible results** (with "refine search to narrow" hint). The manage panel caps at 50. Both work fine with the typical small-to-medium exercise library a hockey academy will have.
- **The "Edit" affordance for a self-created workout's metadata** isn't surfaced in any UI. If you want it, the cleanest spot would be inside the Manage panel or at the top of the mobile logger header. Easy to add later.
- **No "duplicate this workout" button.** A common QoL feature is "I want to repeat last Tuesday's workout"; Player currently has to recreate from scratch. Easy future addition.
- **The Player's My Workouts page now includes ALL their workouts regardless of season** (the `season_id` filter was removed since Players have no season and self-created workouts have null season). For a Student who has both trainer-scheduled workouts (tagged with current season) and self-created ones (no season), this means they see everything in one list — generally desirable but worth noting.
- **Workout-plan templates appear in the dropdown without filtering by `is_template = true`** matching... wait, they ARE filtered (`is_template = true` is in the query). Good. They show ALL academy templates; could later add a "shared with players" flag if academies want to gate (Q2 = C from elicitation was rejected for simplicity).
- **Empty exercise library** would mean the picker shows "Exercise library is empty." Player can still create the workout shell without any exercises, then ask an admin to populate the library. Workable but suboptimal.

---

## Why this design (key Q&A recap)

- **Q1 = A library only.** Curation matters. Player's "I want to invent a new exercise" use case is rare enough to defer.
- **Q3 = A auto-release.** No trainer to gate on; the lock concept doesn't apply when Player IS the creator.
- **Q9 = B works for Students too.** Same flow benefits regular Students who want supplemental training. The Phase 9 deferred item is satisfied here.
- **Q11 = B up/down arrows.** Faster to build than drag, accessible, sufficient for typical 5-15-exercise workouts.
- **Q4 = A full edit.** It's the creator's own data; friction-free management.

---

## Suggested next steps

- **"Duplicate this workout"** button for quick re-running of a previous session
- **"Save as my template"** — Player picks a workout to save as a personal recurring template
- **Metadata-edit UI** surface in the Manage panel or logger header
- **Drag-to-reorder** if up/down feels clunky
- **Custom exercises** (Q1 = C from elicitation) — Player invents one-offs not in library
- **Per-set targets** at creation time (e.g. "3 sets of 8 at 75lbs target")
- **Phase 8 notifications via Resend** — still gated on signup
