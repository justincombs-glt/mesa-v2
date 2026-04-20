# MESA v2 — Phase 1: Foundation

**Michigan Elite Sports Academy · Training Platform**

This is the start of the v2 rebuild. Phase 1 deploys the new schema and confirms the new 6-role sidebar structure works. **No user-facing features** — that's Phases 2-7.

---

## What's in Phase 1

- ✅ Complete v2 database schema (migration `0006_v2_full_rewrite.sql`)
- ✅ 6 roles: Admin, Director, Coach, Trainer, Student, Parent
- ✅ Each role has the correct sidebar per the spec
- ✅ Every sidebar item leads to either a real page (Home, Profile) or a "Coming in Phase N" stub
- ✅ Your email (`justin.combs@gltconsulting.io`) is hard-coded as admin
- ✅ Settings page still works — you can update your name and phone
- ✅ Sign in / sign out / auth still works

## What's NOT in Phase 1

Every module is a stub. You'll see the sidebar and placeholder pages. Real functionality rolls out phase by phase:

- **Phase 2 — Admin module**: Users, Drill/Exercise/Goal Template/Performance Test repositories
- **Phase 3 — Director module**: Add Users, Students, Practice Plans, Goal Management, Performance Management
- **Phase 4 — Coach module**: Drills, Practices, Activities (games), Students
- **Phase 5 — Trainer module**: Exercises, Off-Ice Workouts, per-set logging, Students
- **Phase 6 — Student/Parent dashboards**: Self-registration (13+), personal dashboards
- **Phase 7 — Review integration**: Goal reviews pull in performance data

---

## ⚠️ CRITICAL: Deployment wipes your database

The migration drops every v1 app table. Students, goals, ratings, activities, drills, teams — everything from v1 is gone after this runs. Only `auth.users` stays intact (so your login still works).

You confirmed this is what you want. Just flagging it one more time before you run the SQL.

---

## Deployment — in order

### Step 1 — Run the SQL migration

1. Go to Supabase dashboard → your MESA project
2. Left sidebar → **SQL Editor** → **New query**
3. Unzip `mesa-v2-phase1-clean.zip` on your Mac
4. Open `supabase/migrations/0006_v2_full_rewrite.sql` in a text editor
5. Copy **all** contents (Cmd+A, Cmd+C)
6. Paste into Supabase SQL Editor
7. Click **Run**
8. Expected: "Success. No rows returned." — possibly with a few warnings about dropping non-existent objects (harmless)

**Verify:**

Run this diagnostic in a new query:

```
select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.academy) as academy_rows,
  (select role from public.profiles where lower(email) = 'justin.combs@gltconsulting.io') as your_role;
```

Expected result:
- `profiles`: 1+ (however many auth users you have)
- `academy_rows`: 1
- `your_role`: `admin`

If `your_role` is NOT `admin`, paste the diagnostic output and I'll fix.

### Step 2 — Upload code to GitHub

**Heads up:** this is a large rewrite — lots of files changed, deleted, added. The cleanest approach is:

**Option A — Overwrite approach (simpler):**
1. Unzip the clean file on your Mac
2. Go to `github.com/YOUR_USERNAME/mesa`
3. Add file → Upload files → drag **contents of unzipped `mesa/` folder**
4. GitHub will overwrite existing files. BUT it won't delete the old v1 route folders (drills, family, games, etc.) that no longer exist.
5. After upload, you'll need to manually delete these v1 folders from GitHub:
   - `app/dashboard/drills/` (and subfolders) ← WAIT: v2 keeps drills/ but as a stub. Actually delete the OLD contents first
   - `app/dashboard/players/`
   - `app/dashboard/games/`
   - `app/dashboard/teams/`
   - `app/dashboard/ratings/`
   - `app/dashboard/goals/`
   - `app/dashboard/family/FamilyClient.tsx` (if it exists)
   - `app/dashboard/students/StudentsClient.tsx` and `[id]/` subfolder
   - `app/dashboard/invites/` (renamed to `invite` singular)
   - `app/dashboard/goal-templates/GoalTemplatesClient.tsx` and `[id]/` subfolder
   - Old migration files `0001` through `0005`

**Option B — Fresh repo (cleanest, recommended):**
1. Create a new GitHub repo named `mesa-v2`
2. Upload the unzipped contents to the empty repo
3. In Vercel: Settings → Git → Disconnect current repo → Connect to `mesa-v2`
4. Env vars stay intact

**I recommend Option B.** No leftover files to confuse the build.

### Step 3 — Commit & deploy

Commit message: `v2 Phase 1 - foundation`. Vercel auto-deploys in ~90 seconds.

### Step 4 — Test

1. Sign out of MESA if you were signed in
2. Sign back in with `justin.combs@gltconsulting.io`
3. You should see:
   - Page header: "Signed in · ADMIN"
   - Sidebar with 7 items: Home, Users, Drills, Exercises, Goal Templates, Performance Tests, Profile
4. Click any sidebar item — should show a "Coming in Phase N" stub with a "Back to home" button
5. Click Profile → edit your name → save → confirm it persists

---

## If other users existed before

Any non-admin users who had accounts in v1 now have `role = 'parent'` by default. To change:

1. Supabase → Table Editor → `profiles`
2. Find the row → double-click the `role` cell
3. Type one of: `admin`, `director`, `coach`, `trainer`, `student`, `parent`
4. Press Enter → Save changes at bottom

They need to sign out and back in to pick up the new role.

---

## Sidebar per role reference

| Role | Sidebar items |
|------|---------------|
| **Admin** | Home, Users, Drills, Exercises, Goal Templates, Performance Tests, Profile |
| **Director** | Home, Add Users, Students, Practice Plans, Goal Management, Performance Management, Profile |
| **Coach** | Home, Drills, Practices, Activities, Students, Profile |
| **Trainer** | Home, Exercises, Off-Ice Workouts, Students, Profile |
| **Student** | Home, Goal Management, Performance Management, Profile |
| **Parent** | Home, My Family, Profile |

---

## What to report back

After deploying and testing:

- **"Phase 1 green, signed in as admin, sidebar looks right"** → we start Phase 2 (Admin module)
- **"Migration error: [paste]"** → debug the SQL
- **"Build error on Vercel: [paste]"** → debug the build
- **"Sidebar is wrong — I see [X]"** → we fix the nav
- **"Role came through as [X] not admin"** → we fix the trigger

---

## Phase 1 file inventory

```
mesa/
├── supabase/migrations/
│   └── 0006_v2_full_rewrite.sql    ← the one migration to rule them all
├── app/
│   ├── actions.ts                  ← just updateProfile for now
│   ├── page.tsx                    ← landing (kept from v1)
│   ├── sign-in/                    ← auth (kept)
│   ├── auth/callback/              ← magic link (kept)
│   ├── api/health/webhook/         ← placeholder, not wired
│   └── dashboard/
│       ├── layout.tsx              ← app shell
│       ├── page.tsx                ← v2 role-aware home
│       ├── settings/               ← real profile editor
│       └── 14 stub folders         ← all sidebar destinations, showing ComingSoon
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx            ← new 6-role nav
│   │   └── SignOutButton.tsx
│   └── ui/
│       ├── ComingSoon.tsx          ← NEW, reusable stub
│       ├── EmptyState.tsx
│       ├── FormField.tsx
│       ├── Modal.tsx
│       └── PageHeader.tsx
├── lib/
│   ├── auth.ts                     ← requireProfile, requireRole
│   ├── form-helpers.ts             ← toFormAction
│   ├── goal-taxonomy.ts            ← domain/category labels
│   └── supabase/
│       ├── admin.ts
│       ├── client.ts
│       ├── server.ts
│       └── types.ts                ← full v2 types
└── middleware.ts
```

---

## Rollback

There isn't one, easily. The migration is one-way. If something's seriously wrong, say so and we'll write a recovery SQL. But the current path assumes you want to move forward.
