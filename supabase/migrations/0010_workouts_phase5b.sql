-- ============================================================================
-- Phase 5b: Workout plan extensions + scheduled workouts
--
-- What this does:
--   1. Extends workout_plan_items with more target fields (weight, duration, rest)
--      — matches the practice_plan_items flexibility and supports Q1 = A
--      (sets + reps + weight + duration + notes, all optional)
--   2. Ensures RLS policies are trainer-friendly (they mostly are already via
--      is_staff(), but we replace the ones that used narrower checks)
--   3. Refreshes PostgREST schema cache
--
-- No new tables — workout_plans, workout_plan_items, activities (for
-- scheduled workouts), workout_exercises, and workout_exercise_sets all
-- exist from 0006.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extend workout_plan_items with more target fields
-- ----------------------------------------------------------------------------

alter table public.workout_plan_items
  add column if not exists default_weight_lbs numeric;

alter table public.workout_plan_items
  add column if not exists default_duration_seconds integer;

alter table public.workout_plan_items
  add column if not exists default_rest_seconds integer;

-- ----------------------------------------------------------------------------
-- RLS policies for workouts (ensure trainer reads/writes work)
-- ----------------------------------------------------------------------------

-- Workout exercises — trainer can already write via is_staff() in 0006,
-- but be explicit: replace the existing staff-writes policy to use is_staff()
drop policy if exists "WorkoutExercises: trainer-staff writes" on public.workout_exercises;
create policy "WorkoutExercises: trainer-staff writes"
  on public.workout_exercises
  for all
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "WorkoutSets: trainer-staff writes" on public.workout_exercise_sets;
create policy "WorkoutSets: trainer-staff writes"
  on public.workout_exercise_sets
  for all
  using (public.is_staff())
  with check (public.is_staff());

-- ----------------------------------------------------------------------------
-- Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
