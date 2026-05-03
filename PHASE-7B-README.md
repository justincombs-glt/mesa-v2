# MESA v2 — Phase 7b: Snapshot Reviews

**Status:** Ready to deploy

The insights page now becomes a memory. Director clicks "Save as review" → app freezes the entire current state into an immutable record. Past reviews stack as a timeline. Per-goal manual ratings layered on top of auto-computed values. Manual finalize button locks reviews when ready.

This phase builds on the live insights surface from Phase 7a — without that, this won't make sense.

---

## What shipped

### Save as review (Q4 = D)
A new "Past reviews" section at the bottom of the insights page (`/dashboard/students/[id]/insights`). Header shows the count + a "+ Save as review" button.

Click it → app captures:
- The full `StudentInsights` blob (attendance breakdown, all test trends, plans + goals with auto-computed pcts, workout summary)
- The auto-computed pct for every goal (pre-populated as `review_goal_ratings.auto_pct`)
- Stamps the review as completed at click time, attaches it to the most recent active goal plan
- Redirects to the review detail page so director can immediately add notes / rate goals

The button is disabled if the student has no active goal plan (the `reviews` table requires `plan_id`).

### Past reviews timeline
Below "+ Save as review", every prior review for this student renders as a clickable row showing:
- Date (completed_at or created_at)
- Status badge (Finalized vs Draft)
- Type (scheduled vs ad_hoc)
- Summary snippet if any

Q5 = C: this list lives on the insights page (across all plans for that student). The existing per-plan reviews section on the goal-management plan detail page is untouched and still shows reviews scoped to that plan.

### Review detail page (Q6 = B)
New route: `/dashboard/students/[id]/insights/reviews/[reviewId]`

Four sections:

1. **Status bar**: Finalized vs Draft badge, finalize timestamp, reviewer name. Finalize button (with confirm). Delete button (only visible while draft).
2. **Notes**: Summary, Concerns, Next Steps. Editable until the review is finalized.
3. **Goal ratings**: One card per goal that was active when the review was captured. Each shows the goal title, plan title, the auto-computed pct at review time, and (Q7 = A) the manual rating + note side-by-side. Rating dropdown: On track / Behind / Met / Not met / no rating. Editable until finalized.
4. **Snapshot at time of review**: Frozen summary cards + frozen test trends table reading from `snapshot_data`. Always read-only — this is the immutable evidence. Sparklines aren't repeated here (the review detail is meant for printing/reading; the sparklines were on the live insights page when the snapshot was taken).

### Finalization (Q3 = C)
Finalized reviews:
- Cannot have notes edited (`updateReview` returns an error)
- Cannot have ratings changed (`upsertReviewGoalRating` returns an error)
- Cannot be deleted (`deleteReview` returns an error)
- Status badge flips to "Finalized" with timestamp + finalizer name

Until finalized, reviews behave like a draft — director can refine notes and ratings as the review conversation progresses.

### Per-goal ratings layered on auto-computed (Q2 = C, Q7 = A)
Captured in two stages:
- **At save time**: snapshot creation auto-pre-populates `review_goal_ratings` rows with `auto_pct` filled in but `rating` blank
- **After save**: director rates each goal individually — clicks "Rate" → dropdown + note field appears inline

Display always shows BOTH the auto pct and the manual rating side-by-side. If you set the rating to "Behind" but auto says 67%, the review reads "67% computed · Behind" with the rating badge styled prominently.

---

## Files added/changed

**New:**
- supabase/migrations/0015_phase7b_snapshot_reviews.sql
- components/insights/SaveReviewButton.tsx
- app/dashboard/students/[id]/insights/reviews/[reviewId]/page.tsx
- app/dashboard/students/[id]/insights/reviews/[reviewId]/ReviewDetailClient.tsx
- PHASE-7B-README.md

**Changed:**
- supabase migrations: 0015 added (extends `reviews` with snapshot_data/finalized_at/finalized_by/student_id; creates `review_goal_ratings` table + `goal_rating` enum)
- lib/supabase/types.ts: `Review` interface gains snapshot_data/finalized_at/finalized_by/student_id; new `ReviewGoalRating` and `GoalRating` types exported
- app/actions.ts:
  - `createReview` writes student_id (denormalized for query speed)
  - `updateReview` and `deleteReview` enforce the "not finalized" lock
  - 3 new actions: `createReviewSnapshot`, `upsertReviewGoalRating`, `finalizeReview`
- components/insights/InsightsView.tsx: takes `reviews` prop, renders new `PastReviewsSection`
- app/dashboard/students/[id]/insights/page.tsx: fetches reviews + passes them in

**Actions:** 86 total, no duplicates (up from 83).

---

## Database

**One new migration**: `supabase/migrations/0015_phase7b_snapshot_reviews.sql`

What it does:
1. `reviews.snapshot_data` (jsonb) — stores the full StudentInsights blob captured at save
2. `reviews.finalized_at` (timestamptz) + `reviews.finalized_by` (uuid) — drive the lock state (Q3 = C, manual)
3. `reviews.student_id` — denormalized so we can list reviews per student without joining through plans. Backfilled from existing rows.
4. New `goal_rating` enum: `on_track | behind | met | not_met`
5. New `review_goal_ratings` table — per-goal rating + note + auto_pct. Q8 = B (its own table for queryable analytics).
6. RLS: same audience as reviews. Writes blocked when parent review is finalized.
7. Refresh PostgREST cache

Idempotent. Safe to re-run.

---

## Deploy steps

### Step 1 — Run the SQL migration (REQUIRED, do this FIRST)
1. Open Supabase → SQL Editor → New query
2. Paste `supabase/migrations/0015_phase7b_snapshot_reviews.sql`
3. Run
4. Expect "Success. No rows returned."

Without this, "Save as review" submissions will fail (columns don't exist).

### Step 2 — Upload source files
1. Unzip `mesa-v2-phase7b-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
3. Commit: `Phase 7b: Snapshot reviews`
4. Vercel auto-deploys in ~90s
5. Hard refresh

---

## How to test

### Prerequisites
- A student with an active goal plan (with goals)
- At least one performance test result + linked goal (so auto-computed pcts have data)
- Some attendance entries

### 1. Save first review
1. Sign in as admin/director
2. Navigate to a student → click "View insights"
3. Scroll to bottom → "Past reviews" section, count = 0
4. Click "+ Save as review"
5. Page shows "Capturing snapshot…" briefly, then redirects to the new review's detail page
6. Status bar shows: **Draft** badge, "Editable until finalized", and the reviewer's name

### 2. Add notes to draft
1. Click "+ Add notes" in the Notes section
2. Fill in Summary / Concerns / Next steps
3. Save → notes appear in read mode
4. Click "Edit notes" → modify and save again. Should work.

### 3. Rate goals
1. In the Goal ratings section, click "+ Rate" on a goal
2. Pick a rating (e.g., "On track") and add a note
3. Save → rating badge appears on the right, note appears below the goal title
4. Click "Edit" on the same rating → change to "Behind" → save → updates

### 4. Snapshot is frozen
1. Note the test trends shown in the "Snapshot at time of review" section
2. Go back to the insights page (`/dashboard/students/[id]/insights`)
3. As trainer, record a new performance test result via `/dashboard/cpt-sessions`
4. Refresh the insights page → live data updates
5. Open the original review again → snapshot section is unchanged. The original numbers are preserved.

### 5. Finalize
1. From the draft review, click "Finalize"
2. Confirm in the dialog
3. Status badge flips to "Finalized" with timestamp + reviewer
4. Try to "Edit notes" — there's no button anymore
5. Try to rate a goal — no "Edit" or "+ Rate" buttons
6. Click into a previously-rated goal — read-only display

### 6. Past reviews timeline
1. Save 2-3 reviews on the same student
2. Insights page → Past reviews section shows them sorted newest-first
3. Each shows correct Finalized/Draft badge

### 7. Test the lock at action level
- Try to send `updateReview` with the id of a finalized review (e.g., via curl with the right cookies)
- Server returns: "This review has been finalized and is read-only."

---

## Known limits / deferred to Phase 7c (or further)

- **Snapshot diffing**: clicking two past reviews to compare them side-by-side. Useful but not shipped.
- **Print view**: review detail page renders cleanly enough but no `@media print` styles.
- **Notification on finalize**: when a review is finalized, no email/Slack signal goes anywhere.
- **Cross-cutting analytics**: the per-goal ratings table is now queryable, but no dashboard surfaces "show me all 'not met' ratings in last 60 days" yet. Will come with Phase 8 reporting.
- **Per-section reviewer notes** (Q1's "reviewer notes per section"): right now notes are global to the review (Summary/Concerns/Next Steps). Per-section notes (e.g., per-test-trend, per-attendance) would require additional storage. Skipped for v1.
- **Editing snapshots**: snapshots are by design immutable. Even when a review is in draft, the snapshot blob is never edited — only the notes/ratings around it.
- **Restoring a review's plan if the plan was deleted**: cascade behavior is currently `on delete cascade` — if you delete a plan, all its reviews go with it. May want soft-delete in future.

---

## Next phase

This wraps up Phase 7. Reasonable next steps:
- **Phase 8**: notifications, Apple Health webhook, admin custom stats UI (deferred since Phase 4)
- **Phase 7c (optional)**: review comparison, print view, cross-cutting rating analytics
