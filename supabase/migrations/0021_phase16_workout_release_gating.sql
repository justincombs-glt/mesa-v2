-- ============================================================================
-- Phase 16: Workout release gating
--
-- Adds the ability for trainers/directors/admins to "release" a scheduled
-- off-ice workout, which is the gate that allows students to begin logging
-- their sets. Until released, the student sees the workout in read-only
-- preview mode (Q2 = B / Q3 = B).
--
-- Design choices locked in elicitation:
--   - Q1 = B: pure manual release (no auto-unlock by date)
--   - Q5 = B: release is irreversible — once set, stays set
--   - Q7 = B: existing past/today workouts auto-released by this migration;
--             future-dated workouts start locked
--   - Q9 = B: trainers, directors, admins can release (not coaches)
--
-- Schema additions:
--   - activities.released_at   timestamptz nullable — when the workout was
--                                                    released; NULL = locked
--   - activities.released_by   uuid       nullable — who released it
--
-- The "released" state applies only to activities where activity_type =
-- 'off_ice_workout'. The column exists on all activities for schema
-- simplicity, but games/practices/etc. ignore it.
--
-- RLS change: the student-write policy on workout_exercise_sets is tightened
-- so a student can only INSERT/UPDATE/DELETE their own sets if the parent
-- activity is released (released_at IS NOT NULL). Trainer/staff writes are
-- unchanged.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New columns on activities
-- ----------------------------------------------------------------------------

alter table public.activities
  add column if not exists released_at timestamptz,
  add column if not exists released_by uuid references public.profiles(id) on delete set null;

create index if not exists activities_released_at_idx
  on public.activities(released_at)
  where activity_type = 'off_ice_workout';

-- ----------------------------------------------------------------------------
-- 2. Backfill: existing past or today-scheduled workouts are auto-released
--    (Q7 = B). Only updates rows that haven't already been touched.
-- ----------------------------------------------------------------------------

update public.activities
  set released_at = now()
  where activity_type = 'off_ice_workout'
    and occurred_on <= current_date
    and released_at is null;

-- ----------------------------------------------------------------------------
-- 3. Tighten the Phase 9 student-write RLS policy on workout_exercise_sets
--
--    Old policy: student can write rows where student_id = their own
--    New policy: student can write rows where student_id = their own
--                AND the parent activity is released
--
--    Trainer/staff writes are governed by a separate policy and unchanged.
-- ----------------------------------------------------------------------------

drop policy if exists "WorkoutSets: student writes own" on public.workout_exercise_sets;

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
  with check (
    public.is_self_student(student_id)
    and exists (
      select 1
        from public.workout_exercises we
        join public.activities a on a.id = we.activity_id
       where we.id = workout_exercise_sets.workout_exercise_id
         and a.released_at is not null
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
