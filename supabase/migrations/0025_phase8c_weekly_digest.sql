-- ============================================================================
-- Phase 8c: weekly digest notifications
--
-- Adds two tables:
--   1. notification_settings — per-user digest on/off + unsubscribe token
--   2. digest_sends           — log of attempted digest sends for auditing
--
-- Design notes:
--   - Default digest_enabled = TRUE for all new + existing users
--   - unsubscribe_token is random; used in email footer for one-click unsubscribe
--   - On user creation (handle_new_user), a settings row is auto-created via
--     the updated trigger below
--   - digest_sends records: success | skipped_empty | skipped_disabled | error
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. notification_settings table
-- ----------------------------------------------------------------------------

create table if not exists public.notification_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  digest_enabled boolean not null default true,
  unsubscribe_token text not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notification_settings_token_idx
  on public.notification_settings(unsubscribe_token);

alter table public.notification_settings enable row level security;

drop policy if exists "notif_settings: self read" on public.notification_settings;
create policy "notif_settings: self read"
  on public.notification_settings for select
  using (profile_id = auth.uid());

drop policy if exists "notif_settings: self update" on public.notification_settings;
create policy "notif_settings: self update"
  on public.notification_settings for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- No INSERT policy: rows are created only via handle_new_user trigger
-- (SECURITY DEFINER bypasses RLS) or via the backfill below.

-- ----------------------------------------------------------------------------
-- 2. Backfill rows for existing users
-- ----------------------------------------------------------------------------

insert into public.notification_settings (profile_id)
select id from public.profiles
where id not in (select profile_id from public.notification_settings)
on conflict (profile_id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. digest_sends log table
-- ----------------------------------------------------------------------------

create table if not exists public.digest_sends (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  range_start date not null,
  range_end date not null,
  status text not null check (status in ('success', 'skipped_empty', 'skipped_disabled', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists digest_sends_profile_idx
  on public.digest_sends(profile_id, sent_at desc);

alter table public.digest_sends enable row level security;

-- Users see their own send log; staff see all. No write policy
-- (the cron endpoint writes via SECURITY DEFINER context).
drop policy if exists "digest_sends: self+staff read" on public.digest_sends;
create policy "digest_sends: self+staff read"
  on public.digest_sends for select
  using (profile_id = auth.uid() or public.is_staff());

-- ----------------------------------------------------------------------------
-- 4. Updated handle_new_user — create notification_settings row on signup
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
  -- Find pending invite for this email
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
      -- If no profiles exist yet, first user becomes admin
      select count(*) into v_count from public.profiles;
      if v_count = 0 then
        v_role := 'admin';
      else
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

  -- Phase 18a: link to students row if invite specified one
  if v_invite.id is not null
     and v_invite.linked_student_id is not null
     and v_invite.role in ('student', 'player') then
    update public.students
      set profile_id = new.id,
          updated_at = now()
      where id = v_invite.linked_student_id
        and (profile_id is null or profile_id = new.id);
  end if;

  -- Phase 8c: create notification settings row with default opt-in.
  -- on conflict do nothing so manual re-creates won't error.
  insert into public.notification_settings (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
