-- ============================================================================
-- Phase 17: Coach's Corner
--
-- A module for coaches and directors to post video links organized by date.
-- Players and parents view; players mark videos as watched (honor system).
--
-- Tables:
--   1. coachs_corner_videos  — the posts (title + description + url + date)
--   2. coachs_corner_views   — per-student "marked as watched" records
--
-- Plus one column on profiles:
--   - last_seen_coachs_corner_at  — used to compute the "new since you last
--     looked" badge on the sidebar (Q11 = C)
--
-- Locked design choices:
--   - Q1 = C: supports YouTube, Vimeo, and Hudl (URL validation in app code;
--             no DB-level enum on provider so adding a source later is easy)
--   - Q2 = A: honor-system watched tracking (one row in _views per click)
--   - Q5 = A: academy-wide visibility — every signed-in user can read videos
--   - Q6 = A: full edit + delete by the original poster or any admin/director
--   - Q7 = A: coach/director see all _views rows; student sees own; PARENTS
--             SEE NOTHING from _views (deliberate scope choice)
--   - Q12 = B: URL validation enforced in the server action, not RLS
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Videos table
-- ----------------------------------------------------------------------------

create table if not exists public.coachs_corner_videos (
  id uuid primary key default gen_random_uuid(),
  for_date date not null,
  title text not null,
  description text,
  url text not null,
  provider text not null,                   -- 'youtube' | 'vimeo' | 'hudl'
  embed_id text,                            -- provider-specific ID for embed URL construction
  posted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coachs_corner_videos_for_date_idx
  on public.coachs_corner_videos(for_date desc);

create index if not exists coachs_corner_videos_created_at_idx
  on public.coachs_corner_videos(created_at desc);

-- ----------------------------------------------------------------------------
-- 2. Watch records ("marked as watched") — one row per student per video
-- ----------------------------------------------------------------------------

create table if not exists public.coachs_corner_views (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.coachs_corner_videos(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  watched_at timestamptz not null default now(),
  unique (video_id, student_id)
);

create index if not exists coachs_corner_views_video_idx
  on public.coachs_corner_views(video_id);

create index if not exists coachs_corner_views_student_idx
  on public.coachs_corner_views(student_id);

-- ----------------------------------------------------------------------------
-- 3. "Last seen" timestamp on profiles for the unread-badge feature (Q11 = C)
-- ----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists last_seen_coachs_corner_at timestamptz;

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------

alter table public.coachs_corner_videos enable row level security;
alter table public.coachs_corner_views  enable row level security;

-- Videos: read for ANY signed-in user (academy-wide per Q5 = A)
drop policy if exists "CCVideos: signed-in read" on public.coachs_corner_videos;
create policy "CCVideos: signed-in read"
  on public.coachs_corner_videos
  for select
  using (auth.uid() is not null);

-- Videos: write only by admin/director/coach (NOT trainer; trainers don't
-- post coaching content per Q5/Q6 scope)
drop policy if exists "CCVideos: staff writes" on public.coachs_corner_videos;
create policy "CCVideos: staff writes"
  on public.coachs_corner_videos
  for all
  using (
    exists (
      select 1 from public.profiles
       where id = auth.uid()
         and role in ('admin', 'director', 'coach')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
       where id = auth.uid()
         and role in ('admin', 'director', 'coach')
    )
  );

-- Views: student can read their own (Q7 = A — player sees own status)
drop policy if exists "CCViews: student reads own" on public.coachs_corner_views;
create policy "CCViews: student reads own"
  on public.coachs_corner_views
  for select
  using (public.is_self_student(student_id));

-- Views: coach/director/admin can read all (Q7 = A — staff roll-up)
drop policy if exists "CCViews: staff reads all" on public.coachs_corner_views;
create policy "CCViews: staff reads all"
  on public.coachs_corner_views
  for select
  using (
    exists (
      select 1 from public.profiles
       where id = auth.uid()
         and role in ('admin', 'director', 'coach')
    )
  );

-- Views: student writes their own (mark as watched / unmark)
drop policy if exists "CCViews: student writes own" on public.coachs_corner_views;
create policy "CCViews: student writes own"
  on public.coachs_corner_views
  for all
  using (public.is_self_student(student_id))
  with check (public.is_self_student(student_id));

-- NOTE: parents have NO read or write access to coachs_corner_views per Q7 = A.
-- They can still read the videos themselves via the signed-in-read policy.

-- ----------------------------------------------------------------------------
-- 5. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
