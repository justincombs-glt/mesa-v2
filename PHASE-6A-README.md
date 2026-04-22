# MESA v2 — Phase 6a: Student & Parent Dashboards

**Status:** Ready to deploy
**What's new:** Students get a real home screen. Parents get a family page listing their linked children with per-child detail views. Under-13 students are blocked from having their own login account (COPPA-style soft gate).

---

## What shipped

### Student home (`/dashboard` for role=student)
- **4-card summary strip**: active goals count, attendance percentage, lifetime sets logged, current season name
- **Goal plans** section: active plans in current season with goal counts, click through to full detail
- **Upcoming / Recent activities** side-by-side: next 5 scheduled + last 5 completed activities (practices, games, workouts)
- **Latest test results**: top 5 distinct tests most recently recorded, with baseline badge
- **About** meta: name, jersey, position, hand

### Parent home + family (`/dashboard` and `/dashboard/family` for role=parent)
- Both pages list the parent's linked students with per-child goal counts
- Click any child → per-child read-only view (same shape as student home, with `isParentView` mode — no self-service nav links)
- If parent has no linked students, a friendly empty state explains how to link

### Per-child view (`/dashboard/family/[studentId]`)
- Uses the same `StudentDashboardView` component as the student home
- Auth-checked: parent must have a `family_links` row matching (parent_id, student_id). Admin/director/coach/trainer can also access.

### Student routes
- `/dashboard/my-goals` — student's own goal plans list
- `/dashboard/my-goals/[planId]` — plan detail (reuses existing `PlanDetailClient` with `readOnly={true}`); auth-checked to ensure the plan belongs to this student
- `/dashboard/my-performance` — student's own performance test result history

### Age gate (Q2 = C)
Sub-13 students stay as data-only records. No login accounts allowed. Enforced in two places:

1. **Invite modal UI**: when admin/director picks role=student, a student picker appears. Under-13 options are disabled in the dropdown with "(under 13 — not eligible)" label. Submit button is disabled if an under-13 student is selected.
2. **Server actions**: both `createInvite` and `linkStudentProfile` check `students.date_of_birth` and reject if the DOB is less than 13 years ago. Students without DOB (grandfathered existing records) pass silently.

### Multi-parent linking (Q3 = B)
Already supported at schema level — `family_links` junction table is unique on `(parent_id, student_id)` with no "primary parent" constraint. A student can have multiple linked parents; each parent sees the same student in their family list.

### Sidebar changes
- Student sidebar: Goal Management → **My Goals**, Performance Management → **My Performance**
- Parent sidebar: unchanged (still `/dashboard/family` which now renders the index)

---

## Files added/changed

**New:**
- supabase/migrations/0011_phase6a_dashboards.sql
- lib/student-dashboard.ts
- components/student/StudentDashboardView.tsx
- app/dashboard/family/[studentId]/page.tsx
- app/dashboard/my-goals/page.tsx
- app/dashboard/my-goals/[planId]/page.tsx
- app/dashboard/my-performance/page.tsx
- PHASE-6A-README.md

**Replaced:**
- app/dashboard/page.tsx (was generic welcome; now role-aware)
- app/dashboard/family/page.tsx (was ComingSoon stub)
- components/layout/AppShell.tsx (student sidebar routes updated)
- app/dashboard/invite/InviteClient.tsx (student picker + age gate UI)
- app/dashboard/invite/page.tsx (fetches active students for picker)
- app/actions.ts (createInvite + linkStudentProfile check DOB)

**Actions**: 81 total, no duplicates. No new actions added — just updated `createInvite` and `linkStudentProfile` with the age-gate check.

---

## Database

**One new migration**: `supabase/migrations/0011_phase6a_dashboards.sql`

What it does:
- Adds `public.student_under_13(p_student_id uuid)` SQL helper (available for future RLS uses)
- Refreshes `public.can_view_student(p_student_id uuid)` with explicit paths for admin, director, staff, self (profile → student), and parent (family_links). Defense-in-depth rewrite.
- Refreshes PostgREST schema cache

No new tables. Idempotent. Safe to re-run.

---

## Deploy steps

### Step 1 — Run the SQL migration (REQUIRED, do this FIRST)
1. Open Supabase → SQL Editor → New query
2. Paste the contents of `supabase/migrations/0011_phase6a_dashboards.sql`
3. Click **Run**
4. Expect "Success. No rows returned."

### Step 2 — Upload source files
1. Unzip `mesa-v2-phase6a-clean.zip` on your Mac
2. GitHub → `mesa-2` repo → Add file → Upload files
3. Drag the CONTENTS of the unzipped folder (not the folder itself). Replace any conflicts.
4. Commit: `Phase 6a: Student & parent dashboards + age gate`
5. Vercel auto-deploys in ~90 seconds
6. Hard refresh or Incognito

No env var changes.

---

## How to test

### Prerequisites
- A current season must be active with students enrolled
- At least one goal plan for a student, ideally with a composite test attached
- At least one practice or game scheduled with that student on the roster
- Some performance test results recorded for the student (via `/dashboard/cpt-sessions` as trainer)

### 1. Student dashboard
1. In `/dashboard/students`, pick a student ≥13 years old with an email address (or invite one)
2. As admin, go to `/dashboard/invite`, pick **role = student**, pick the student from the dropdown. Submit.
3. Have that person sign up at the MESA URL with the invited email. They land on their dashboard.
4. Confirm:
   - Summary cards populate
   - Active goals show with plan links
   - Upcoming/Recent columns have activities
   - Click a plan → opens `PlanDetailClient` in read-only mode (no Edit/Delete buttons)
   - Click "My Performance" → shows results list

### 2. Parent dashboard
1. As admin, link a parent account to 1 or 2 students via the student admin page (`/dashboard/students/[id]` → link parent section)
2. Log in as the parent
3. Home page shows the list of linked children with goal counts
4. Sidebar "My Family" also shows the list
5. Click a child → per-child detail (same shape as student home, but no edit/navigation links)

### 3. Multi-parent test
1. Link a second parent to the same student
2. Both parents should see that student in their family list
3. Log in as each parent separately to confirm both see the full dashboard

### 4. Age gate test
1. Create a student with DOB set to 10 years ago (under 13)
2. Go to `/dashboard/invite`, pick role = student
3. Student picker opens — the 10-year-old's option is disabled with "(under 13 — not eligible)"
4. If you try to submit via dev-tools hackery, the server action returns an error explaining why
5. Change the DOB to 13+ years ago → option becomes selectable, invite goes through

### 5. Linking path
1. An over-13 student signs up via invite → their profile is auto-connected via `linkStudentProfile`
2. If DOB changed to under 13 retroactively, subsequent link attempts are blocked server-side

---

## Known limits / deferred to Phase 6b

- **Parent-adds-child flow** — currently admin/director must create all student records. A parent can't self-serve their own child creation. Deferred.
- **Multi-parent UI refinements** — schema supports many parents per student, but admin UI for managing that relationship is still the single-parent flow.
- **Student self-registration (open signup)** — Q1 = A answer: invite-only remains.
- **Parent relationship labels** — field exists (`family_links.relationship`) but UI doesn't prominently display it yet.

---

## Next phase (6b)

- Parent self-serves adding a child (creates a `students` row + `family_links` row atomically)
- Multi-parent management UI (view/remove additional parent links from student admin page)
- Optional: relationship label shown in parent dashboard (e.g., "Mother · ...")
