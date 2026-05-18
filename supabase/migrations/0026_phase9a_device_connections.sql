-- ============================================================================
-- Phase 9a: wearable device OAuth connections
--
-- Stores OAuth tokens for users who connect a wearable device (Google Health /
-- Fitbit in v1; Whoop later). Tokens are encrypted at the application layer
-- before being inserted — the DB only ever sees ciphertext. The decryption key
-- lives in the DEVICE_TOKEN_ENCRYPTION_KEY env var; without it, the columns
-- below are useless.
--
-- One row per (profile_id, provider). When a user reconnects, the existing row
-- is updated rather than a new one inserted.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. user_device_connections table
-- ----------------------------------------------------------------------------

create table if not exists public.user_device_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google_health', 'whoop')),

  -- Identity from the device platform; useful for debugging and webhook routing
  external_user_id text,

  -- Encrypted tokens (AES-256-GCM, base64-encoded ciphertext+IV+auth_tag).
  -- Plaintext NEVER stored. See lib/devices/encryption.ts for the format.
  access_token_encrypted text,
  refresh_token_encrypted text,

  -- When the access token expires. Refresh ~5 minutes before this.
  expires_at timestamptz,

  -- Scopes granted (what we requested AND what the user actually consented to)
  scopes text[] not null default array[]::text[],

  -- Lifecycle timestamps
  connected_at timestamptz not null default now(),
  last_refresh_at timestamptz,

  -- Connection health
  status text not null default 'connected'
    check (status in ('connected', 'reconnect_needed', 'revoked')),

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One connection per provider per user. To reconnect, we update; not insert.
  unique (profile_id, provider)
);

create index if not exists user_device_connections_profile_idx
  on public.user_device_connections(profile_id);

-- ----------------------------------------------------------------------------
-- 2. RLS
-- ----------------------------------------------------------------------------

alter table public.user_device_connections enable row level security;

-- Users see their OWN connection rows. Nothing else.
drop policy if exists "device_conn: self read" on public.user_device_connections;
create policy "device_conn: self read"
  on public.user_device_connections for select
  using (profile_id = auth.uid());

-- Users can delete their own connection (disconnect flow).
drop policy if exists "device_conn: self delete" on public.user_device_connections;
create policy "device_conn: self delete"
  on public.user_device_connections for delete
  using (profile_id = auth.uid());

-- INSERT/UPDATE only via SECURITY DEFINER backends (the OAuth callback route
-- runs with the user's session, but token encryption / storage happens
-- server-side via service-role context). No user-level write policy.

-- ----------------------------------------------------------------------------
-- 3. updated_at trigger
-- ----------------------------------------------------------------------------

create or replace function public.touch_device_connection_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_device_connection on public.user_device_connections;
create trigger trg_touch_device_connection
  before update on public.user_device_connections
  for each row execute function public.touch_device_connection_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
