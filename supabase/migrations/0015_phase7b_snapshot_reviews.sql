-- ============================================================================
-- Phase 7b: Snapshot reviews
--
-- Extends the reviews table to support immutable snapshots of student insights
-- at a point in time. Adds review_goal_ratings for queryable per-goal ratings.
--
-- Design (per Phase 7b answers):
--   Q1 = A: snapshot_data jsonb stores full insights blob
--   Q3 = C: finalized_at + finalized_by columns drive lock state (manual)
--   Q8 = B: review_goal_ratings is its own table for queryable analytics
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. reviews: snapshot + finalize columns + student scope
-- ----------------------------------------------------------------------------

-- snapshot_data holds the full StudentInsights blob captured at save time
alter table public.reviews
  add column if not exists snapshot_data jsonb;

-- finalized_at: when set, the review becomes read-only
alter table public.reviews
  add column if not exists finalized_at timestamptz;

alter table public.reviews
  add column if not exists finalized_by uuid references public.profiles(id) on delete set null;

-- We need a denormalized student_id so we can list all reviews for a student
-- without joining through plans. Backfilled from plan_id below.
alter table public.reviews
  add column if not exists student_id uuid references public.students(id) on delete cascade;

-- Backfill student_id from existing plans
update public.reviews r
   set student_id = p.student_id
  from public.goal_plans p
 where r.plan_id = p.id
   and r.student_id is null;

-- After backfill, student_id should always be set on new rows. Add NOT NULL
-- only if all rows are now populated. (If any are still null because plan was
-- deleted, leave nullable.)
do $$
begin
  if not exists (select 1 from public.reviews where student_id is null) then
    alter table public.reviews alter column student_id set not null;
  end if;
end $$;

create index if not exists reviews_student_idx on public.reviews(student_id, created_at desc);
create index if not exists reviews_finalized_idx on public.reviews(student_id) where finalized_at is not null;

-- ----------------------------------------------------------------------------
-- 2. review_goal_ratings: per-goal manual rating + note
-- ----------------------------------------------------------------------------

create type public.goal_rating as enum ('on_track', 'behind', 'met', 'not_met');

create table if not exists public.review_goal_ratings (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  goal_id uuid not null references public.goal_plan_goals(id) on delete cascade,
  rating public.goal_rating,
  note text,
  auto_pct integer,            -- captured auto-computed pct at review time
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, goal_id)
);

create index if not exists review_goal_ratings_review_idx on public.review_goal_ratings(review_id);
create index if not exists review_goal_ratings_goal_idx on public.review_goal_ratings(goal_id);

alter table public.review_goal_ratings enable row level security;

-- Reads: same audience as reviews
drop policy if exists "ReviewGoalRatings: staff or self reads" on public.review_goal_ratings;
create policy "ReviewGoalRatings: staff or self reads"
  on public.review_goal_ratings
  for select
  using (
    public.is_staff()
    or exists (
      select 1
      from public.reviews r
      join public.goal_plans p on p.id = r.plan_id
      where r.id = review_goal_ratings.review_id
        and public.can_view_student(p.student_id)
    )
  );

-- Writes: staff only, and only when parent review is NOT finalized
drop policy if exists "ReviewGoalRatings: staff writes if not finalized" on public.review_goal_ratings;
create policy "ReviewGoalRatings: staff writes if not finalized"
  on public.review_goal_ratings
  for all
  using (
    public.is_staff()
    and exists (select 1 from public.reviews r where r.id = review_goal_ratings.review_id and r.finalized_at is null)
  )
  with check (
    public.is_staff()
    and exists (select 1 from public.reviews r where r.id = review_goal_ratings.review_id and r.finalized_at is null)
  );

-- ----------------------------------------------------------------------------
-- 3. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
