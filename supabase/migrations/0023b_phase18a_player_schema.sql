-- ============================================================================
-- Phase 18a — Step 2 of 2: Player role schema, functions, trigger
--
-- PREREQUISITE: 0023a_phase18a_player_enum.sql must have been Run in a
-- SEPARATE click first. This file references the 'player' enum value, which
-- requires that value to already be committed.
--
-- If you see the error 'unsafe use of new value "player" of enum type
-- app_role', it means 0023a wasn't committed before this file ran. Solution:
-- click Run on 0023a first, wait for success, then Run this file.
--
-- Adds:
--   - students.category column ('student' default, or 'player')
--   - is_player() and is_self_athlete() helper functions
--   - Trigger preventing Players from being added to practices or
--     trainer-scheduled workouts
--   - Updated handle_new_user() that links Player invites the same way
--     it links Student invites
--
-- Design choices locked in elicitation:
--   - Q1 = A: same students table, new category column
--   - Q8 = C: DB constraint prevents Players from being added to practices
--   - Q9 = C: DB constraint prevents Players from being added to
--             trainer-scheduled workouts (workouts where logged_by is NOT
--             the player themselves). Phase 18b will set logged_by = the
--             player's profile_id for self-created workouts.
--   - Q11 = C: existing rows backfilled to category='student' (no behavior
--              change for current academy students)
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add 'category' column on students with safe default
-- ----------------------------------------------------------------------------

alter table public.students
  add column if not exists category text not null default 'student';

-- Validate values via a check constraint so future writes can't insert
-- random strings. CHECK constraints don't support IF NOT EXISTS; use a DO
-- block.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_category_check'
  ) then
    alter table public.students
      add constraint students_category_check
      check (category in ('student', 'player'));
  end if;
end$$;

create index if not exists students_category_idx on public.students(category);

-- Backfill is implicit via the default 'student' on existing rows. No
-- explicit UPDATE needed.

-- ----------------------------------------------------------------------------
-- 2. Helper functions for role + category checks
-- ----------------------------------------------------------------------------

create or replace function public.is_player()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'player'
  )
$$;

-- A "self athlete" is either: a student whose linked profile is the caller,
-- OR a player whose linked profile is the caller. Used by RLS policies that
-- need to allow caller-owned writes regardless of category.
create or replace function public.is_self_athlete(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students s
     where s.id = sid and s.profile_id = auth.uid()
  )
$$;

-- ----------------------------------------------------------------------------
-- 3. DB-level exclusion: Players cannot be added to practices, nor to
--    off-ice workouts unless they themselves created the workout (Phase 18b
--    will be the path that creates self-logged workouts with
--    activities.logged_by = the player's profile_id).
--
--    Enforced via a trigger on activity_students INSERT/UPDATE.
-- ----------------------------------------------------------------------------

create or replace function public.check_player_activity_exclusion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
  v_activity_type public.activity_type;
  v_logged_by uuid;
  v_player_profile_id uuid;
begin
  -- Look up the student's category
  select category, profile_id into v_category, v_player_profile_id
    from public.students where id = new.student_id;

  -- If this isn't a Player, no restriction
  if v_category is null or v_category <> 'player' then
    return new;
  end if;

  -- Look up the activity type and who created it
  select activity_type, logged_by into v_activity_type, v_logged_by
    from public.activities where id = new.activity_id;

  -- Block: Players can never be on practices
  if v_activity_type = 'practice' then
    raise exception 'Players cannot be added to practices.'
      using errcode = 'check_violation';
  end if;

  -- Block: Players can only be on off-ice workouts they themselves created
  -- (i.e. activities.logged_by must equal the player's own profile_id)
  if v_activity_type = 'off_ice_workout' then
    if v_logged_by is null or v_player_profile_id is null
       or v_logged_by <> v_player_profile_id then
      raise exception 'Players cannot be added to trainer-scheduled workouts.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Games are fine — Phase 14 already supports household-created games for
  -- students and parents. Players use the same flow.

  return new;
end;
$$;

drop trigger if exists check_player_activity_exclusion_trg on public.activity_students;
create trigger check_player_activity_exclusion_trg
  before insert or update on public.activity_students
  for each row execute function public.check_player_activity_exclusion();

-- ----------------------------------------------------------------------------
-- 4. Update handle_new_user trigger to link Player invites
--    (Phase 12 added the linking for role='student'. Players use the same
--    students.profile_id mechanism since they ARE rows in the students
--    table — they just have category='player'.)
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_role public.app_role;
  v_count integer;
  v_dob date;
begin
  -- Check for pending invite matching this email
  select * into v_invite
  from public.invites
  where lower(email) = lower(new.email)
    and status = 'pending'
  order by created_at desc
  limit 1;

  if found then
    v_role := v_invite.role;
    update public.invites set status = 'consumed', consumed_at = now() where id = v_invite.id;
  else
    -- Hard-code Justin Combs as admin
    if lower(new.email) = 'justin.combs@gltconsulting.io' then
      v_role := 'admin';
    else
      -- If no profiles exist yet, this is the very first user → admin
      select count(*) into v_count from public.profiles;
      if v_count = 0 then
        v_role := 'admin';
      else
        -- Check DOB in user metadata for self-registered students
        v_dob := (new.raw_user_meta_data->>'date_of_birth')::date;
        if v_dob is not null then
          v_role := 'student';
        else
          v_role := 'parent';
        end if;
      end if;
    end if;
  end if;

  insert into public.profiles (id, email, full_name, role, date_of_birth)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    (new.raw_user_meta_data->>'date_of_birth')::date
  );

  -- Phase 18a: link to students record if invite specified one. Allowed for
  -- both 'student' and 'player' roles since both are rows in students table.
  if v_invite.id is not null
     and v_invite.linked_student_id is not null
     and v_invite.role in ('student', 'player') then
    update public.students
      set profile_id = new.id,
          updated_at = now()
      where id = v_invite.linked_student_id
        and (profile_id is null or profile_id = new.id);
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
