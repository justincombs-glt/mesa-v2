-- ============================================================================
-- Phase 9b: device metrics storage + pull audit log
--
-- Adds three things:
--   1. activities.duration_minutes column - coach sets practice duration when
--      creating; used to define the time window for device data pulls.
--      Defaults to 90 minutes for existing rows so the cron can still pull.
--   2. practice_device_metrics - one row per (activity, student, provider)
--      with derived metrics (HR avg/max, zones, calories, duration).
--   3. practice_device_pull_attempts - audit log of every pull attempt for
--      debugging.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. activities.duration_minutes
-- ----------------------------------------------------------------------------

alter table public.activities
  add column if not exists duration_minutes integer;

-- Backfill existing rows: default 90 minutes if null
update public.activities
   set duration_minutes = 90
 where duration_minutes is null
   and activity_type = 'practice';

-- ----------------------------------------------------------------------------
-- 2. practice_device_metrics
-- ----------------------------------------------------------------------------

create table if not exists public.practice_device_metrics (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  provider text not null check (provider in ('google_health', 'whoop')),

  -- Derived metrics
  avg_hr integer,
  max_hr integer,
  min_hr integer,
  duration_minutes integer,
  calories integer,

  -- HR zone minutes (Fitbit-style)
  zone_out_of_range_min integer,
  zone_fat_burn_min integer,
  zone_cardio_min integer,
  zone_peak_min integer,

  -- Provider-specific bonus fields (null when not applicable)
  strain_score numeric,  -- Whoop only

  -- Bookkeeping
  pulled_at timestamptz not null default now(),
  source_window_start timestamptz not null,
  source_window_end timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One metrics row per athlete per practice per provider.
  -- Repeated pulls update the row; not insert.
  unique (activity_id, student_id, provider)
);

create index if not exists practice_device_metrics_activity_idx
  on public.practice_device_metrics(activity_id);
create index if not exists practice_device_metrics_student_idx
  on public.practice_device_metrics(student_id, pulled_at desc);

alter table public.practice_device_metrics enable row level security;

-- Athletes see their own metrics; parents see their kids' metrics; staff see all
drop policy if exists "device_metrics: athlete/parent/staff read"
  on public.practice_device_metrics;
create policy "device_metrics: athlete/parent/staff read"
  on public.practice_device_metrics for select
  using (
    -- Athlete reads their own metrics
    student_id in (
      select s.id from public.students s where s.profile_id = auth.uid()
    )
    -- Parent reads their kids' metrics
    or student_id in (
      select fl.student_id from public.family_links fl where fl.parent_id = auth.uid()
    )
    -- Staff read all
    or public.is_staff()
  );

-- Writes only via SECURITY DEFINER paths (cron route uses service-role client)
-- so no user-level INSERT/UPDATE policies needed.

-- updated_at trigger
create or replace function public.touch_device_metrics_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_device_metrics on public.practice_device_metrics;
create trigger trg_touch_device_metrics
  before update on public.practice_device_metrics
  for each row execute function public.touch_device_metrics_updated_at();

-- ----------------------------------------------------------------------------
-- 3. practice_device_pull_attempts (audit log)
-- ----------------------------------------------------------------------------

create table if not exists public.practice_device_pull_attempts (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  provider text not null check (provider in ('google_health', 'whoop')),

  attempted_at timestamptz not null default now(),
  status text not null check (status in (
    'success',
    'no_data',
    'token_refresh_failed',
    'no_connection',
    'rate_limit',
    'api_error',
    'unexpected_error'
  )),
  error_message text,
  http_status integer,

  created_at timestamptz not null default now()
);

create index if not exists pull_attempts_activity_idx
  on public.practice_device_pull_attempts(activity_id, attempted_at desc);
create index if not exists pull_attempts_status_idx
  on public.practice_device_pull_attempts(status, attempted_at desc);

alter table public.practice_device_pull_attempts enable row level security;

-- Staff can read all attempts (for debugging); users can read attempts for themselves/their kids
drop policy if exists "pull_attempts: athlete/parent/staff read"
  on public.practice_device_pull_attempts;
create policy "pull_attempts: athlete/parent/staff read"
  on public.practice_device_pull_attempts for select
  using (
    student_id in (
      select s.id from public.students s where s.profile_id = auth.uid()
    )
    or student_id in (
      select fl.student_id from public.family_links fl where fl.parent_id = auth.uid()
    )
    or public.is_staff()
  );

-- ----------------------------------------------------------------------------
-- 4. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
