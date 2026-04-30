-- ============================================================================
-- Phase 7a: Per-student insights + automatic goal progress
--
-- What this does:
--   1. Adds linked_test_id and target_numeric to goal_plan_goals so goals can
--      automatically compute progress against a performance test.
--      (Q2 = C: automatic where data exists, manual fallback otherwise.)
--   2. Adds a SQL helper student_attendance_pct() that callers can use for
--      attendance percentage queries. Per-activity-type breakdowns are done
--      in TS for now since Postgres aggregation across enum values is doable
--      but a single function is simpler.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. goal_plan_goals: linked_test_id + target_numeric
-- ----------------------------------------------------------------------------

alter table public.goal_plan_goals
  add column if not exists linked_test_id uuid references public.performance_tests(id) on delete set null;

alter table public.goal_plan_goals
  add column if not exists target_numeric numeric;

create index if not exists goal_plan_goals_linked_test_idx
  on public.goal_plan_goals(linked_test_id);

-- ----------------------------------------------------------------------------
-- 2. SQL helper: student_attendance_pct(student_id, season_id) -> numeric
--
-- Returns attendance percentage (0-100) across all activities the student
-- was rostered on. NULL if no attendance recorded.
-- ----------------------------------------------------------------------------

create or replace function public.student_attendance_pct(
  p_student_id uuid,
  p_season_id uuid default null
)
returns numeric
language sql
security definer
stable
set search_path = public
as $$
  with relevant_activities as (
    select a.id
    from public.activities a
    join public.activity_students ast on ast.activity_id = a.id
    where ast.student_id = p_student_id
      and (p_season_id is null or a.season_id = p_season_id)
  ),
  attendance_data as (
    select att.attended
    from public.attendance att
    where att.student_id = p_student_id
      and att.activity_id in (select id from relevant_activities)
      and att.attended is not null
  )
  select case
    when count(*) = 0 then null
    else round(
      (count(*) filter (where attended = true))::numeric * 100.0
      / count(*)::numeric, 1
    )
  end
  from attendance_data;
$$;

-- ----------------------------------------------------------------------------
-- 3. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
