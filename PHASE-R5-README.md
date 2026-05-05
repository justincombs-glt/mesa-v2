# MESA v2 — Phase R.5: Manual User-to-Student Linking

**Status:** Ready to deploy
**No SQL migration required.** Existing RLS policies already permit admin/director writes to `family_links` and `students.profile_id`. Pure code changes.

Director (and admin) can now link existing user accounts to student records directly, without going through the invite flow. Useful when a parent or student signed up through some other path and the director needs to retroactively wire them up. Also fixes a latent bug where the existing student-account link modal was sending the wrong form field name and silently failing.

---

## Background — what existed before this phase

The student detail page at `/dashboard/students/[id]` already had:
- A "Linked parents" section showing connected parent accounts (via `family_links`)
- A "Student login" section showing the linked student account (via `students.profile_id`)
- "+ Link" buttons that opened modals
- Server actions `linkParent`, `unlinkParent`, `linkStudentProfile`, `unlinkStudentProfile`

What was wrong:
- The student-account link modal sent form field `student_email`, but the action read `profile_email` — so the form **always returned "Missing fields"** and never actually linked anyone. Latent bug.
- Email-input field with no autocomplete — director had to know the exact email
- No confirmation before linking (sensitive operation that grants data access)
- No edge case handling for "already linked to a different student"
- No block on linking yourself

---

## What shipped

### Searchable autocomplete user picker (Q5 = B)
New `<UserPicker>` component on both link modals:
- Type 2+ characters of email or name
- Backend search runs (debounced 250ms) via the new `searchProfilesByEmail` server action
- Top 10 matches appear in a dropdown
- Filtered by role: parent picker shows only parents; student picker shows only students
- "No matches found" state includes a link to `/dashboard/invite` with the suggestion to send an invite instead
- Once selected, the picker shows a confirmation card with name + email + role; "Change" button to pick a different one

### Confirmation dialogs (Q7 = B)
Before any link/unlink operation, browser `confirm()` dialog with a clear question:
- Linking: "Link {name} ({email}) as a parent of {student}? They will gain access to this student's data."
- Unlinking: "Unlink {name} from {student}? They will lose access to this student's data."

User cancels → nothing happens. User confirms → the action runs.

### Edge case handling
1. **Email/profile not found** → friendly error suggesting invite flow
2. **Wrong role** (e.g., trying to link a coach as a parent) → blocked with role-mismatch error
3. **Already linked** (idempotency) → friendly "{email} is already linked to this student" message; no crash
4. **Student record already has a profile_id** → blocked: "{student} is already linked to a user account. Unlink the current account before linking a new one."
5. **Linking yourself** → blocked: "You can't link your own account as a parent/student."
6. **Sub-13 student** → blocked (existing age gate from Phase 6a, preserved)

### Bug fix
The `linkStudentProfile` modal was using form field name `student_email` while the server action read `profile_email`. Now both are normalized to use `profile_id` (from the autocomplete) with `profile_email` as a legacy fallback. The link operation now actually works for the first time.

### Server-side hardening
All four link/unlink actions now call `requireRole('admin', 'director')` at the top — defense in depth. Previously they relied on RLS alone, which would fail at the database level rather than rejecting cleanly at the application layer.

---

## What did NOT change

- **No new database migration** — existing RLS policies on `family_links` ("Family: staff manages") and `students` ("Student: staff updates") already permit admin and director to write these tables. Verified.
- **No new tables, no schema changes**
- **Other roles' UIs**: unchanged
- **Sidebar structure**: unchanged
- **Invite flow** at `/dashboard/invite`: unchanged. The two flows (invite vs. link existing) coexist.

---

## Files added/changed

**New:**
- PHASE-R5-README.md

**Changed:**
- app/actions.ts — added `searchProfilesByEmail` action + `ProfileSearchResult` interface; rewrote `linkParent`, `unlinkParent`, `linkStudentProfile`, `unlinkStudentProfile` with `requireRole`, edge cases, accept `profile_id` from autocomplete (falls back to email)
- app/dashboard/students/[id]/StudentAdminClient.tsx — replaced email-input fields with `<UserPicker>` autocomplete component; added confirmation dialogs to all link/unlink operations; added new `<UserPicker>` component at end of file

**Files to delete from GitHub:** none.

**Actions**: 87 total (was 86, +1 for `searchProfilesByEmail`). No duplicates.

---

## Database

**No migration required.** Existing RLS policies already cover the required operations:

| Table | Required permission | Existing policy |
|---|---|---|
| `profiles` (read for search) | admin/director SELECT | "Profile: read all if staff" |
| `family_links` (insert) | admin/director INSERT | "Family: staff manages" (FOR ALL) |
| `family_links` (delete) | admin/director DELETE | "Family: staff manages" (FOR ALL) |
| `students.profile_id` (update) | admin/director UPDATE | "Student: staff updates" |

If anything fails at the database level after deploy, suspect that one of these existing policies has been changed in a recent migration — but they should all be intact.

---

## Deploy steps

1. Unzip `mesa-v2-phase-r5-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
3. Commit: `Phase R.5: Manual user-to-student linking`
4. Vercel auto-deploys ~90s
5. Hard refresh

---

## How to test

### 1. Setup
Need at least:
- A student record (any age, but for student-account linking specifically, age 13+)
- A parent-role user account (someone signed up via `/sign-up` and got the parent role automatically)
- A student-role user account (only relevant for student linkage; signed up via `/sign-up` with date_of_birth supplied)

If you don't have these in your test data, sign up a couple of test accounts first.

### 2. Link an existing parent account
1. Sign in as director
2. Navigate to a student's detail page (`/dashboard/students/{id}`)
3. In the right column, find "Linked parents" section
4. Click "+ Link"
5. Modal opens with "Find a parent" search field
6. Type the first 2 characters of a parent email — autocomplete dropdown appears with matches
7. Click a result → search field replaced with selection card showing name + email + role
8. Pick a relationship from dropdown
9. Click "Link parent" → browser confirm dialog asks: "Link {name}…?"
10. Click OK → modal closes, parent appears in the linked list

### 3. Edge case: not found
1. + Link
2. Type a search that won't match (e.g. "zzzz")
3. Dropdown shows: "No parents found for 'zzzz'. Send an invite instead?"
4. Click the invite link → routes to `/dashboard/invite`

### 4. Edge case: already linked
1. Try to link a parent who's already linked to this student
2. Pick them from autocomplete → confirm → action returns error: "{email} is already linked to this student."

### 5. Edge case: linking yourself
1. As director (logged in)
2. Try to link YOUR OWN account as a parent of any student
3. Your account has role 'director', not 'parent', so the autocomplete won't even show you (filtered)
4. (If you somehow have a parent-role account that's also you, the action will reject with "You can't link your own account as a parent.")

### 6. Unlink a parent (with confirmation)
1. On a student with a linked parent
2. Tap "Unlink" on the parent's card
3. Browser confirm: "Unlink {name} from {student}? They will lose access…"
4. OK → parent disappears from linked list

### 7. Link student account
1. Find a student-role user account (someone who signed up via /sign-up with their DOB)
2. On a student detail page (student must be 13+ for this to work)
3. "Student login" section → "+ Link account"
4. Search and pick the student account
5. Confirm → linked

### 8. Edge case: student already has a profile linked
1. On a student that's already got a linked student account
2. Notice the "+ Link account" button is hidden (since it's already linked)
3. Click "Unlink" first → confirm → unlink
4. Now "+ Link account" is back; you can link a different student account

### 9. Bug fix verification
The previous broken behavior: open a student record without a linked profile, click "+ Link account", enter any email → would always show "Missing fields" error. Now it works (uses the autocomplete + profile_id flow).

### 10. Mobile
1. On phone, navigate to a student detail page
2. Modals are bottom-sheet style (Phase Ma)
3. Autocomplete dropdown works inside the modal
4. Confirmation dialogs use the native iOS/Android prompt
5. Link/unlink works as expected

---

## Known limits / cosmetic notes

- **Search is prefix on email + substring on name**. Searching "ohn" might not find "John Smith" by email but will find "John" by name. Fine for normal use.
- **No notification to the linked user** (Q8 = A). When director links a parent, the parent has no idea unless they happen to log in and see the new student data. This is OK for now; will add email notification once Phase 8 (notifications via Resend) ships.
- **No audit log** (Q7 punted on C). If a linking goes wrong, there's no record of who did it when. Since admin/director are trusted roles, this is acceptable. Adding an `audit_log` table is a separate scope conversation.
- **Student account linking only works for 13+** (preserved age gate). Sub-13 students can't have their own login; their parents' accounts give access.
- **Native browser `confirm()`** is used for the dialogs. It's functional but ugly. A custom modal-based confirmation could replace it later for polish.
- **Search results are not paginated** — first 10 matches only. If you have many users with similar names, refine the search by typing more.

---

## Next phase candidates

- Phase 8 (notifications via Resend) — emit email when a user is linked/unlinked
- Audit log for sensitive operations (linking, unlinking, role changes)
- Custom-styled confirmation dialogs (replace native `confirm()`)
- "Pending invites" panel on the student detail page to see invites already sent for this student
