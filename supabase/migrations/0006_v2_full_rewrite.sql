-- ============================================================================
-- MESA v2 — Full rewrite migration
-- Drops all v1 app tables and rebuilds from scratch with new schema.
-- auth.users preserved. Your director email is hard-coded as admin.
-- Idempotent: safe to run more than once (everything drops with IF EXISTS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: Drop everything v1 (tables, policies, enums, functions)
-- ----------------------------------------------------------------------------

-- Drop tables in dependency order (cascade handles FKs regardless)
drop table if exists public.practice_attendance cascade;
drop table if exists public.practice_drills cascade;
drop table if exists public.practices cascade;
drop table if exists public.team_roster cascade;
drop table if exists public.team_coaches cascade;
drop table if exists public.teams cascade;
drop table if exists public.game_stats cascade;
drop table if exists public.games cascade;
drop table if exists public.activities cascade;
drop table if exists public.sc_prs cascade;
drop table if exists public.sc_programs cascade;
drop table if exists public.goal_plan_tests cascade;
drop table if exists public.goal_plan_goals cascade;
drop table if exists public.goal_plans cascade;
drop table if exists public.goals cascade;
drop table if exists public.reviews cascade;
drop table if exists public.ratings cascade;
drop table if exists public.family_links cascade;
drop table if exists public.invites cascade;
drop table if exists public.students cascade;
drop table if exists public.drills cascade;
drop table if exists public.goal_templates cascade;
drop table if exists public.performance_tests cascade;
drop table if exists public.exercises cascade;
drop table if exists public.workout_exercises cascade;
drop table if exists public.workout_exercise_sets cascade;
drop table if exists public.performance_test_results cascade;
drop table if exists public.attendance cascade;
drop table if exists public.practice_plans cascade;
drop table if exists public.practice_plan_items cascade;
drop table if exists public.workout_plans cascade;
drop table if exists public.workout_plan_items cascade;
-- Keep profiles table data but drop+recreate to update shape
drop table if exists public.profiles cascade;
drop table if exists public.academy cascade;

-- Drop old helper functions
drop function if exists public.is_director() cascade;
drop function if exists public.is_staff() cascade;
drop function if exists public.is_parent_of(uuid) cascade;
drop function if exists public.is_self_student(uuid) cascade;
drop function if exists public.is_coach_of_student(uuid) cascade;
drop function if exists public.can_view_student(uuid) cascade;
drop function if exists public.current_role() cascade;
drop function if exists public.handle_new_user() cascade;

-- Drop triggers on auth.users that pointed at the old handle_new_user
drop trigger if exists on_auth_user_created on auth.users;

-- Drop old enums (CASCADE drops anything depending)
drop type if exists public.app_role cascade;
drop type if exists public.player_position cascade;
drop type if exists public.rating_category cascade;
drop type if exists public.activity_category cascade;
drop type if exists public.goal_status cascade;
drop type if exists public.drill_category cascade;
drop type if exists public.parent_relationship cascade;
drop type if exists public.goal_domain cascade;
drop type if exists public.goal_category cascade;
drop type if exists public.activity_type cascade;
drop type if exists public.off_ice_category cascade;
drop type if exists public.goal_plan_status cascade;
drop type if exists public.review_type cascade;

-- ----------------------------------------------------------------------------
-- Step 2: Create new enums
-- ----------------------------------------------------------------------------

create type public.app_role as enum (
  'admin', 'director', 'coach', 'trainer', 'student', 'parent'
);

create type public.player_position as enum ('F', 'D', 'G');

create type public.goal_domain as enum ('on_ice', 'off_ice');

create type public.goal_category as enum (
  -- On-ice
  'skating', 'puck_control', 'passing', 'shooting', 'hockey_iq', 'coachability',
  -- Off-ice
  'strength', 'conditioning', 'speed_agility', 'mental', 'nutrition_recovery', 'academic'
);

create type public.activity_type as enum ('game', 'practice', 'off_ice_workout');

create type public.off_ice_category as enum (
  'strength_conditioning', 'pilates', 'fight_club', 'custom'
);

create type public.goal_plan_status as enum (
  'draft', 'active', 'completed', 'archived'
);

create type public.review_type as enum ('scheduled', 'ad_hoc');

-- ----------------------------------------------------------------------------
-- Step 3: Core tables
-- ----------------------------------------------------------------------------

-- academy: singleton describing the academy
create table public.academy (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.academy (name) values ('Michigan Elite Sports Academy');

-- profiles: extends auth.users 1:1
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null unique,
  full_name text,
  role public.app_role not null default 'parent',
  phone text,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);

-- ----------------------------------------------------------------------------
-- Step 4: Helper functions
-- ----------------------------------------------------------------------------

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.is_director()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'director')
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'director', 'coach', 'trainer')
  )
$$;

create or replace function public.is_coach_or_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('coach', 'trainer')
  )
$$;

-- ----------------------------------------------------------------------------
-- Step 5: Students + family
-- ----------------------------------------------------------------------------

create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  date_of_birth date,
  jersey_number text,
  position public.player_position,
  dominant_hand char(1),
  team_label text,  -- OPTIONAL descriptive metadata only
  notes text,
  active boolean not null default true,
  profile_id uuid references public.profiles(id) on delete set null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index students_active_idx on public.students(active);
create index students_profile_id_idx on public.students(profile_id);

create table public.family_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

create index family_links_parent_idx on public.family_links(parent_id);
create index family_links_student_idx on public.family_links(student_id);

-- Helpers that depend on students/family_links

create or replace function public.is_parent_of(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.family_links
    where parent_id = auth.uid() and student_id = sid
  )
$$;

create or replace function public.is_self_student(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.students s
    where s.id = sid and s.profile_id = auth.uid()
  )
$$;

create or replace function public.can_view_student(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.is_staff()
    or public.is_parent_of(sid)
    or public.is_self_student(sid)
  )
$$;

-- ----------------------------------------------------------------------------
-- Step 6: Invites
-- ----------------------------------------------------------------------------

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.app_role not null,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  status text not null default 'pending', -- pending | consumed | revoked
  note text,
  invited_by uuid references public.profiles(id) on delete set null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index invites_email_status_idx on public.invites(lower(email), status);

-- ----------------------------------------------------------------------------
-- Step 7: Repositories (admin-managed libraries)
-- ----------------------------------------------------------------------------

-- Drills (on-ice exercises)
create table public.drills (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text,
  instructions text,
  duration_minutes integer,
  equipment text[],
  age_groups text[],
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index drills_active_idx on public.drills(active);

-- Exercises (off-ice exercises - NEW in v2)
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text,
  instructions text,
  default_sets integer,
  default_reps integer,
  default_duration_seconds integer,
  equipment text[],
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index exercises_active_idx on public.exercises(active);

-- Goal templates
create table public.goal_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  domain public.goal_domain not null,
  category public.goal_category not null,
  target_value numeric,
  target_unit text,
  suggested_deadline_weeks integer,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index goal_templates_domain_idx on public.goal_templates(domain) where active;
create index goal_templates_category_idx on public.goal_templates(category) where active;

-- Performance tests (NEW in v2)
create table public.performance_tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  domain public.goal_domain not null,
  description text,
  instructions text,
  unit text,
  direction text not null default 'higher_is_better', -- 'higher_is_better' | 'lower_is_better'
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index performance_tests_domain_idx on public.performance_tests(domain) where active;

-- ----------------------------------------------------------------------------
-- Step 8: Practice + workout plans (templates)
-- ----------------------------------------------------------------------------

create table public.practice_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  focus text,
  duration_minutes integer,
  is_template boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.practice_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.practice_plans(id) on delete cascade,
  sequence integer not null default 0,
  item_type text not null, -- 'drill' | 'skill'
  drill_id uuid references public.drills(id) on delete set null,
  skill_title text,
  duration_override integer,
  coach_notes text,
  created_at timestamptz not null default now()
);

create index practice_plan_items_plan_idx on public.practice_plan_items(plan_id);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  focus text,
  duration_minutes integer,
  is_template boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.workout_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  sequence integer not null default 0,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  default_sets integer,
  default_reps integer,
  coach_notes text,
  created_at timestamptz not null default now()
);

create index workout_plan_items_plan_idx on public.workout_plan_items(plan_id);

-- ----------------------------------------------------------------------------
-- Step 9: Activities — unified log (games, practices, off-ice workouts)
-- ----------------------------------------------------------------------------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  activity_type public.activity_type not null,
  occurred_on date not null,
  starts_at time,
  duration_minutes integer,
  title text,
  focus text,
  notes text,
  logged_by uuid references public.profiles(id) on delete set null,

  -- Game-specific
  opponent text,
  our_score integer,
  opp_score integer,
  home_away text, -- 'home' | 'away'
  venue text,

  -- Off-ice workout-specific
  off_ice_category public.off_ice_category,
  custom_category_name text,

  -- Plan references
  source_practice_plan_id uuid references public.practice_plans(id) on delete set null,
  source_workout_plan_id uuid references public.workout_plans(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activities_type_date_idx on public.activities(activity_type, occurred_on desc);
create index activities_occurred_idx on public.activities(occurred_on desc);

-- Per-activity enrolled students (who showed up / who's expected)
-- Replaces v1's team_roster model: each activity has its own "roster"
create table public.activity_students (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (activity_id, student_id)
);

create index activity_students_activity_idx on public.activity_students(activity_id);
create index activity_students_student_idx on public.activity_students(student_id);

-- Attendance records (one per activity × student)
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attended boolean, -- null = unmarked, true = present, false = absent
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  unique (activity_id, student_id)
);

create index attendance_student_idx on public.attendance(student_id);

-- Game stats per player
create table public.game_stats (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  goals integer default 0,
  assists integer default 0,
  plus_minus integer default 0,
  shots integer default 0,
  penalty_mins integer default 0,
  time_on_ice interval,
  saves integer,
  shots_against integer,
  goals_against integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, student_id)
);

create index game_stats_student_idx on public.game_stats(student_id);

-- Workout exercises (which exercises were in a workout instance)
create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  sequence integer not null default 0,
  sets integer,
  coach_notes text,
  created_at timestamptz not null default now()
);

create index workout_exercises_activity_idx on public.workout_exercises(activity_id);

-- Per-student per-set logging within a workout
create table public.workout_exercise_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  set_number integer not null,
  reps integer,
  weight numeric,
  duration_seconds integer,
  distance_meters numeric,
  rpe integer,
  notes text,
  created_at timestamptz not null default now(),
  unique (workout_exercise_id, student_id, set_number)
);

create index workout_exercise_sets_student_idx on public.workout_exercise_sets(student_id);

-- Performance test results (student's test scores over time)
create table public.performance_test_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  test_id uuid not null references public.performance_tests(id) on delete cascade,
  value numeric not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null,
  notes text,
  is_baseline boolean not null default false,
  context text -- 'scheduled_test' | 'ad_hoc' | 'goal_review'
);

create index performance_test_results_student_idx on public.performance_test_results(student_id, test_id, recorded_at desc);

-- ----------------------------------------------------------------------------
-- Step 10: Goal management
-- ----------------------------------------------------------------------------

create table public.goal_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  status public.goal_plan_status not null default 'draft',
  agreement_notes text,
  starts_on date,
  ends_on date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goal_plans_student_idx on public.goal_plans(student_id, status);

create table public.goal_plan_goals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.goal_plans(id) on delete cascade,
  template_id uuid references public.goal_templates(id) on delete set null,
  title text not null,
  description text,
  domain public.goal_domain,
  category public.goal_category,
  target_value text,
  target_unit text,
  current_value text,
  progress_pct integer not null default 0,
  due_date date,
  status text not null default 'active', -- 'active' | 'achieved' | 'abandoned'
  achieved_at timestamptz,
  sequence integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (progress_pct >= 0 and progress_pct <= 100)
);

create index goal_plan_goals_plan_idx on public.goal_plan_goals(plan_id);

create table public.goal_plan_tests (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.goal_plans(id) on delete cascade,
  test_id uuid not null references public.performance_tests(id) on delete cascade,
  target_value numeric,
  target_unit text,
  baseline_value numeric,
  unique (plan_id, test_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.goal_plans(id) on delete cascade,
  review_type public.review_type not null default 'ad_hoc',
  scheduled_date date,
  completed_at timestamptz,
  reviewer_id uuid references public.profiles(id) on delete set null,
  summary text,
  concerns text,
  next_steps text,
  attendance_pct numeric,
  goals_progress_notes text,
  tests_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_plan_idx on public.reviews(plan_id);

-- ----------------------------------------------------------------------------
-- Step 11: handle_new_user trigger
--    On signup: create profile. Honor pending invite for role. If none,
--    check if this is the very first user — make them admin.
--    Otherwise default to parent.
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Step 12: Bootstrap - recreate profiles for existing auth.users
--   (the wipe in Step 1 dropped their profile rows; restore them)
-- ----------------------------------------------------------------------------

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  case
    when lower(u.email) = 'justin.combs@gltconsulting.io' then 'admin'::public.app_role
    else 'parent'::public.app_role
  end
from auth.users u
on conflict (id) do update set
  role = case
    when lower(excluded.email) = 'justin.combs@gltconsulting.io' then 'admin'::public.app_role
    else excluded.role
  end;

-- ----------------------------------------------------------------------------
-- Step 13: Enable RLS on all tables
-- ----------------------------------------------------------------------------

alter table public.academy enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.family_links enable row level security;
alter table public.invites enable row level security;
alter table public.drills enable row level security;
alter table public.exercises enable row level security;
alter table public.goal_templates enable row level security;
alter table public.performance_tests enable row level security;
alter table public.practice_plans enable row level security;
alter table public.practice_plan_items enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_plan_items enable row level security;
alter table public.activities enable row level security;
alter table public.activity_students enable row level security;
alter table public.attendance enable row level security;
alter table public.game_stats enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_exercise_sets enable row level security;
alter table public.performance_test_results enable row level security;
alter table public.goal_plans enable row level security;
alter table public.goal_plan_goals enable row level security;
alter table public.goal_plan_tests enable row level security;
alter table public.reviews enable row level security;

-- ----------------------------------------------------------------------------
-- Step 14: RLS policies
-- ----------------------------------------------------------------------------

-- academy: readable by any authenticated user, admin-only writes
create policy "Academy: authenticated read" on public.academy for select
  using (auth.uid() is not null);
create policy "Academy: admin writes" on public.academy for all
  using (public.is_admin()) with check (public.is_admin());

-- profiles: self or staff reads; self updates basic fields; admin updates role
create policy "Profile: read self or staff" on public.profiles for select
  using (id = auth.uid() or public.is_staff());
create policy "Profile: update self" on public.profiles for update
  using (id = auth.uid());
create policy "Profile: admin manages all" on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- students
create policy "Student: read if related" on public.students for select
  using (public.can_view_student(id));
create policy "Student: staff inserts" on public.students for insert
  with check (public.is_staff() and (public.is_admin() or public.is_director()));
create policy "Student: staff updates" on public.students for update
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());
create policy "Student: admin deletes" on public.students for delete
  using (public.is_admin());

-- family_links
create policy "Family: read own or staff" on public.family_links for select
  using (parent_id = auth.uid() or public.is_staff());
create policy "Family: staff manages" on public.family_links for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

-- invites
create policy "Invite: staff manages" on public.invites for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

-- Repositories: authenticated read, admin+director insert/update, admin delete.
-- Coaches can also add drills; trainers can also add exercises.

create policy "Drill: authenticated read" on public.drills for select
  using (auth.uid() is not null);
create policy "Drill: staff-or-coach inserts" on public.drills for insert
  with check (public.is_admin() or public.is_director() or public.current_role() = 'coach');
create policy "Drill: staff-or-owner updates" on public.drills for update
  using (public.is_admin() or public.is_director() or created_by = auth.uid())
  with check (public.is_admin() or public.is_director() or created_by = auth.uid());
create policy "Drill: staff deletes" on public.drills for delete
  using (public.is_admin() or public.is_director());

create policy "Exercise: authenticated read" on public.exercises for select
  using (auth.uid() is not null);
create policy "Exercise: staff-or-trainer inserts" on public.exercises for insert
  with check (public.is_admin() or public.is_director() or public.current_role() = 'trainer');
create policy "Exercise: staff-or-owner updates" on public.exercises for update
  using (public.is_admin() or public.is_director() or created_by = auth.uid())
  with check (public.is_admin() or public.is_director() or created_by = auth.uid());
create policy "Exercise: staff deletes" on public.exercises for delete
  using (public.is_admin() or public.is_director());

create policy "GoalTemplate: authenticated read" on public.goal_templates for select
  using (auth.uid() is not null);
create policy "GoalTemplate: staff writes" on public.goal_templates for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

create policy "PerformanceTest: authenticated read" on public.performance_tests for select
  using (auth.uid() is not null);
create policy "PerformanceTest: staff writes" on public.performance_tests for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

-- Practice and workout plans (coach/trainer can create)
create policy "PracticePlan: staff reads" on public.practice_plans for select
  using (public.is_staff());
create policy "PracticePlan: coach-or-staff inserts" on public.practice_plans for insert
  with check (public.is_admin() or public.is_director() or public.current_role() = 'coach');
create policy "PracticePlan: owner-or-staff updates" on public.practice_plans for update
  using (public.is_admin() or public.is_director() or created_by = auth.uid())
  with check (public.is_admin() or public.is_director() or created_by = auth.uid());
create policy "PracticePlan: staff deletes" on public.practice_plans for delete
  using (public.is_admin() or public.is_director() or created_by = auth.uid());

create policy "PracticePlanItem: staff reads" on public.practice_plan_items for select
  using (public.is_staff());
create policy "PracticePlanItem: staff writes" on public.practice_plan_items for all
  using (public.is_staff()) with check (public.is_staff());

create policy "WorkoutPlan: staff reads" on public.workout_plans for select
  using (public.is_staff());
create policy "WorkoutPlan: trainer-or-staff inserts" on public.workout_plans for insert
  with check (public.is_admin() or public.is_director() or public.current_role() = 'trainer');
create policy "WorkoutPlan: owner-or-staff updates" on public.workout_plans for update
  using (public.is_admin() or public.is_director() or created_by = auth.uid())
  with check (public.is_admin() or public.is_director() or created_by = auth.uid());
create policy "WorkoutPlan: staff deletes" on public.workout_plans for delete
  using (public.is_admin() or public.is_director() or created_by = auth.uid());

create policy "WorkoutPlanItem: staff reads" on public.workout_plan_items for select
  using (public.is_staff());
create policy "WorkoutPlanItem: staff writes" on public.workout_plan_items for all
  using (public.is_staff()) with check (public.is_staff());

-- Activities: staff can see/write all. Students+parents see only activities they're enrolled in.
create policy "Activity: staff reads all" on public.activities for select
  using (public.is_staff());
create policy "Activity: student-or-parent reads if enrolled" on public.activities for select
  using (
    exists(
      select 1 from public.activity_students a_s
      join public.students s on s.id = a_s.student_id
      where a_s.activity_id = activities.id
        and (s.profile_id = auth.uid() or public.is_parent_of(s.id))
    )
  );
create policy "Activity: staff writes" on public.activities for all
  using (public.is_staff()) with check (public.is_staff());

create policy "ActivityStudents: staff reads" on public.activity_students for select
  using (public.is_staff());
create policy "ActivityStudents: student-parent reads own" on public.activity_students for select
  using (public.can_view_student(student_id));
create policy "ActivityStudents: staff writes" on public.activity_students for all
  using (public.is_staff()) with check (public.is_staff());

create policy "Attendance: staff reads" on public.attendance for select
  using (public.is_staff());
create policy "Attendance: student-parent reads own" on public.attendance for select
  using (public.can_view_student(student_id));
create policy "Attendance: coach-trainer writes" on public.attendance for all
  using (public.is_staff()) with check (public.is_staff());

create policy "GameStats: reads if can view student" on public.game_stats for select
  using (public.can_view_student(student_id));
create policy "GameStats: coach-staff writes" on public.game_stats for all
  using (public.is_admin() or public.is_director() or public.current_role() = 'coach')
  with check (public.is_admin() or public.is_director() or public.current_role() = 'coach');

create policy "WorkoutExercises: staff reads" on public.workout_exercises for select
  using (public.is_staff());
create policy "WorkoutExercises: enrolled reads" on public.workout_exercises for select
  using (
    exists(
      select 1 from public.activity_students a_s
      join public.students s on s.id = a_s.student_id
      where a_s.activity_id = workout_exercises.activity_id
        and (s.profile_id = auth.uid() or public.is_parent_of(s.id))
    )
  );
create policy "WorkoutExercises: trainer-staff writes" on public.workout_exercises for all
  using (public.is_admin() or public.is_director() or public.current_role() = 'trainer')
  with check (public.is_admin() or public.is_director() or public.current_role() = 'trainer');

create policy "WorkoutSets: reads if can view student" on public.workout_exercise_sets for select
  using (public.can_view_student(student_id));
create policy "WorkoutSets: trainer-staff writes" on public.workout_exercise_sets for all
  using (public.is_admin() or public.is_director() or public.current_role() = 'trainer')
  with check (public.is_admin() or public.is_director() or public.current_role() = 'trainer');

create policy "TestResults: reads if can view student" on public.performance_test_results for select
  using (public.can_view_student(student_id));
create policy "TestResults: staff writes" on public.performance_test_results for all
  using (public.is_staff()) with check (public.is_staff());

-- Goal management
create policy "GoalPlan: reads if can view student" on public.goal_plans for select
  using (public.can_view_student(student_id));
create policy "GoalPlan: staff writes" on public.goal_plans for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

create policy "GoalPlanGoals: reads if can view plan" on public.goal_plan_goals for select
  using (
    exists(
      select 1 from public.goal_plans gp
      where gp.id = goal_plan_goals.plan_id
        and public.can_view_student(gp.student_id)
    )
  );
create policy "GoalPlanGoals: staff writes" on public.goal_plan_goals for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

create policy "GoalPlanTests: reads if can view plan" on public.goal_plan_tests for select
  using (
    exists(
      select 1 from public.goal_plans gp
      where gp.id = goal_plan_tests.plan_id
        and public.can_view_student(gp.student_id)
    )
  );
create policy "GoalPlanTests: staff writes" on public.goal_plan_tests for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

create policy "Review: reads if can view plan" on public.reviews for select
  using (
    exists(
      select 1 from public.goal_plans gp
      where gp.id = reviews.plan_id
        and public.can_view_student(gp.student_id)
    )
  );
create policy "Review: staff writes" on public.reviews for all
  using (public.is_admin() or public.is_director())
  with check (public.is_admin() or public.is_director());

-- ----------------------------------------------------------------------------
-- Step 15: Reload PostgREST schema cache so new columns are immediately visible
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
