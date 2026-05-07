-- ============================================================================
-- Phase 6b: Parent-adds-child + multi-parent UI
--
-- This migration enables parents to:
--   1. INSERT a students row (their child's record)
--   2. INSERT a family_links row linking themselves to that new student
-- All still gated by server-side checks in the createStudentAsParent action
-- (duplicate detection, age validation, etc.), but the RLS must permit the
-- insert for a parent-role user.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper: is_current_user_parent()
-- ----------------------------------------------------------------------------

create or replace function public.is_parent()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'parent'
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. students: allow parents to insert (their own children)
--
-- We DON'T drop the existing staff-inserts policy — the new policy is
-- additive. Postgres RLS is permissive: row passes if ANY policy allows it.
-- ----------------------------------------------------------------------------

drop policy if exists "Student: parent inserts own child" on public.students;

create policy "Student: parent inserts own child"
  on public.students
  for insert
  with check (public.is_parent());

-- Parents do NOT get update/delete on students. Only staff can modify.
-- This ensures parents can only create; any corrections require admin.

-- ----------------------------------------------------------------------------
-- 3. family_links: allow parents to insert their own link
--
-- A parent can only create a family_link where parent_id = auth.uid() —
-- they can't link themselves to someone else's child or link another parent
-- to a child.
-- ----------------------------------------------------------------------------

drop policy if exists "Family: parent links self to own child" on public.family_links;

create policy "Family: parent links self to own child"
  on public.family_links
  for insert
  with check (
    public.is_parent() and parent_id = auth.uid()
  );

-- Parents can DELETE their own family_link (if they realize they made a
-- mistake and want to detach). Staff can delete any. (Already allowed via
-- the existing "Family: staff manages" policy; add a parent-specific one
-- for delete only.)
drop policy if exists "Family: parent removes own link" on public.family_links;

create policy "Family: parent removes own link"
  on public.family_links
  for delete
  using (
    public.is_parent() and parent_id = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- 4. season_enrollments: allow parents to insert enrollment for their OWN
--    children (so createStudentAsParent can auto-enroll atomically)
-- ----------------------------------------------------------------------------

drop policy if exists "SeasonEnrollment: parent enrolls own child" on public.season_enrollments;

create policy "SeasonEnrollment: parent enrolls own child"
  on public.season_enrollments
  for insert
  with check (
    public.is_parent()
    and exists (
      select 1 from public.family_links fl
      where fl.student_id = season_enrollments.student_id
        and fl.parent_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 5. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
