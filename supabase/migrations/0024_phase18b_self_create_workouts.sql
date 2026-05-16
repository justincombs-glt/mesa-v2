-- ============================================================================
-- Phase 18b: Self-create off-ice workouts
--
-- Only one schema-level change is needed: widen the workout_exercises write
-- policy so the activity's creator (typically a Player or self-logging
-- Student) can INSERT/UPDATE/DELETE the exercise rows on their own workout.
--
-- The Phase 9 read policy + the Phase 16 student-write-sets policy already
-- handle the rest of the flow correctly:
--   - Player reads their own workout → "WorkoutExercises: enrolled reads"
--   - Player logs sets → tightened student-write policy from Phase 16 (only
--     when released_at IS NOT NULL — self-created workouts set released_at =
--     now() at creation time, so this passes immediately)
--
-- The Phase 18a trigger on activity_students already permits the Player to
-- be added to their own self-created workout (because logged_by =
-- player.profile_id), so the existing roster-insert path works too.
--
-- The activities INSERT policy was already widened in Phase 14 to allow
-- "activities.logged_by = auth.uid()" for household game creation — this
-- same predicate now serves self-created workouts too.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

drop policy if exists "WorkoutExercises: trainer-staff writes" on public.workout_exercises;
drop policy if exists "WorkoutExercises: creator-or-staff writes" on public.workout_exercises;

create policy "WorkoutExercises: creator-or-staff writes"
  on public.workout_exercises
  for all
  using (
    public.is_staff()
    or exists (
      select 1 from public.activities a
       where a.id = workout_exercises.activity_id
         and a.logged_by = auth.uid()
    )
  )
  with check (
    public.is_staff()
    or exists (
      select 1 from public.activities a
       where a.id = workout_exercises.activity_id
         and a.logged_by = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
