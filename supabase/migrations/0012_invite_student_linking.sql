-- ============================================================================
-- Phase 6a hotfix: invite -> student linking
--
-- Problem: when admin invites a person with role=student AND picks a student
-- record to link to, the invite UI sends linked_student_id in the form data,
-- but:
--   1. The invites table has no linked_student_id column, so the value is
--      silently dropped.
--   2. The handle_new_user trigger only creates a profile; it never sets
--      students.profile_id on the linked student.
--
-- Result: invited student signs up, lands with a correct student-role account,
-- but no connection to their Student record. Their dashboard shows
-- "Your account isn't linked to a student record yet."
--
-- This migration:
--   1. Adds linked_student_id column to invites (nullable, FK to students.id).
--   2. Replaces handle_new_user() to consume linked_student_id on signup and
--      wire students.profile_id to the new auth user id.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. invites.linked_student_id
-- ----------------------------------------------------------------------------

alter table public.invites
  add column if not exists linked_student_id uuid references public.students(id) on delete set null;

create index if not exists invites_linked_student_idx on public.invites(linked_student_id);

-- ----------------------------------------------------------------------------
-- 2. handle_new_user trigger — link student.profile_id on invite consumption
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

  -- If the invite linked to a student record, wire that student.profile_id now.
  -- Only do this when the invite role was 'student' (defense-in-depth).
  if v_invite.id is not null
     and v_invite.linked_student_id is not null
     and v_invite.role = 'student' then
    update public.students
      set profile_id = new.id,
          updated_at = now()
      where id = v_invite.linked_student_id
        -- don't clobber an existing link (shouldn't happen, but paranoid)
        and (profile_id is null or profile_id = new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. Backfill: if any consumed invites have a linked_student_id but the
-- student isn't yet linked to a profile with a matching email, fix it now.
-- (This handles the case where this migration is run AFTER an invite was
-- already consumed for a student that should have been linked.)
-- ----------------------------------------------------------------------------

update public.students s
set profile_id = p.id,
    updated_at = now()
from public.invites i
join public.profiles p on lower(p.email) = lower(i.email)
where i.linked_student_id = s.id
  and i.status = 'consumed'
  and i.role = 'student'
  and s.profile_id is null;

-- ----------------------------------------------------------------------------
-- Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
