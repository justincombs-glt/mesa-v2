# MESA v2 — Phase 6b: Parent-Adds-Child + Multi-Parent UI

**Status:** Ready to deploy

Parents can now self-register their own children's student records without admin involvement. Admin retains the ability to fully manage multi-parent linkage.

---

## What shipped

### Parent adds a child (Q1 = A, onboarding hybrid)
- **"+ Add child" button** in the parent's family page header (`/dashboard/family`) and home dashboard
- **Empty-state onboarding**: if a parent signs up with zero linked students, both `/dashboard` and `/dashboard/family` show "Add my first child" as a primary CTA in the empty state
- **Modal form** with required + optional sections:
  - Required: full name, date of birth, relationship label (Mother / Father / Guardian / Grandparent / Other-with-text)
  - Optional (collapsible "More details" section): jersey number, position, dominant hand, notes
- **Atomic creation**: submits → creates `students` row + `family_links` row (parent ↔ student) + auto-enrolls in current season, all in one action
- **Helpful warning** in the modal explaining that the academy will see the record and that parents can't self-edit after creation (they must contact the academy for corrections)

### Auto-enroll on student creation (bonus gap fix)
`createStudent` now auto-enrolls the new student in the current season (both for admin-created and parent-created students). This was Q9=A from Phase 3.5 but was never implemented in the action — only in the one-time backfill when seasons were first seeded. Fixed now.

### Duplicate detection (Q5 = B, soft check)
Before creating a new student via the parent flow, the server checks for existing students with the same case-insensitive name AND same date of birth. If a match exists, the request is rejected with a message asking the parent to contact the academy to link their account to the existing record. Prevents accidental duplicates and lookup-abuse fishing attempts.

### Age gate (Q4 = A, unchanged from Phase 6a)
Parents can add children of ANY age — sub-13 records are fine as data. The previously-shipped age gate on `createInvite` / `linkStudentProfile` still prevents sub-13 login accounts from being created.

### Relationship labels (Q7 = C)
Dropdown: Mother, Father, Guardian, Grandparent, Other…. Picking "Other…" reveals a text input for the parent to type a specific label (e.g. "Step-parent", "Legal Guardian"). Used in both the parent-adds-child modal and the admin link-parent modal. Existing Phase 6a `AddParentLinkModal` upgraded with the Grandparent option + Other-specify.

### Admin multi-parent UI (Q6 = A, unchanged — already existed)
Admin's `/dashboard/students/[id]` page already supported viewing multiple linked parents with individual "Unlink" buttons and an "Add parent" button. Phase 6b just upgraded the relationship dropdown options.

---

## Files added/changed

**New:**
- supabase/migrations/0013_phase6b_parent_creates_child.sql
- app/dashboard/family/AddChildModal.tsx
- app/dashboard/family/AddChildButton.tsx
- PHASE-6B-README.md

**Changed:**
- app/actions.ts: added `createStudentAsParent`, `updateFamilyLinkRelationship`; modified `createStudent` to auto-enroll in current season; modified `linkParent` to handle `relationship_other` freeform
- app/dashboard/family/page.tsx: imports AddChildButton; empty state shows onboarding button; filled state shows header button (parent role only)
- app/dashboard/page.tsx: parent home empty state shows onboarding button; parent home filled state shows header button
- app/dashboard/students/[id]/StudentAdminClient.tsx: AddParentLinkModal gains Grandparent option + Other-specify freeform field

**Actions:** 83 total, no duplicates (up from 81 in Phase 6a).

---

## Database

**One new migration**: `supabase/migrations/0013_phase6b_parent_creates_child.sql`

What it does:
1. Adds `public.is_parent()` helper function
2. Adds RLS policy on `students` allowing role=parent to INSERT (not update/delete — those remain staff-only)
3. Adds RLS policies on `family_links`: parent can INSERT only where `parent_id = auth.uid()`, and DELETE their own links
4. Adds RLS policy on `season_enrollments` allowing parents to INSERT for students they're linked to
5. Refreshes PostgREST schema cache

**Why these policies are safe:** a parent can only create new records, not modify existing ones. They can only link themselves (never another user) to a student. They can only enroll students already linked to them. All creation paths also hit server-side validation in `createStudentAsParent` (duplicate check, required fields, role check).

Idempotent. Safe to re-run.

---

## Deploy steps

### Step 1 — Run the SQL migration (REQUIRED, do this FIRST)
1. Open Supabase → SQL Editor → New query
2. Paste `supabase/migrations/0013_phase6b_parent_creates_child.sql`
3. Run
4. Expect "Success. No rows returned."

Without this, parents will get RLS errors when submitting the Add Child form.

### Step 2 — Upload source files
1. Unzip `mesa-v2-phase6b-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
3. Commit: `Phase 6b: Parent-adds-child + multi-parent UI`
4. Vercel redeploys in ~90s
5. Hard refresh

---

## How to test

### Prerequisites
- A current season must be marked `is_current = true`
- You have (or can create) a parent-role user via invite (admin creates an invite with role=parent, you sign up with that email)

### 1. New parent onboarding
1. Create a fresh parent invite as admin (role = parent, no linked_student_id)
2. Sign up with that invite in an Incognito window
3. Land on `/dashboard` — you should see "Add my first child" button in the empty state
4. Click it → Add Child modal opens
5. Fill in: name + DOB + relationship = Mother. Submit.
6. Modal closes, page refreshes, child appears in family list
7. Click child → per-child read-only dashboard (from Phase 6a) shows their info

### 2. Add second child (multi-kid household)
1. On `/dashboard/family`, click "+ Add child" button in header
2. Fill in a second child's info. Submit.
3. Family page now shows both children
4. Each child is independently clickable for their detail view

### 3. Duplicate detection
1. As the same parent, click "+ Add child" again
2. Enter the same name + DOB as child #1
3. Submit → error message: "A student named '[name]' with that birthday already exists. Please contact the academy…"

### 4. Optional fields collapse
1. Open Add Child modal
2. Confirm the "+ More details (optional)" link works — clicking it shows/hides jersey, position, hand, notes
3. You can submit with only required fields

### 5. Admin sees parent-created records
1. Sign in as admin
2. Go to `/dashboard/students`
3. The parent-created student(s) appear in the list like any other student
4. Click the student → their `Linked parents` section shows the creating parent with the relationship label

### 6. Admin multi-parent test
1. On `/dashboard/students/[id]` for a parent-created child, click "+ Add parent"
2. Enter a second parent's email (they must already have a MESA account)
3. Pick relationship = Father
4. Link → row appears showing both parents

### 7. Other-specify
1. In Add Child OR Add Parent modal, pick relationship = Other…
2. A "specify" text input appears
3. Type "Step-parent"
4. Submit → the relationship saves as "Step-parent" literally (not "Other")

### 8. Auto-enrollment (verify for admin too)
1. As admin, create a new student via `/dashboard/students` → "+ Add student"
2. Navigate to `/dashboard/seasons` → the current season's roster includes the new student
3. Same for parent-created students

---

## Known limits / deferred

- **Parent edits child record** — parents can create but not edit. Corrections require the academy.
- **Parent invites co-parent** — Phase 6b keeps admin in charge of multi-parent linkage. Parent-invites-spouse would be Phase 6c.
- **Student already exists but parent isn't linked** — the duplicate-check message tells the parent to contact the academy, but there's no in-app "request to link to existing student" flow yet. Admin manually links via `/dashboard/students/[id]`.
- **Notification to academy** — when a parent creates a child, the academy isn't notified (no email/Slack/etc.) until Phase 8 adds notifications. Admin has to periodically check `/dashboard/students`.
- **Relationship label validation** — "Other" freeform text isn't sanitized beyond trimming. Not a security issue (it's displayed in-app only, and safe React rendering escapes), but if you want a controlled vocabulary later, extend Q7 to a fixed enum.

---

## Next phase (6c candidate)

- Parent invites co-parent directly from family dashboard (delegates what's currently admin-only in Q6)
- Academy email notifications on parent-created student records
- Optional in-app "request link to existing student" flow for parents to avoid the duplicate-error dead-end
