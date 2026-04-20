-- ============================================================================
-- Phase 2.5: Composite Performance Tests (CPTs)
--
-- A CPT is a named, ordered bundle of individual performance tests. The
-- director defines them; trainers administer them as a session covering
-- one or more students.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

create table if not exists public.composite_performance_tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists composite_performance_tests_active_idx
  on public.composite_performance_tests(active);

create table if not exists public.composite_performance_test_items (
  id uuid primary key default gen_random_uuid(),
  composite_id uuid not null references public.composite_performance_tests(id) on delete cascade,
  test_id uuid not null references public.performance_tests(id) on delete cascade,
  sequence integer not null default 0,
  created_at timestamptz not null default now(),
  unique (composite_id, test_id)
);

create index if not exists cpt_items_composite_idx
  on public.composite_performance_test_items(composite_id);

create table if not exists public.cpt_sessions (
  id uuid primary key default gen_random_uuid(),
  composite_id uuid not null references public.composite_performance_tests(id) on delete cascade,
  session_date date not null default current_date,
  administered_by uuid references public.profiles(id) on delete set null,
  conditions_notes text,
  created_at timestamptz not null default now()
);

create index if not exists cpt_sessions_composite_idx
  on public.cpt_sessions(composite_id, session_date desc);

-- Link results to CPT sessions (optional — ad-hoc results have no session)
alter table public.performance_test_results
  add column if not exists cpt_session_id uuid references public.cpt_sessions(id) on delete set null;

create index if not exists perf_test_results_session_idx
  on public.performance_test_results(cpt_session_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.composite_performance_tests enable row level security;
alter table public.composite_performance_test_items enable row level security;
alter table public.cpt_sessions enable row level security;

drop policy if exists "CPT: authenticated read" on public.composite_performance_tests;
drop policy if exists "CPT: staff writes" on public.composite_performance_tests;
drop policy if exists "CPTItems: authenticated read" on public.composite_performance_test_items;
drop policy if exists "CPTItems: staff writes" on public.composite_performance_test_items;
drop policy if exists "CPTSession: staff reads" on public.cpt_sessions;
drop policy if exists "CPTSession: staff writes" on public.cpt_sessions;

create policy "CPT: authenticated read"
  on public.composite_performance_tests
  for select
  using (auth.uid() is not null);

create policy "CPT: staff writes"
  on public.composite_performance_tests
  for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

create policy "CPTItems: authenticated read"
  on public.composite_performance_test_items
  for select
  using (auth.uid() is not null);

create policy "CPTItems: staff writes"
  on public.composite_performance_test_items
  for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

create policy "CPTSession: staff reads"
  on public.cpt_sessions
  for select
  using (public.is_staff());

create policy "CPTSession: staff writes"
  on public.cpt_sessions
  for all
  using (public.is_staff()) with check (public.is_staff());

notify pgrst, 'reload schema';
