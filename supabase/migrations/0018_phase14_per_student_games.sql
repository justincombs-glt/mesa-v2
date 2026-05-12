-- ============================================================================
-- Phase 14: Per-student game scheduling + review tracking
--
-- Background: until now, games were a team-level event — one activity with
-- multiple students linked via activity_students. Going forward, each parent
-- and 13+ student can schedule games for themselves with a single linked
-- student per game. Multi-student games created previously continue to work
-- (backward compatible); new games created through parent/student flows are
-- single-student.
--
-- This migration adds:
--   1. New columns on `activities` for review tracking (Q7=C composite)
--   2. New columns on `game_stats` for split performance notes (Q9=B arrays)
--   3. New RLS policies that let parents/students write to their own games
--      while keeping staff-only locks on the review flag (Q8=A)
--
-- All changes are additive — existing policies remain.
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ACTIVITIES — review tracking columns
--    Q7=C: composite (boolean flag + when + by whom)
-- ----------------------------------------------------------------------------

alter table public.activities
  add column if not exists reviewed_with_player boolean not null default false;

alter table public.activities
  add column if not exists reviewed_at timestamptz;

alter table public.activities
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 2. GAME_STATS — split performance notes into positive + improvement arrays
--    Q9=B: text array, each element is one bullet point
--    Existing `notes` text column is preserved for backward compatibility
-- ----------------------------------------------------------------------------

alter table public.game_stats
  add column if not exists positive_notes text[];

alter table public.game_stats
  add column if not exists improvement_notes text[];

-- ----------------------------------------------------------------------------
-- 3. RLS POLICIES — widen writes for parents/students
--    Strategy: parents/students can write where they have can_view_student on
--    the relevant student. For activities, we scope by activities.logged_by
--    = auth.uid() so the creator owns the row. Other household members can
--    edit via the can_view_student route. Staff retain full write access.
-- ----------------------------------------------------------------------------

-- 3a. activities: allow parent/student to INSERT games they're creating
-- (their student gets linked in activity_students immediately after)

drop policy if exists "Activity: household writes games" on public.activities;

create policy "Activity: household writes games"
  on public.activities
  for all
  using (
    -- Anyone (parent/student/staff) can edit games they created
    activities.logged_by = auth.uid()
    -- OR anyone can edit games involving a student they can view
    -- (parent updating sibling's game, etc.)
    or exists (
      select 1 from public.activity_students ast
      where ast.activity_id = activities.id
        and public.can_view_student(ast.student_id)
    )
  )
  with check (
    -- For INSERT: creator must be the calling user
    -- (activity_students gets inserted in same transaction, RLS for that
    -- checked separately by the linking insert)
    activities.logged_by = auth.uid()
    -- For UPDATE: keep the same can_view_student route
    or exists (
      select 1 from public.activity_students ast
      where ast.activity_id = activities.id
        and public.can_view_student(ast.student_id)
    )
  );

-- 3b. activity_students: allow parent/student to INSERT roster row linking
-- their student to a game they just created

drop policy if exists "ActivityStudents: household writes" on public.activity_students;

create policy "ActivityStudents: household writes"
  on public.activity_students
  for all
  using (public.can_view_student(student_id))
  with check (public.can_view_student(student_id));

-- 3c. game_stats: widen writes from coach-staff-only to include
-- can_view_student (so parents/students can record their own stats)

drop policy if exists "GameStats: household writes" on public.game_stats;

create policy "GameStats: household writes"
  on public.game_stats
  for all
  using (public.can_view_student(student_id))
  with check (public.can_view_student(student_id));

-- NOTE: The existing "GameStats: coach-staff writes" policy stays. Multiple
-- write policies OR-combine in Postgres RLS, so coach/director/admin keep
-- their access via the old policy, and parents/students get access via the
-- new one.

-- ----------------------------------------------------------------------------
-- 4. SAFETY — review flag is staff-only
--    Q8=A: only admin/director/coach can flip reviewed_with_player to true.
--    Strategy: enforce in server action (we can't easily column-level RLS
--    in stock Postgres). The action that toggles the flag will call
--    requireRole('admin', 'director', 'coach'). Parents/students editing other
--    fields use a different action that explicitly leaves the flag alone.
-- ----------------------------------------------------------------------------

-- (No database-level enforcement of the staff-only review flag — handled in
--  application code. Adding column-level RLS would require splitting the
--  activities table or using triggers; out of scope for this phase.)

-- ----------------------------------------------------------------------------
-- 5. STUDENTS — allow parent/student to update team_label
--    Q3=D: parents update via family detail, 13+ students update via own profile
--    Strategy: widen UPDATE permission to can_view_student. The server action
--    that handles parent-side edits restricts WHICH columns can change
--    (just team_label) so they can't accidentally rename the student or
--    change their position. Staff retain full UPDATE via existing policy.
-- ----------------------------------------------------------------------------

drop policy if exists "Student: household updates" on public.students;

create policy "Student: household updates"
  on public.students
  for update
  using (public.can_view_student(id))
  with check (public.can_view_student(id));

-- ----------------------------------------------------------------------------
-- 6. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
