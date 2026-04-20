-- ============================================================================
-- Phase 3.5: Seasons + season enrollments
--
-- Introduces a yearly/seasonal structure. Each season is a named period with
-- its own students, plans, activities, results. Archived seasons become
-- read-only (enforced in UI).
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Seasons
-- ----------------------------------------------------------------------------

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists seasons_one_current
  on public.seasons(is_current) where is_current = true;

create index if not exists seasons_archived_idx on public.seasons(archived_at);

-- ----------------------------------------------------------------------------
-- Season enrollments (per-season roster)
-- ----------------------------------------------------------------------------

create table if not exists public.season_enrollments (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrolled_on date not null default current_date,
  departed_on date,
  notes text,
  created_at timestamptz not null default now(),
  unique (season_id, student_id)
);

create index if not exists season_enrollments_season_idx
  on public.season_enrollments(season_id);
create index if not exists season_enrollments_student_idx
  on public.season_enrollments(student_id);

-- ----------------------------------------------------------------------------
-- Seed default "2025-26 Season" if no seasons exist
-- ----------------------------------------------------------------------------

do $$
declare
  v_count integer;
  v_season_id uuid;
begin
  select count(*) into v_count from public.seasons;
  if v_count = 0 then
    insert into public.seasons (name, starts_on, ends_on, is_current)
    values ('2025-26 Season', '2025-09-01', '2026-08-31', true)
    returning id into v_season_id;

    -- Auto-enroll all currently-active students in the seeded season
    insert into public.season_enrollments (season_id, student_id)
    select v_season_id, id from public.students where active = true
    on conflict do nothing;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Add season_id to tables that need it
-- ----------------------------------------------------------------------------

alter table public.goal_plans
  add column if not exists season_id uuid references public.seasons(id) on delete set null;

alter table public.activities
  add column if not exists season_id uuid references public.seasons(id) on delete set null;

alter table public.performance_test_results
  add column if not exists season_id uuid references public.seasons(id) on delete set null;

alter table public.cpt_sessions
  add column if not exists season_id uuid references public.seasons(id) on delete set null;

-- Backfill existing data to current season
update public.goal_plans
  set season_id = (select id from public.seasons where is_current = true limit 1)
  where season_id is null;

update public.activities
  set season_id = (select id from public.seasons where is_current = true limit 1)
  where season_id is null;

update public.performance_test_results
  set season_id = (select id from public.seasons where is_current = true limit 1)
  where season_id is null;

update public.cpt_sessions
  set season_id = (select id from public.seasons where is_current = true limit 1)
  where season_id is null;

-- Indexes for season scoping queries
create index if not exists goal_plans_season_idx on public.goal_plans(season_id);
create index if not exists activities_season_idx on public.activities(season_id);
create index if not exists perf_results_season_idx on public.performance_test_results(season_id);
create index if not exists cpt_sessions_season_idx on public.cpt_sessions(season_id);

-- ----------------------------------------------------------------------------
-- Goal plan composites (composites attached to a plan)
-- ----------------------------------------------------------------------------

create table if not exists public.goal_plan_composites (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.goal_plans(id) on delete cascade,
  composite_id uuid not null references public.composite_performance_tests(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (plan_id, composite_id)
);

create index if not exists goal_plan_composites_plan_idx
  on public.goal_plan_composites(plan_id);

-- ----------------------------------------------------------------------------
-- Baseline flag on cpt_sessions (director can override auto-baseline)
-- ----------------------------------------------------------------------------

alter table public.cpt_sessions
  add column if not exists is_baseline boolean not null default false;

-- ----------------------------------------------------------------------------
-- Helper functions
-- ----------------------------------------------------------------------------

create or replace function public.current_season_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.seasons where is_current = true limit 1
$$;

create or replace function public.is_season_archived(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select archived_at is not null from public.seasons where id = sid),
    false
  )
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.seasons enable row level security;
alter table public.season_enrollments enable row level security;
alter table public.goal_plan_composites enable row level security;

drop policy if exists "Season: authenticated read" on public.seasons;
drop policy if exists "Season: staff writes" on public.seasons;
drop policy if exists "Enrollment: staff reads" on public.season_enrollments;
drop policy if exists "Enrollment: related reads" on public.season_enrollments;
drop policy if exists "Enrollment: staff writes" on public.season_enrollments;
drop policy if exists "GoalPlanComposite: reads if can view plan" on public.goal_plan_composites;
drop policy if exists "GoalPlanComposite: staff writes" on public.goal_plan_composites;

create policy "Season: authenticated read"
  on public.seasons for select
  using (auth.uid() is not null);

create policy "Season: staff writes"
  on public.seasons for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

create policy "Enrollment: staff reads"
  on public.season_enrollments for select
  using (public.is_staff());

create policy "Enrollment: related reads"
  on public.season_enrollments for select
  using (public.can_view_student(student_id));

create policy "Enrollment: staff writes"
  on public.season_enrollments for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

create policy "GoalPlanComposite: reads if can view plan"
  on public.goal_plan_composites for select
  using (
    exists(
      select 1 from public.goal_plans gp
      where gp.id = goal_plan_composites.plan_id
        and public.can_view_student(gp.student_id)
    )
  );

create policy "GoalPlanComposite: staff writes"
  on public.goal_plan_composites for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

-- ----------------------------------------------------------------------------
-- Refresh PostgREST cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
