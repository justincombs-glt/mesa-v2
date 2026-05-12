-- ============================================================================
-- Phase 15b: Trainer view-only access to nutrition data
--
-- Adds SELECT-only RLS policies on nutrition_goals and nutrition_entries that
-- allow users with role='trainer' to read every student's nutrition data.
--
-- ACCESS MODEL CHANGE: Phase 15a was household-only. This phase widens reads
-- to include trainers. Writes remain household-only (parents + students only).
-- Other staff (coach, director, admin) remain excluded.
--
-- The existing "NutritionGoals: household read" and "NutritionEntries:
-- household read" policies stay — Postgres OR-combines RLS policies, so a
-- trainer reading their own student-child's record (if such an edge case
-- exists) still passes via either policy.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Trainer SELECT on nutrition_goals
-- ----------------------------------------------------------------------------

drop policy if exists "NutritionGoals: trainer read" on public.nutrition_goals;

create policy "NutritionGoals: trainer read"
  on public.nutrition_goals
  for select
  using (public.is_trainer());

-- ----------------------------------------------------------------------------
-- 2. Trainer SELECT on nutrition_entries
-- ----------------------------------------------------------------------------

drop policy if exists "NutritionEntries: trainer read" on public.nutrition_entries;

create policy "NutritionEntries: trainer read"
  on public.nutrition_entries
  for select
  using (public.is_trainer());

-- ----------------------------------------------------------------------------
-- NOTE on writes: NO new write policies for trainers. The existing household-
-- write policies on these tables do NOT include is_trainer(), so even if a
-- trainer somehow constructs an INSERT/UPDATE/DELETE request, RLS rejects it.
-- Server actions also enforce can_view_student which excludes trainers.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 3. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
