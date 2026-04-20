# MESA v2 — Phase 3a: Director Module (Part 1)

Builds on Phase 2 + 2.5. Three director sidebar items now real:

- **Add Users** (`/dashboard/invite`)
- **Students** (`/dashboard/students`) + per-student admin
- **Practice Plans** (`/dashboard/practice-plans`) + per-plan editor

The remaining director pages (**Goal Management**, **Performance Management**) are still stubs and arrive in Phase 3b.

---

## What's new in Phase 3a

### Add Users (`/dashboard/invite`)

Invite-only flavor for director. Send invites with email + role + optional note. Pending invites listed below with revoke option.

The admin's full Users page (with role-change for existing users) stays separate — directors don't need that level of control.

### Students directory (`/dashboard/students`)

- Search by name, jersey, position, team label
- Active students at top, inactive collapsed below with "Reactivate" buttons
- Each row shows jersey number, name, position, dominant hand, team label, parent count, and a "Has login" badge if a student account is linked
- "Enroll student" button opens a modal with all v1 fields preserved (full name required, everything else optional)

### Per-student admin (`/dashboard/students/[id]`)

Three sections in a 3+2 column layout:

1. **Edit form** (left, larger): all student fields, save/deactivate
2. **Linked parents** (right top): shows linked parents with relationship + primary status; add by email; unlink button
3. **Student login** (right bottom): if a student profile is linked, shows it; otherwise lets you link by email (validates the target user has role='student')

Parent and student-link workflows both **require the target user to have signed up first**. You'll see a clear error message if the email isn't found.

### Practice Plans (`/dashboard/practice-plans`)

- Card grid showing each plan with title, focus, drill count + skill count
- "New plan" button creates a basic plan, then redirects to the editor

### Practice Plan editor (`/dashboard/practice-plans/[id]`)

- Left column: plan metadata (title, focus, description, target duration)
- Right column: ordered list of items
- **Add Drill** button opens picker → search drill library → click to add
- **Add Skill** button opens form → free-text title + duration → add
- **Reorder** items with ↑/↓ arrows
- **Per-item duration override** + **per-item coach notes**
- Live total minutes calculation
- Click "Save plan" to commit all changes (item ordering, edits, deletions all flush at once)
- "Delete plan" button with confirm

---

## What's NOT in Phase 3a

- Goal Management page (Phase 3b)
- Performance Management page (Phase 3b)
- Coach can see Practice Plans but creating practices from them happens in Phase 4
- Self-registration flow for students (still needs invite for now — Phase 6 adds public sign-up with age gate)

---

## No new SQL migration needed

All tables exist from Phase 1's migration. Pure code deploy.

---

## Deployment

1. Unzip `mesa-v2-phase3a-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents of unzipped `mesa/` folder
3. Commit: `Phase 3a - Director module part 1`
4. Vercel auto-deploys in ~90 seconds

---

## Testing Phase 3a

### As admin (you)

You're admin so you have access to BOTH `/dashboard/users` and `/dashboard/invite` (your sidebar shows neither directly under admin — invite is in director's nav). To test director's invite page, navigate manually to `/dashboard/invite`.

To properly test director-side, set up a director account:

1. Sidebar **Users** → Find a test user (or invite one) → change role to `director`
2. Sign out
3. Sign in as that director
4. Sidebar shows: Home, Add Users, Students, Practice Plans, Goal Management, Performance Management, Profile

### Test 1 — Enroll a student

Director sidebar → **Students** → empty state → **Enroll your first student**

- Full name: `Billy Smith`
- DOB: any
- Jersey: `17`
- Position: Forward
- Shoots: Left
- Team label: `U14 AAA`
- Notes: any

Click **Enroll student** → returns to list with Billy showing.

### Test 2 — Edit a student

Click Billy's row → student admin page → change jersey to `12` → Save → confirm "✓ Saved"

### Test 3 — Link a parent

You'll need a parent profile to link to. Easiest path:

1. Director **Add Users** → Send invite with email `parent@test.com`, role `parent`
2. Sign out
3. Sign up at `/sign-in` with `parent@test.com` (you'll need to use Supabase to manually create this auth user since email links aren't wired yet — or use whatever sign-up method you have)
4. After they sign up, sign back in as director
5. Go to Billy's student page → **+ Link** → enter `parent@test.com` → relationship: Mother → Primary contact checked → Link parent

Parent appears in the Linked parents section with their info.

### Test 4 — Create a practice plan

Director sidebar → **Practice Plans** → empty state → **New plan**

- Title: `U14 Skating Focus`
- Focus: `Edge work and crossovers`
- Description: any
- Duration: 60

Click **Create plan** → redirects to editor.

### Test 5 — Add drills + skills to a plan

Need at least one drill in the library first:
1. Sign in as admin briefly → **Drills** → Add drill `Crossovers` (skating, 15 min)
2. Sign back in as director → return to plan editor
3. Click **+ Drill** → search/click `Crossovers` → appears as item 1
4. Click **+ Skill** → title `Edge work`, duration 10 → appears as item 2
5. Click **+ Skill** → title `Game-speed scrimmage`, duration 20 → appears as item 3
6. Use ↑/↓ to reorder
7. Click duration field on item 1 → change to 20
8. Click **+ Notes** on item 2 → "Focus on outside edge"
9. Click **Save plan** → confirm "✓ Saved"
10. Refresh the page → all changes persist

### Test 6 — Delete an item

In editor → click × on any item → it disappears from the list (changes don't commit until you Save)

### Test 7 — Delete a plan

In editor → "Delete plan" bottom-left → confirm → returns to plan list, gone

---

## Permissions at Phase 3a

| Action | Admin | Director | Coach | Trainer |
|--------|-------|----------|-------|---------|
| Access /dashboard/invite | ✓ | ✓ | — | — |
| Send/revoke invites | ✓ | ✓ | — | — |
| Access /dashboard/students | ✓ | ✓ | — | — |
| Enroll/edit/deactivate students | ✓ | ✓ | — | — |
| Link/unlink parents | ✓ | ✓ | — | — |
| Link student profile | ✓ | ✓ | — | — |
| Access /dashboard/practice-plans | ✓ | ✓ | ✓ | — |
| Create/edit practice plans | ✓ | ✓ | ✓ (own only) | — |

Coaches will see the Practice Plans page when their module ships in Phase 4. They can create plans (per spec) — own-only delete via RLS.

---

## Common gotchas

### "No account found" when linking a parent

The parent must sign up FIRST. Until they have a row in `profiles`, you can't link them. Options:
- Send them an invite with role `parent` → they sign up → then link
- Or sign them up directly via Supabase Auth admin

### Can't link student profile

The target user must have `role = 'student'` AND have signed up at `/sign-up`. Until both are true, the link form errors out.

### Plan editor — "Save plan" doesn't save my changes

The save button submits the WHOLE state (metadata + items). If it fails, an error appears under metadata. Check that you actually clicked Save (the page doesn't auto-save on every change).

### Can I add the same drill twice?

Yes. There's no uniqueness check at the item level — useful for "do this drill, then a skill, then this drill again" sequences.

### "deletePracticePlan" wipes children automatically

The plan_items table has `ON DELETE CASCADE`, so all items auto-delete when the plan is deleted. Same for activities later.

---

## What to report back

- **"All 3 pages work — invited a user, enrolled a student, built a plan with items"** → Phase 3b begins
- **"Build error: [paste]"** → we debug
- **"Works but [X] is wrong"** → feedback before Phase 3b
- **"Want to change [X]"** → spec adjustment

---

## Phase 3b preview

- **Goal Management** (`/dashboard/goal-management`) — list goal plans across all students; per-plan detail page with sections for goals, performance tests, reviews, and agreement notes
- **Performance Management** (`/dashboard/performance-management`) — read-only cross-cutting activity log filtered by student/type/date range. Activities are CREATED in Phase 4 (coach) and Phase 5 (trainer); this view consolidates them.

Probably similar size to 3a.
