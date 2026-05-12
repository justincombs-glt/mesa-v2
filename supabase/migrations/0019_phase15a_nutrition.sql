-- ============================================================================
-- Phase 15a: Nutrition tracker — foundation
--
-- Adds two new tables for calorie tracking:
--   1. nutrition_goals — one row per student, current daily calorie goal
--   2. nutrition_entries — log of food intake with timestamps
--
-- ACCESS MODEL (Q2 = B): student + parent visibility ONLY. Coach, director,
-- admin, and trainer have NO access to nutrition data. This is intentional —
-- nutrition decisions for minors belong with the family and (eventually) a
-- registered dietitian, not the academy's coaching staff.
--
-- Safeguards live in application code, not the database:
--   - Minimum daily-calorie floor (1600/1800 by sex) with explicit override
--   - Shame-free UI language
--   - Educational copy
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. nutrition_goals — one daily calorie goal per student
-- ----------------------------------------------------------------------------

create table if not exists public.nutrition_goals (
  student_id uuid primary key references public.students(id) on delete cascade,
  daily_calories integer not null check (daily_calories > 0),
  set_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nutrition_goals_set_by_idx on public.nutrition_goals(set_by);

-- ----------------------------------------------------------------------------
-- 2. nutrition_entries — food log entries with timestamps
-- ----------------------------------------------------------------------------

create table if not exists public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  name text not null,
  calories integer not null check (calories >= 0),
  logged_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nutrition_entries_student_time_idx
  on public.nutrition_entries(student_id, occurred_at desc);

-- ----------------------------------------------------------------------------
-- 3. RLS — household-only access (no staff)
--    is_staff() is EXCLUDED here on purpose. Coaches, directors, admins, and
--    trainers do not see nutrition data. Q2 = B.
-- ----------------------------------------------------------------------------

alter table public.nutrition_goals enable row level security;
alter table public.nutrition_entries enable row level security;

-- Read policies: only the student themselves or their linked parent
drop policy if exists "NutritionGoals: household read" on public.nutrition_goals;
create policy "NutritionGoals: household read"
  on public.nutrition_goals
  for select
  using (
    public.is_self_student(student_id) or public.is_parent_of(student_id)
  );

drop policy if exists "NutritionEntries: household read" on public.nutrition_entries;
create policy "NutritionEntries: household read"
  on public.nutrition_entries
  for select
  using (
    public.is_self_student(student_id) or public.is_parent_of(student_id)
  );

-- Write policies: same scope. Student + parent can insert/update/delete.
drop policy if exists "NutritionGoals: household writes" on public.nutrition_goals;
create policy "NutritionGoals: household writes"
  on public.nutrition_goals
  for all
  using (
    public.is_self_student(student_id) or public.is_parent_of(student_id)
  )
  with check (
    public.is_self_student(student_id) or public.is_parent_of(student_id)
  );

drop policy if exists "NutritionEntries: household writes" on public.nutrition_entries;
create policy "NutritionEntries: household writes"
  on public.nutrition_entries
  for all
  using (
    public.is_self_student(student_id) or public.is_parent_of(student_id)
  )
  with check (
    public.is_self_student(student_id) or public.is_parent_of(student_id)
  );

-- ----------------------------------------------------------------------------
-- 4. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
