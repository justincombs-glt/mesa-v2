-- ============================================================================
-- Phase 5a: CPT session recording
--
-- Enforces: only ONE baseline CPT session per (composite, season).
-- Trainers get RLS write access to cpt_sessions + performance_test_results.
--
-- No new tables — cpt_sessions + performance_test_results + is_baseline all
-- exist from earlier phases. This migration only adds constraints and
-- permission policies.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- One baseline per (composite, season) — partial unique index
-- ----------------------------------------------------------------------------

drop index if exists public.cpt_sessions_one_baseline_per_composite_season;

create unique index cpt_sessions_one_baseline_per_composite_season
  on public.cpt_sessions(composite_id, season_id)
  where is_baseline = true;

-- ----------------------------------------------------------------------------
-- Trainer access: ensure is_trainer() helper exists + update RLS
-- ----------------------------------------------------------------------------

create or replace function public.is_trainer()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'trainer'
  );
$$;

-- Replace CPT session write policy to include trainers
drop policy if exists "CPTSession: staff writes" on public.cpt_sessions;

create policy "CPTSession: staff writes"
  on public.cpt_sessions
  for all
  using (public.is_admin() or public.is_director() or public.is_trainer())
  with check (public.is_admin() or public.is_director() or public.is_trainer());

-- Allow trainers to write performance_test_results (existing policy may already allow)
drop policy if exists "PerfResults: staff writes" on public.performance_test_results;

create policy "PerfResults: staff writes"
  on public.performance_test_results
  for all
  using (public.is_admin() or public.is_director() or public.is_trainer())
  with check (public.is_admin() or public.is_director() or public.is_trainer());

-- ----------------------------------------------------------------------------
-- Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
