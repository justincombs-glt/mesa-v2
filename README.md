# MESA v2 — Phase 2: Admin module

Builds on Phase 1. Every admin sidebar item now works.

---

## What's new in Phase 2

### ✅ Users page (`/dashboard/users`)
- Full user directory with search + role filter
- Change any user's role from a dropdown (with confirmation)
- Pending invites list at top with revoke option
- Invite user modal — creates a pending invite that auto-assigns the role when the invited email signs up
- Can't accidentally remove your own admin role (self-lockout prevention)

### ✅ Drill Repository (`/dashboard/drills`)
- Grid view of on-ice drills with category filter and search
- Add / edit / delete drills
- Category, duration, age groups, equipment, instructions

### ✅ Exercise Repository (`/dashboard/exercises`) — NEW
- Off-ice exercise library (trainer's side)
- Same structure as drills but for strength/conditioning/mobility/plyometrics/skill/core/recovery
- Default sets, reps, duration for timed exercises (e.g., plank)

### ✅ Goal Template Repository (`/dashboard/goal-templates`)
- Reusable goal examples (for when director builds student plans in Phase 3)
- Domain tabs (On-Ice / Off-Ice / All)
- Full 12-category taxonomy

### ✅ Performance Test Repository (`/dashboard/performance-tests`) — NEW
- Define standardized tests the academy administers
- Domain (on-ice / off-ice), unit, direction (higher-is-better or lower-is-better)
- Empty by default — you seed it with your own tests

---

## What's NOT in Phase 2

- Director module pages (Students, Practice Plans, Goal Management, Performance Management) — still stubs, arrive in Phase 3
- Coach module (Practices, Activities, Students) — Phase 4
- Trainer module (Workouts, etc.) — Phase 5
- Student / Parent dashboards — Phase 6

---

## No SQL migration needed

All tables were created in Phase 1's migration. Pure code deploy this time.

---

## Deployment

1. Unzip `mesa-v2-phase2-clean.zip` on your Mac
2. Go to your `mesa-2` GitHub repo → **Add file → Upload files**
3. Drag the contents of the unzipped `mesa/` folder → it'll overwrite files from Phase 1
4. Commit: `Phase 2 - Admin module`
5. Vercel auto-deploys in ~90 seconds

### If GitHub won't overwrite

Sometimes GitHub's upload gets stuck when you overwrite many files. If it shows an error or just spins:

1. Stop the upload
2. Refresh the repo page
3. Try uploading in smaller batches (e.g., just the `app/` folder, then `components/`, etc.)
4. Or delete the old `app/dashboard/` folder first, then upload fresh

---

## Testing Phase 2

### Sign in as admin (you)

1. Navigate to your Vercel URL → sign in
2. Sidebar shows 7 items: Home, Users, Drills, Exercises, Goal Templates, Performance Tests, Profile

### Test Users page

1. Click **Users** → see yourself in the list (role: admin)
2. Click **Invite user** top-right
3. Enter a test email + pick a role → Create invite
4. New entry appears in "Pending invites" section
5. Click **Revoke** → entry disappears

### Test creating a drill

1. Click **Drills** → empty state appears (expected — wiped DB)
2. Click **Add drill** top-right
3. Fill: title "Crossovers", category "skating", duration 15 → Save
4. Drill appears as a card
5. Click the card → modal opens for editing
6. Try delete → confirms → drill gone

### Test creating an exercise

1. Click **Exercises** → empty state
2. Add exercise "Back Squat", category "strength", default sets 5, default reps 5 → Save
3. Card appears with "5 × 5" in top-right

### Test creating a goal template

1. Click **Goal Templates** → empty
2. Add template: "Crossovers under control", On-Ice, Skating, target 10, unit "crossovers", 8 weeks
3. Card appears with domain pill and category label

### Test creating a performance test

1. Click **Performance Tests** → empty
2. Add test: "40-yard dash", Off-Ice, unit "sec", Lower is better
3. Add another: "1RM back squat", Off-Ice, unit "lb", Higher is better
4. Both appear in the list

### Test role change

1. Users page → find a test user (if you have one) → change their role dropdown → confirm
2. Or: create a test user in Supabase Auth → come back to Users → change their role

---

## Permissions at Phase 2

| Action | Admin | Director | Coach | Trainer |
|--------|-------|----------|-------|---------|
| Access Users page | ✓ | — | — | — |
| Change user roles | ✓ | — | — | — |
| Create/revoke invites | ✓ | — | — | — |
| Access Drills page | ✓ | ✓ | ✓ | — |
| Manage drills | ✓ | ✓ | ✓ (own) | — |
| Access Exercises page | ✓ | ✓ | — | ✓ |
| Manage exercises | ✓ | ✓ | — | ✓ (own) |
| Access Goal Templates | ✓ | ✓ | — | — |
| Manage goal templates | ✓ | ✓ | — | — |
| Access Performance Tests | ✓ | ✓ | — | — |
| Manage performance tests | ✓ | ✓ | — | — |

The Director sees some overlap (Drills, Exercises) because they'll use those repos in Phase 3 when building plans. Coaches can also contribute to Drills; Trainers can contribute to Exercises. The repo pages are shared — different roles see them via their respective sidebars.

---

## What to report back

- **"Phase 2 green, all 5 admin pages work, can create+edit+delete in each"** → Phase 3 (Director module)
- **"Build error: [paste]"** → we fix
- **"[Page] throws an error: [paste]"** → we fix
- **"Works but [X] is wrong"** → feedback

---

## Common testing gotchas

### "No matches" when I know I added something

- The repository filters by `active = true`. If you deleted and re-added, the active filter still lets through.
- If you edited an item and the category changed, your filter might not match anymore. Clear the category filter.

### Can't change my own role

- Intentional — would lock you out. To demote yourself, first promote someone else to admin, have them change yours.

### Invited user signs up but still gets "parent" role

- Check the invite email exactly matches what they signed up with (lowercase, no trailing spaces, etc.)
- Check `invites` table status — should flip to "consumed" on signup. If it's still "pending," the emails didn't match.
