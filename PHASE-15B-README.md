# MESA v2 — Phase 15b: Trainer View-Only Access to Nutrition

**Status:** Ready to deploy
**SQL migration required:** `0020_phase15b_trainer_nutrition_read.sql` — **run this BEFORE deploying code.**

This phase widens the Phase 15a nutrition tracker so **trainers** (and only trainers — not coaches, directors, or admins) can **view** every athlete's calorie data. Writes remain household-only: parents and 16+ students set goals and log entries; nothing changes about that. Trainers see, but don't touch.

---

## Access summary after this phase

| Role | Read nutrition? | Write nutrition? |
|---|---|---|
| Student (self) | Yes | Yes (goal: 16+, entries: any age) |
| Parent (of student) | Yes | Yes |
| **Trainer** | **Yes (new)** | **No** |
| Coach | No | No |
| Director | No | No |
| Admin | No | No |

The "no" rows above mean exactly that — RLS rejects their reads at the database. The pages also guard at the route level.

---

## What you get

### Database (migration 0020)
- Two new SELECT-only RLS policies — one on `nutrition_goals`, one on `nutrition_entries` — that admit any user with `role='trainer'`. Existing household policies are untouched and continue to work alongside.
- **No new write policies.** Trainer writes hit the existing household-only write policies and fail with permission errors.

### New routes (trainer-side)
- **`/dashboard/nutrition-overview`** — alphabetical list of all active students, one row per athlete, showing today's calorie total, daily goal, and 7-day average. Tappable rows.
- **`/dashboard/nutrition-overview/[studentId]`** — per-student detail. Shows today's progress, the 7-day strip, and today's logged entries. **Fully read-only** — no log button, no delete buttons, no goal editor.

### New sidebar item
- Trainer sidebar gets a new "Athletes" group with one item: **Nutrition** (icon: stylized fork). Tapping it opens the overview list.

### New link on insights page
- When a trainer (and only a trainer) opens `/dashboard/students/[id]/insights`, a small "View nutrition log →" link appears under the page header. Click it → jump to that student's nutrition detail.

### What households see
- **Nothing changes for students or parents.** Same UI, same routes, same workflow. The change is invisible to them at the application layer.

---

## What did NOT change

- **No new server actions.** This phase is pure read access — RLS + a new sidebar/route. Action count stays at 96.
- **No changes to the Phase 15a nutrition page** (`/dashboard/nutrition`, `/dashboard/family/[studentId]/nutrition`). Households see and interact exactly as before.
- **No trainer notes** (Q8 = A confirmed). Trainers cannot annotate, comment on, or otherwise modify nutrition data.
- **No filtering or search** on the overview list (Q7 = A). Plain alphabetical sort.
- **No disclosure banner for families** (Q6 = D). The change deploys silently; you communicate it however you prefer.

---

## Files added/changed

### New
- `supabase/migrations/0020_phase15b_trainer_nutrition_read.sql`
- `components/nutrition/TrainerNutritionView.tsx` — read-only per-student view
- `app/dashboard/nutrition-overview/page.tsx` — overview list
- `app/dashboard/nutrition-overview/[studentId]/page.tsx` — per-student detail
- `PHASE-15B-README.md`

### Modified
- `lib/nutrition.ts` — added `NutritionOverviewRow` type + `buildNutritionOverview()` function
- `components/layout/AppShell.tsx` — added "Athletes → Nutrition" item to trainer sidebar
- `app/dashboard/students/[id]/insights/page.tsx` — captures the profile from `requireRole`; if profile is trainer, shows a small "View nutrition log →" link below the page header

### Files to delete from GitHub: none

---

## Deploy

### Step 1: Run migration 0020 in Supabase SQL Editor (FIRST)

1. Supabase Studio → SQL Editor
2. Open `supabase/migrations/0020_phase15b_trainer_nutrition_read.sql` from the zip
3. Paste contents into a new query
4. Click **Run**
5. The script creates 2 SELECT-only RLS policies and refreshes the PostgREST schema cache. Idempotent.

### Step 2: Push code to GitHub

1. Unzip `mesa-v2-phase-15b-clean.zip`
2. Upload contents to GitHub via Add file → Upload files (replace conflicts)
3. Commit: "Phase 15b: trainer view-only access to nutrition"
4. Vercel auto-deploys ~90s

### Step 3: Verify

**As a trainer:**
1. Sidebar shows new "Athletes → Nutrition" item
2. Click → land on the overview list with every active student
3. Each row shows today's calories, goal, 7-day average; an em-dash if any value is null
4. Click any row → land on that student's detail page
5. See today panel, 7-day strip, today's entries — all read-only, no edit affordances
6. Navigate to `/dashboard/students/[id]/insights` for a student → see the new "View nutrition log →" link below the title
7. Click it → arrives at the same nutrition detail page

**As a student (existing 15a flow):**
1. `/dashboard/nutrition` — unchanged. Log entries, set goals, delete history — all the same.

**As a parent (existing 15a flow):**
1. `/dashboard/family/[studentId]/nutrition` — unchanged. Same controls.

**As coach/director/admin:**
1. No "Nutrition" link in your sidebar
2. Try navigating directly to `/dashboard/nutrition-overview` → bounced (`requireRole('trainer')`)
3. Even if you somehow bypassed the page guard, RLS rejects your SELECT queries on the nutrition tables.

---

## Security model (defense in depth)

For each access pattern, multiple gates enforce the rule:

| Attempt | Page guard | RLS read | RLS write |
|---|---|---|---|
| Trainer reads nutrition | `requireRole('trainer')` allows | `is_trainer()` allows | (no write attempted) |
| Trainer writes nutrition | (no UI path exists) | n/a | only household policy — rejects |
| Coach navigates to overview | `requireRole('trainer')` bounces | n/a | n/a |
| Coach queries DB directly | n/a | only household + trainer — rejects | only household — rejects |
| Student reads own | `requireRole('student')` allows | household read allows | household write allows |
| Parent reads child's | `profile.role === 'parent'` allows | household read allows | household write allows |

The RLS-only fallback matters because a determined developer with a Supabase client key could bypass page guards. Even then, RLS rejects.

---

## Known limits / cosmetic notes

- **Trainer sees ALL active students.** No "my assigned athletes" concept — every trainer in the academy sees every student. If you have multiple trainers and want each scoped to their own roster, that's a future schema addition (assigned_trainer relationship).
- **Overview list is unsorted aside from alphabetical.** No "sort by today's calories ascending" to find under-eaters quickly. Q7 = A. Easy to add later.
- **No notification when an athlete has a low day.** Trainer has to actively check. If you want passive alerting ("Justin's eaten 600 cal by 3pm"), that's a future Resend-dependent feature.
- **No history view beyond 7 days.** The overview shows the rolling 7-day window. To see a player's nutrition from three weeks ago, no UI exists. Probably fine — the point of this is contemporaneous fueling guidance, not retrospective forensics.
- **Time zones**: same UTC caveat as Phase 15a. Date bucketing uses server time (UTC). For Eastern Time users near midnight, edge-case bucketing applies.
- **No "no goal set" filter.** Trainer who wants to know which players don't have goals has to scan the Goal column manually for em-dashes. Filter is a one-line addition if useful.
- **The insights-page link is trainer-only.** Coach/director on the insights page see no nutrition link — by design (Q1 = A).

---

## Suggested next phase candidates

- **Phase 15c: barcode scanner** — still the natural next step on nutrition itself. Manual entry was the foundation; UPC scanning + Open Food Facts integration is the convenience layer.
- **Trainer "low-calorie" notifications via Resend** — passive alerts when an athlete's daily total is dramatically below their goal at some hour cutoff
- **Assigned-trainer concept** — formal relationship between trainers and a subset of athletes; the overview list could then default to "my athletes"
- **Macros tracking** — protein/carbs/fat. Q4 from Phase 15a was A (calories only); revisit if useful
- **Practice plan templates** leveraging the Phase 13 drill library
- **Self-create workouts** for students (still deferred from Phase 9)
- **Phase 8 notifications via Resend** (still gated on signup)
