# MESA v2 — Phase 16: Workout Release Gating

**Status:** Ready to deploy
**SQL migration required:** `0021_phase16_workout_release_gating.sql` — **run this BEFORE deploying code.**

This phase prevents players from logging workout sets before a trainer is ready to start the session. Each off-ice workout has a new "released" state — until a trainer (or director or admin) explicitly releases it, students see the workout as **read-only preview** with no input fields. Once released, the player can log sets normally. Release is **irreversible** — once flipped, the workout stays open to logging.

---

## How it works

### Trainer's perspective
1. Open `/dashboard/workouts` → list of off-ice workouts
2. Each row now shows a status badge: **Released** (sage dot) or **Locked** (crimson dot)
3. Locked rows have an inline **Release** button on the right with a two-step confirm
4. Click "Release" → "Confirm" → workout is released, badge flips to "Released", player can now log
5. Alternatively, open the workout detail page (`/dashboard/workouts/[id]`) — a colored banner at the top shows release status, with a Release button when locked
6. Once released, the banner turns sage and shows the release date — no "un-release" affordance

### Player's perspective
1. `/dashboard/my-workouts` lists all assigned workouts
2. Locked workouts show a crimson "Locked" badge with "Waiting for your trainer to release this workout"
3. CTA reads "Preview →" instead of "Log →"
4. Tap → the mobile logger opens, but with a banner at the top: **"Locked. Your trainer will release this workout when it's time to start. Until then, you can preview the exercises below."**
5. No input fields, no log buttons. Player can scroll through the exercise list as a preview.
6. Once trainer releases (and player refreshes or revisits), all input affordances appear and logging works normally.

### Database enforcement
- New columns on `activities`: `released_at timestamptz` (NULL = locked) and `released_by uuid` (audit)
- The Phase 9 student-write RLS policy on `workout_exercise_sets` is tightened: a student can only write their own sets if the parent activity has `released_at IS NOT NULL`
- This means even if a player crafts a direct API call bypassing the UI, RLS rejects the write
- Trainer/staff writes are unchanged — staff can record sets on locked workouts (useful for trainers entering data on behalf of athletes mid-session before flipping the public release)

---

## What did NOT change

- **No "un-release" or re-lock affordance** (Q5 = B confirmed). Once released, stays released. If you need to lock a workout back out, delete the activity entirely.
- **No date-based auto-unlock** (Q1 = B confirmed). Pure manual release. A workout scheduled for 30 days out stays locked until the trainer flips it, regardless of the current date.
- **No notifications when a workout is released** (Q6 = A — Phase 8 / Resend still deferred). Players see the change next time they open MESA.
- **Coaches still don't release** (Q9 = B — only admin / director / trainer). Coaches don't have workout-edit rights at all currently, so this is just consistent with existing access.
- **Game scheduling and nutrition tracking are unaffected.** Release gating applies only to off-ice workouts (activity_type = 'off_ice_workout').

---

## Backfill behavior for existing data

Per Q7 = B, the migration handles existing rows like this:

| Existing workout | `released_at` after migration |
|---|---|
| Past-dated (`occurred_on < today`) | `now()` — auto-released |
| Today-dated (`occurred_on = today`) | `now()` — auto-released |
| Future-dated (`occurred_on > today`) | NULL — starts locked |

This is the most forgiving default. Past workouts shouldn't be retroactively locked (players might still be entering data after the session); future workouts should follow the new policy from day one.

---

## Files added/changed

### New
- `supabase/migrations/0021_phase16_workout_release_gating.sql`
- `app/dashboard/workouts/[id]/ReleaseControl.tsx` — release banner + button for the detail page
- `PHASE-16-README.md`

### Modified
- `lib/supabase/types.ts` — `Activity` interface gains `released_at` and `released_by`
- `app/actions.ts` — new `releaseWorkout` action (97 → 98)
- `app/dashboard/workouts/[id]/page.tsx` — renders `<ReleaseControl>` above the workout detail content
- `app/dashboard/workouts/[id]/mobile/page.tsx` — computes `locked` for student callers, passes to logger; sets `readOnly` when locked
- `app/dashboard/workouts/[id]/mobile/MobileWorkoutLogger.tsx` — new `locked` prop, renders banner at top when true
- `app/dashboard/workouts/WorkoutsClient.tsx` — list rows show release badge; inline Release button (with confirm step) on unreleased rows
- `app/dashboard/my-workouts/page.tsx` — student row shows Locked badge when applicable; CTA flips to "Preview →"

### Files to delete from GitHub: none

---

## Deploy

### Step 1: Run migration 0021 in Supabase SQL Editor (FIRST)

1. Supabase Studio → SQL Editor
2. Open `supabase/migrations/0021_phase16_workout_release_gating.sql`
3. Paste contents into a new query
4. Click **Run**
5. The script adds 2 columns to `activities`, creates 1 partial index, drops and re-creates 1 RLS policy, and backfills `released_at` for past/today workouts. Idempotent.

### Step 2: Push code to GitHub
1. Unzip `mesa-v2-phase-16-clean.zip`
2. Upload contents to GitHub via Add file → Upload files (replace conflicts)
3. Commit: "Phase 16: workout release gating"
4. Vercel auto-deploys ~90s

### Step 3: Verify

**As a trainer:**
1. `/dashboard/workouts` → see all your off-ice workouts with new "Released" / "Locked" badges
2. Past workouts should all show "Released" (auto-backfilled by the migration)
3. Future workouts created BEFORE this phase deployed are also "Released" if scheduled for today/past — same backfill
4. Future workouts you create AFTER this phase will default to "Locked"
5. Click "Release" → "Confirm" on a locked row → page refreshes → badge flips to "Released", button gone
6. Open a workout detail page (`/dashboard/workouts/[id]`) → see banner at top. Locked = crimson, Released = sage.

**As a player (with a locked workout):**
1. `/dashboard/my-workouts` → see "Locked" badge on your unreleased workout
2. CTA reads "Preview →"
3. Tap → mobile logger opens with a crimson "Locked" banner at top
4. Exercise list is visible (scroll to see) but no input fields, no log buttons, no chips for reps/RPE
5. Trainer releases the workout from their side
6. Refresh your page → banner is gone, input affordances appear, you can log normally

**As a player (with a released workout):**
1. Same flow as before, nothing changed

**As a player attempting to bypass the UI:**
1. Even crafting a direct request to `/api/...` or via the Supabase JS client wouldn't work — RLS rejects writes to `workout_exercise_sets` for unreleased parent activities

---

## Security / RLS detail

The tightened policy on `workout_exercise_sets`:

```sql
create policy "WorkoutSets: student writes own (released only)"
  on public.workout_exercise_sets
  for all
  using (
    public.is_self_student(student_id)
    and exists (
      select 1
        from public.workout_exercises we
        join public.activities a on a.id = we.activity_id
       where we.id = workout_exercise_sets.workout_exercise_id
         and a.released_at is not null
    )
  )
  with check (/* same predicate */);
```

The old "WorkoutSets: trainer-staff writes" policy is unchanged — staff don't need release-gating since they're managing the release themselves. A trainer can still pre-populate sets on a locked workout if they want to.

The `releaseWorkout` server action enforces three checks (defense in depth):
1. Caller's role must be `admin`, `director`, or `trainer` (`requireRole`)
2. Target activity must be of type `off_ice_workout`
3. Target activity must NOT already be released (Q5 = B)

---

## Known limits / cosmetic notes

- **Trainer can't undo a release.** If a workout is released by mistake, the only path is to delete the activity entirely and recreate. By design (Q5 = B). The horror scenario this prevents: trainer toggles off mid-session and players are locked mid-workout.
- **No bulk release.** Each workout needs its own "Release → Confirm" click. If a trainer has 6 workouts scheduled for tomorrow morning and wants to release them all at 5:30am from their phone, that's 12 taps. Tolerable; bulk release is a nice future addition.
- **The release date shown in the sage banner uses local timezone formatting** but the underlying timestamp is UTC. Minor display nuance, doesn't affect logic.
- **Coach role has no workout access in MESA currently**, so the "trainers + directors + admins" answer to Q9 effectively means "everyone with workout access plus trainers." No coach-facing implications.
- **Player sees "Locked" status only if they navigate** — there's no notification when the trainer releases. If you're using MESA with athletes who tend to refresh frequently (mobile users opening the app to check), this is fine. For passive users, deploying Phase 8 (Resend notifications) would later let you send "your workout is unlocked" messages.
- **The status badge appears in the row title area on both `/dashboard/workouts` (trainer view) and `/dashboard/my-workouts` (student view).** Consistent visual vocabulary — crimson dot = locked, sage dot = released.
- **The "Schedule workout" modal doesn't show a "Release immediately?" option.** Future-dated workouts start locked; trainer flips them later. If you want to ship a "create and immediately release" path, that's a small future addition.
- **Activity types other than `off_ice_workout` ignore the new columns.** Games and practices have `released_at` and `released_by` columns now (they live on `activities`) but nothing reads or writes them. No functional impact.

---

## Why this design (Q1 = B reasoning)

You picked **manual release** over date-based auto-unlock. Re-stating the case in case you want to revisit later:

- **Pro: trainer control.** Trainer can hold off releasing if the session got moved, if they're not ready, if they want to discuss something with the athletes first
- **Pro: no time zone bugs.** A workout doesn't unexpectedly unlock at midnight UTC for someone in Pacific time
- **Con: trainer must remember to release.** If forgotten, players can't log — leads to support calls
- **Con: small ongoing workload.** Each workout = one extra click

If the "trainer forgets to release" pattern becomes painful in production, the natural extension is to layer a date-based default underneath the manual override (Phase 16's Q1 = C). The columns we added support either model.

---

## Suggested next steps

- **Bulk-release UI** — pick multiple workouts in the list, release all
- **"Release now and notify" flow** — once Phase 8 (Resend) ships, optionally send a "your workout is ready" message on release
- **Hybrid date-default mode** — toggle per-trainer or per-academy: "auto-release on day-of unless I override"
- **Released-by audit display** — show "Released by [Name]" in addition to the date
- **Phase 8 notifications via Resend** — still gated on signup
- **Self-create workouts** for students (deferred from Phase 9)
- **Practice plan templates** leveraging the Phase 13 drill library
