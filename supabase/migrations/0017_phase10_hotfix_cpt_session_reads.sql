-- ============================================================================
-- Phase 10 hotfix: cpt_sessions read for students/parents
--
-- Problem: a student opens their plan detail at /dashboard/my-goals/[planId]
-- and sees an attached composite ("Initial Baseline Test") but the row reads
-- "No sessions recorded yet" — even though sessions exist (visible to director).
--
-- Cause: cpt_sessions has only "CPTSession: staff reads" (is_staff()) on SELECT.
-- The student-facing page fetches sessions to populate baseline + progress
-- columns, gets 0 rows back because RLS blocks the read, and falls into the
-- "no sessions" empty state.
--
-- Fix: add a permissive SELECT policy that lets a student or parent read a
-- session row when the session's composite is attached to a goal plan they
-- have permission to view (via can_view_student on the plan's student_id).
--
-- The existing "CPTSession: staff reads" policy stays. Postgres RLS is
-- permissive — either policy passing allows the SELECT.
--
-- Note: students see only sessions for composites they actually have linked
-- via their plans. Sessions for OTHER students' composites remain invisible
-- (because the join filters by goal_plan_composites which respects its own RLS,
-- and even if it didn't, can_view_student gates which student rows match).
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Allow students/parents to read sessions for composites attached to their plans
-- ----------------------------------------------------------------------------

drop policy if exists "CPTSession: enrolled reads via plan" on public.cpt_sessions;

create policy "CPTSession: enrolled reads via plan"
  on public.cpt_sessions
  for select
  using (
    exists(
      select 1
      from public.goal_plan_composites gpc
      join public.goal_plans gp on gp.id = gpc.plan_id
      where gpc.composite_id = cpt_sessions.composite_id
        and public.can_view_student(gp.student_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Refresh PostgREST schema cache so the new policy takes effect immediately
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
