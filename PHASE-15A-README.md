# MESA v2 — Phase 15a: Nutrition Tracker (Foundation)

**Status:** Ready to deploy
**SQL migration required:** `0019_phase15a_nutrition.sql` — **run this BEFORE deploying code.**

This phase adds a nutrition tracker for students and parents: daily calorie goal-setting, manual entry of food/drink with calorie counts, a today-view with progress bar, a 7-day overview, and full user control over data deletion. **Barcode scanning + Open Food Facts integration is deferred to Phase 15b** — this is the foundation.

---

## Key safety choices

This feature is built with adolescent disordered-eating risk taken seriously:

1. **Household-only visibility.** Students and parents see nutrition data. **Coaches, directors, admins, and trainers do NOT** (Q2 = B). Nutrition decisions for minors belong with the family and (eventually) a dietitian — not with the coaching staff. RLS enforces this; staff queries to nutrition tables return nothing.

2. **Calorie floor of 1,800 kcal.** Goals below this floor are rejected unless the user explicitly confirms via a "Confirm anyway" prompt that warns them. 1,800 is below recommended minimums for active teen males (≈2,400) and at the lower end for active teen females (≈1,800-2,200). It's the "definitely too low" cliff that should rarely be crossed.

3. **Age gate on goal-setting.** Per Q3 = B: parents can always set goals; students 16+ can self-set; students under 16 see "No goal set yet. Ask a parent to set your daily calorie goal." Age is computed from `students.date_of_birth`. If DOB is missing, the safe default is "not allowed to self-set."

4. **Shame-free UI.** No red bars when over goal. Neutral language ("of 2,400 kcal" not "1,200 OVER!"). 7-day view emphasizes "calories logged" not "calories under." Going over a goal triggers nothing — there's no "you went over" message anywhere.

5. **Educational copy at the top of every nutrition view.** For students: "You're an athlete. Eating enough is part of your training — not the opposite of it." For parents: "Active teen athletes typically need 2,200-3,000+ calories per day."

6. **Full user data deletion** at any time (Q10 = A). The Privacy section has a "Delete all" button that removes all entries + the goal in one action, with a confirm step.

---

## What you get

### New routes
- **`/dashboard/nutrition`** — students. Title: "My nutrition."
- **`/dashboard/family/[studentId]/nutrition`** — parents view their child's. Title: "[Child]'s nutrition"
- Both routes use the same `<NutritionTracker>` component; only `viewerRole` and copy differ.

### Sidebar / navigation
- Students get **"Nutrition"** under "Off Ice" in their sidebar (new).
- Parents get a **"Nutrition" link button** in the family detail page controls (new section in FamilyControls).

### Today section
- Big calorie total + remaining-to-goal display
- Sage progress bar (caps at 100% visually — no overshoot drama)
- List of today's entries with time stamps, item name, calorie count, delete button per row
- "+ Log" button opens a modal with name + calories fields (Q7 = A manual entry)

### 7-day section
- Mini bar chart of the past 7 days
- Each bar fills toward goal; full bar = goal met
- Today's bar is marked in crimson on the day label
- Only shown when a goal exists

### Goal section
- For parents: simple inline editor with help text
- For 16+ students: same inline editor with student-tone help ("Talk with a parent if unsure")
- For under-16 students: locked, with "ask a parent" message
- Below the floor warning: explicit two-button flow ("Confirm anyway" vs "Choose a higher goal")

### Privacy section ("Danger zone")
- "Delete all" button at the bottom of the page
- Two-step confirm before wipe
- Removes all entries + goal in one action

---

## Database (migration 0019)

### New tables

**`nutrition_goals`** (one row per student max):
- `student_id` (PK, FK to students, cascade delete)
- `daily_calories` (positive integer, no upper-bound check at DB level)
- `set_by` (FK to profiles — who last set it)
- `created_at`, `updated_at` (auto-managed)

**`nutrition_entries`** (one row per logged item):
- `id` (uuid PK)
- `student_id` (FK to students, cascade delete)
- `occurred_at` (timestamptz — when consumed; defaults to now)
- `name` (text — what was eaten)
- `calories` (integer, >= 0)
- `logged_by` (FK to profiles — who entered it)
- `created_at`, `updated_at`

### Indexes
- `nutrition_entries_student_time_idx (student_id, occurred_at desc)` — fast "show this student's recent entries"
- `nutrition_goals_set_by_idx (set_by)` — optional, for audit

### RLS
- Both tables: SELECT + ALL policies that require `is_self_student(student_id) OR is_parent_of(student_id)`. **`is_staff()` is NOT in the policy** — staff cannot read or write.

---

## Server actions (4 new)

1. **`setNutritionGoal(formData)`** — upserts the daily calorie goal. Enforces floor with confirm flow.
2. **`logNutritionEntry(formData)`** — inserts a single nutrition_entries row.
3. **`deleteNutritionEntry(formData)`** — deletes one entry by id.
4. **`deleteAllNutritionHistory(formData)`** — wipes ALL entries + the goal for one student. Requires `confirm=1` flag.

Action count: 92 → 96.

---

## Files added/changed

### New
- `supabase/migrations/0019_phase15a_nutrition.sql`
- `lib/nutrition.ts` — server-side data loader
- `components/nutrition/NutritionTracker.tsx` — main client component
- `app/dashboard/nutrition/page.tsx` — student route
- `app/dashboard/family/[studentId]/nutrition/page.tsx` — parent per-child route
- `PHASE-15A-README.md`

### Modified
- `lib/supabase/types.ts` — `NutritionGoal` and `NutritionEntry` interfaces added
- `app/actions.ts` — 4 new actions
- `components/layout/AppShell.tsx` — new `nutrition` icon + "Nutrition" item in student sidebar
- `app/dashboard/family/[studentId]/FamilyControls.tsx` — "Nutrition" link added to parent controls

### Files to delete from GitHub: none

---

## Deploy

### Step 1: Run migration 0019 in Supabase SQL Editor (FIRST)

1. Supabase Studio → SQL Editor
2. Open `supabase/migrations/0019_phase15a_nutrition.sql` from the zip
3. Paste contents into a new query
4. Click **Run**
5. You should see no errors. The script creates 2 tables, 4 RLS policies, 2 triggers, 2 indexes.

### Step 2: Push code to GitHub

1. Unzip `mesa-v2-phase-15a-clean.zip`
2. Upload contents to GitHub via Add file → Upload files (replace conflicts)
3. Commit: "Phase 15a: nutrition tracker foundation"
4. Vercel auto-deploys ~90s

### Step 3: Verify

**As a student:**
1. Visit `/dashboard/nutrition` (linked from sidebar under "Off Ice")
2. See the educational banner at top
3. If you're under 16 (per DOB): see "Ask a parent to set your daily calorie goal" in the Goal section
4. If you're 16+: see the inline goal editor
5. Try setting a goal below 1,800 → get the floor warning with Confirm-anyway flow
6. Click "+ Log", add a couple of items (e.g. "Banana" 100, "Granola bar" 180)
7. They appear in today's list with timestamps
8. Tap × on one → confirm → it disappears

**As a parent:**
1. Visit `/dashboard/family/[studentId]` (your child)
2. See the new "Nutrition" link button in the controls section → click "Open"
3. Page is `/dashboard/family/[studentId]/nutrition`
4. Set the daily goal (e.g. 2400)
5. Log entries — works identically to the student side
6. Navigate back, repeat for a different child if applicable

**As staff (admin/director/coach/trainer):**
1. There's no nutrition link in your sidebar (intentional)
2. Try to navigate to `/dashboard/nutrition` directly → bounced (`requireRole('student')`)
3. Try `/dashboard/family/[studentId]/nutrition` directly → bounced (`role !== 'parent'`)
4. Even if you bypassed the page guard, RLS on `nutrition_goals` and `nutrition_entries` would return zero rows

---

## Known limits / cosmetic notes

- **No barcode scanning yet.** Phase 15b will add Open Food Facts integration + camera-based UPC scanning. This phase is manual entry only.
- **No macros (protein/carbs/fat).** Q4 = A — calories only. Future phase if needed.
- **No adaptive goals based on training load.** Q5 = A — static goal, same every day. The educational copy reminds users to eat more on heavy training days.
- **Floor is a soft warning.** A determined user can click "Confirm anyway" and set a goal below 1,800. This is by design — accommodation for the rare case where a registered dietitian has prescribed a lower number for legitimate medical reasons. The friction is the safeguard.
- **No parent notifications.** Q9 = B (parent-email alerts when student logs low days) was not chosen because Resend isn't set up. Could add later.
- **No nutritional content scoring.** Tracks calories only. A donut and an apple of equal calories look the same in MESA. By design — the tracker is for awareness, not for moralizing food choices.
- **Goal floor message is universal.** Doesn't differ by sex or age — single conservative number to avoid the data sensitivity of inferring sex-based recommendations from `position` (which isn't a sex field).
- **Time zones**: `occurred_at` is stored as `timestamptz` (UTC). The 7-day bucketing uses the server's date, which on Vercel is UTC. For US users, this means a midnight-EST log could land in the "next day's" bucket UTC-side. Minor cosmetic issue; fix would be to use the user's local timezone explicitly. Out of scope for 15a.
- **No "yesterday" navigation.** The Today section shows only today. To see earlier days you have to look at the 7-day strip totals. Detailed history viewing for past days is a future addition.
- **Sidebar position.** Nutrition is under "Off Ice" in the student sidebar. If you prefer it elsewhere (Profile section? top-level?), the change is one line in `components/layout/AppShell.tsx`.

---

## Phase 15b: what comes next

When you say "build the barcode scanner," I'll add:
- Camera access via `getUserMedia` and `@zxing/library` for barcode detection (mobile-first)
- Open Food Facts integration for UPC → calorie lookup (free, no API key)
- Confirm-the-parsed-data flow (Q14 = B) — user reviews calorie count before saving
- Manual UPC entry fallback when camera unavailable
- Library of recently-scanned items for quick re-log

All foundation-dependent. Phase 15a's `nutrition_entries.name` and `calories` columns are exactly what the scanner will populate — same data model.

---

## Other next phase candidates (not nutrition-specific)
- **Phase 8 notifications via Resend** — still gated on signup
- **Practice plan templates** leveraging the Phase 13 drill library
- **Self-create workouts** for students (deferred Q1=C from Phase 9)
- **Coach-side review templates** for the Phase 14 bullet notes
