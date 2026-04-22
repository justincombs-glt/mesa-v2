-- ============================================================================
-- Phase 6a: Student & Parent dashboards — age gate enforcement
--
-- What this does:
--   1. Helper function student_under_13() used by createInvite action
--      to block inviting sub-13 students as users (Q2 = C: soft gate).
--   2. Ensures students RLS allows parents to read their linked children
--      (helpers: is_parent_of(student_id)) — already existed from 0006 as
--      can_view_student(); we keep behavior aligned.
--   3. Refreshes PostgREST schema cache.
--
-- No new tables. students.date_of_birth already exists (0006).
-- family_links already supports multi-parent (0006) via unique (parent_id, student_id)
-- with no "primary" constraint.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Age gate helper
-- ----------------------------------------------------------------------------

create or replace function public.student_under_13(p_student_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case
    when date_of_birth is null then false
    else date_of_birth > (current_date - interval '13 years')
  end
  from public.students
  where id = p_student_id;
$$;

-- ----------------------------------------------------------------------------
-- can_view_student() note
-- ----------------------------------------------------------------------------
-- The can_view_student(sid uuid) function already exists from migration 0006
-- and correctly handles admin/director/staff/self/parent visibility via
-- family_links. We intentionally do NOT recreate it here because:
--   1. Recreating with a renamed parameter would require DROP FUNCTION CASCADE,
--      which would drop every RLS policy that uses can_view_student() and
--      require re-creating all of those.
--   2. The existing function body already includes the parent-via-family_links
--      path we need.
-- Nothing to do — the function is already correct.

-- ----------------------------------------------------------------------------
-- Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
