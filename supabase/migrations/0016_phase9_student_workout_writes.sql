-- ============================================================================
-- Phase 9: Student off-ice workout entry
--
-- Lets students log their own sets on workouts trainers have scheduled for
-- them. Surgical RLS change: adds a new INSERT/UPDATE/DELETE policy on
-- workout_exercise_sets allowing a student to write rows where the row's
-- student_id matches their own linked student record.
--
-- The existing "WorkoutSets: trainer-staff writes" policy is preserved.
-- Postgres RLS is permissive — if any policy passes, the operation is allowed.
-- So staff still writes everything; students additionally write their own.
--
-- No schema changes, no column additions, no helper function changes.
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Allow students to write their own sets
-- ----------------------------------------------------------------------------

drop policy if exists "WorkoutSets: student writes own" on public.workout_exercise_sets;

create policy "WorkoutSets: student writes own"
  on public.workout_exercise_sets
  for all
  using (public.is_self_student(student_id))
  with check (public.is_self_student(student_id));

-- ----------------------------------------------------------------------------
-- 2. Refresh PostgREST schema cache so the new policy takes effect immediately
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
