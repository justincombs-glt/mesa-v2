# MESA v2 — Phase 9: Student Off-Ice Workout Entry

**Status:** Ready to deploy
**SQL migration required:** `0016_phase9_student_workout_writes.sql` — adds one RLS policy. Idempotent.

Students can now log their own sets on off-ice workouts that trainers have scheduled for them. They use the same mobile-optimized workout logger from Phase Mb (chip-style reps + RPE pickers, decimal weight keyboard, save-on-Next-set workflow), but in a simplified single-athlete mode that hides multi-roster trainer features.

Per Q1 = B (final scope after revisiting): students log to **existing scheduled workouts only**. They cannot self-create workouts. The trainer still owns workout creation and exercise selection. The student logs what they actually did.

---

## What shipped

### Mobile workout logger now accepts students
The route `/dashboard/workouts/[id]/mobile` (originally trainer-only from Phase Mb) is widened to allow `student` role. The page detects student role and:
- Looks up the student's own student record (via `students.profile_id = auth.uid()`)
- Verifies they're on the workout's roster — if not, redirects to dashboard
- Filters the displayed roster to JUST themselves (Q10 = A — never see other athletes' data)
- Filters the set fetch query to JUST their own student_id (defense in depth + smaller payload)
- Passes a `studentMode={true}` flag to the logger client component

### Logger UX adjustments for student mode
The same `<MobileWorkoutLogger>` component renders differently when `studentMode` is true:
- **No "Athletes · N/M" header bar** — only one athlete, redundant
- **No "Hide absent" toggle** — only one athlete
- **No "Mark absent" button** in the set entry form — students don't mark themselves absent (Q11 — parents/absent flow out of scope)
- **Athlete card auto-expands** to the form — the student doesn't have to tap to start; the form is visible immediately on landing
- **No chevron** on the card header — there's nothing to collapse to
- **Header is unclickable in student mode** — prevents accidental collapse
- **Set delete buttons conditionally hidden** when student is on a multi-athlete workout (Q7 = C) — students can only delete their own sets when they're the only athlete on the workout. On multi-athlete workouts, students can add but not delete (avoids the case where a student deletes a set someone else just looked at).

### Student dashboard surfaces workouts
The existing `<StudentDashboardView>` was already showing upcoming and recent activities. Now off-ice workout rows in those lists are tappable:
- Row routes to `/dashboard/workouts/[id]/mobile` for that workout
- Hover/active state highlights the row
- "Log →" indicator appears on the right
- Practices and games remain non-tappable (no logging surface for those)
- Parent view (parent looking at their child's dashboard) does NOT get tappable rows — read-only as before

### New `/dashboard/my-workouts` page
Student sidebar gets a new "My Workouts" item routing to `/dashboard/my-workouts`:
- Lists all off-ice workouts the student is rostered into for the current season
- Split into Upcoming and Past sections
- Each row shows date, title, focus, and "N sets logged" status
- Tap any row → routes to the mobile logger for that workout
- Empty state if no workouts scheduled
- Empty state if account isn't linked to a student record (with helpful guidance)

### Q9 = C: students get the mobile route, not desktop
Students hitting the desktop URL `/dashboard/workouts/[id]` get auto-redirected to `/dashboard/workouts/[id]/mobile`. Other unauthorized roles bounce to `/dashboard` as before.

The desktop view (the trainer-style wide grid) is now strictly trainer/admin/director.

### RLS migration (the database change)
`0016_phase9_student_workout_writes.sql` adds one new policy:

```sql
create policy "WorkoutSets: student writes own"
  on public.workout_exercise_sets
  for all
  using (public.is_self_student(student_id))
  with check (public.is_self_student(student_id));
```

This **adds** to the existing `WorkoutSets: trainer-staff writes` policy. Postgres RLS is permissive — if any policy passes, the operation is allowed. So:
- Staff still write all rows (unchanged)
- Students additionally write rows where the row's `student_id` corresponds to a student record where `profile_id = auth.uid()` — i.e., their own data only

Read access doesn't change — students could already SELECT their own sets via the existing `WorkoutSets: reads if can view student` policy.

The `is_self_student(sid)` helper function already existed; no helper changes needed.

### What did NOT change
- `workout_exercises` write policy stays staff-only (students can't add exercises to workouts)
- `activities` write policy stays staff-only (students can't create or modify workout records)
- `activity_students` stays staff-only (students can't add themselves to workouts)
- The `upsertWorkoutSet` and `deleteWorkoutSet` server actions are unchanged — they only check authentication and rely on RLS for permission, which is exactly the layer where students are now allowed
- Coach, parent, admin, director sidebars — unchanged
- Phase Mb workflow for trainers — unchanged (the logger renders identically when role !== student)

---

## Files added/changed

**New:**
- supabase/migrations/0016_phase9_student_workout_writes.sql — adds the student-write RLS policy
- app/dashboard/my-workouts/page.tsx — new student-only list page with sidebar entry
- PHASE-9-README.md

**Changed:**
- app/dashboard/workouts/[id]/mobile/page.tsx — widens role check to include student; resolves self student record; filters roster + sets; computes `isSoleAthlete` for delete permission; passes `studentMode` and `canDeleteSets` props; varies exit href based on role
- app/dashboard/workouts/[id]/mobile/MobileWorkoutLogger.tsx — adds `studentMode` and `canDeleteSets` props; auto-expands single athlete card in student mode; hides Athletes header / Hide absent / Mark absent / chevron; passes `canDelete` through to set history rows
- app/dashboard/workouts/[id]/page.tsx — replaces `requireRole(...)` with manual role check that redirects students to `/mobile` route for that workout
- components/student/StudentDashboardView.tsx — `<ActivityRow>` accepts `allowLog` prop; off-ice workout rows become `<Link>` to mobile logger when `allowLog && !isParentView`
- components/layout/AppShell.tsx — adds "My Workouts" item to student sidebar

**Files to delete from GitHub:** none.

**Actions**: 87 total. **No new actions.** No action changes — `upsertWorkoutSet` / `deleteWorkoutSet` work for students by virtue of the new RLS policy.

---

## Database

**Migration: `0016_phase9_student_workout_writes.sql`**

Run this in Supabase SQL Editor BEFORE deploying the code. It's idempotent (uses `drop policy if exists` then `create`), so you can re-run safely.

```sql
drop policy if exists "WorkoutSets: student writes own" on public.workout_exercise_sets;

create policy "WorkoutSets: student writes own"
  on public.workout_exercise_sets
  for all
  using (public.is_self_student(student_id))
  with check (public.is_self_student(student_id));

notify pgrst, 'reload schema';
```

After running, verify the policy exists:

```sql
select policyname, cmd, qual, with_check
from pg_policies
where tablename = 'workout_exercise_sets'
order by policyname;
```

You should see TWO write policies (the existing `trainer-staff writes` and the new `student writes own`) plus the existing read policy.

---

## Deploy steps

1. Run the SQL migration in Supabase SQL Editor (paste the contents of `0016_phase9_student_workout_writes.sql`)
2. Verify the policy was created (query above)
3. Unzip `mesa-v2-phase-9-clean.zip`
4. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
5. Commit: `Phase 9: Student off-ice workout entry`
6. Vercel auto-deploys ~90s
7. Hard refresh

---

## How to test

### Setup
Need:
- A student-role user account (or use admin's link tool from Phase R.5 to link a student-role profile to a student record)
- An off-ice workout in the current season with this student rostered onto it
- That workout has at least one exercise planned by the trainer
- (Optional) A second student also rostered onto the same workout to test the multi-athlete delete blocking

### 1. Sidebar item
1. Sign in as the student
2. Sidebar shows: Home, **My Workouts**, My Goals, My Performance, User Profile
3. Tap "My Workouts" → routes to `/dashboard/my-workouts`

### 2. My Workouts list page
1. Page shows Upcoming and Past sections
2. Each row shows date, title, "N sets logged" status, and "Log →" indicator
3. Tap any row → routes to the mobile logger

### 3. Mobile logger as student
1. Land at `/dashboard/workouts/[id]/mobile`
2. Top bar shows back arrow + workout title (back arrow goes to `/dashboard`)
3. Exercise pills row visible
4. **No "Athletes · N/M" header**
5. Single card visible with the student's own name (auto-expanded showing the form)
6. **No chevron** on the card header (it's not collapsible)
7. Form shows: Weight (decimal keyboard), Reps (chips + Other), RPE (chips 1-10)
8. **No "Mark absent" button**
9. Type weight → tap reps chip → tap RPE chip → tap "Next set →"
10. Set saves; form clears; card stays expanded; new set appears in history above
11. Type a few more sets — workflow same as Phase Mb
12. Tap "Next exercise →" footer → advances to next exercise; card stays expanded

### 4. Set deletion behavior (Q7 = C)
Three sub-cases:

**Case A — student is sole athlete on workout:**
1. After logging a set, history row shows it
2. Trash button is visible on each set
3. Tap trash → confirm → deleted

**Case B — student on a multi-athlete workout:**
1. Same workout but with another student also rostered
2. After logging a set, history shows it
3. **Trash button is HIDDEN** — students can't delete sets when others are on the roster
4. To fix mistakes, the student would need to ask the trainer to delete (or trainer takes care of it)

### 5. Privacy: students can't see others' data (Q10 = A)
1. As student, on a multi-athlete workout
2. Only see your own card; other rostered athletes don't appear
3. Set fetch only returns your own sets — even if RLS were misconfigured, the page-level filter ensures you don't accidentally see anyone else
4. Try to manually navigate to a workout you're NOT rostered on → redirected to dashboard

### 6. Dashboard tappable rows
1. Sign in as student → land on `/dashboard`
2. Upcoming and Recent activity lists shown
3. Off-ice workout rows are tappable (hover state + "Log →" indicator)
4. Practice rows and game rows are NOT tappable
5. Tap an off-ice workout → routes to `/mobile` for that workout

### 7. Desktop URL redirect (Q9 = C)
1. As student, manually paste `/dashboard/workouts/[some-workout-id]` into the URL bar
2. Get redirected to `/dashboard/workouts/[some-workout-id]/mobile`
3. The desktop view never renders for students

### 8. Parent view
1. Sign in as a parent of a student
2. Open the family child detail (where StudentDashboardView renders in `isParentView` mode)
3. Activity rows are NOT tappable, NO "Log →" indicators
4. Parents are read-only viewers (Q11 = A — out of scope for this phase)

### 9. Trainer logger unchanged
1. Sign in as trainer → open the same workout via `/dashboard/workouts/[id]`
2. Tap "Mobile mode →"
3. See multi-athlete cards as before
4. Hide absent toggle works, mark absent works
5. Set deletion works as before
6. Workflow identical to Phase Mb

### 10. Edge case: student account not linked
1. Sign in as a student-role user whose profile isn't linked to any student record
2. On `/dashboard/my-workouts`: empty-state card with guidance
3. On `/dashboard/workouts/[id]/mobile` (if they manually try): redirected to `/dashboard`

---

## Known limits / cosmetic notes

- **No `entered_by` audit** (Q6 = A). The system doesn't track whether a set was logged by the trainer or by the student. If you ever need to know who entered a particular set, that's a future enhancement (would require a column + behavior changes).
- **Students can't add notes to sets via mobile** — same as Phase Mb. The set summary shows wt/reps/RPE only. Notes can be added via the desktop view (which students don't have access to).
- **No real-time sync** — if a trainer logs a set for a student WHILE the student has the page open, the student needs to refresh to see it. Same as the rest of the app.
- **The "Athletes · 1/1" indicator visible to trainer on a single-student workout might look weird** — but in practice trainer workouts have 5+ athletes. Not worth optimizing for now.
- **Students can technically delete sets a trainer logged FOR them when they're the sole athlete** — Q7 = C explicitly allowed this. If the trainer logged something the student wants to override, the student can delete and re-add. Works in practice; trainer can scold student if they abuse it.
- **Only off-ice workouts get the "Log →" affordance on the dashboard.** Practices and games show in the activity lists but aren't tappable, since there's no student-side logging path for those.

---

## Next phase candidates

- **`entered_by` tracking** — if you want audit trail for "who logged this set"
- **Per-set notes on mobile** — small UX enhancement
- **Self-create workouts (the original Q1=C)** — would require building `activities` INSERT permission for students + UI for picking exercises from the academy library + new page surfaces
- **Phase 8 (notifications)** — still gated on Resend signup
- **Apple Health webhook** — auto-import workout data instead of manual entry
