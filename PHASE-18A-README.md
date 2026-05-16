# MESA v2 — Phase 18a: Player Role Foundation

**Status:** Ready to deploy
**SQL migration required:** `0023_phase18a_player_role.sql` — **run this BEFORE deploying code.**

Adds a new **Player** role for non-academy athletes who pay the academy for à la carte services. Players get goals, APA results, game review, Coach's Corner, self-logged nutrition, and self-logged workouts. They are NEVER added to academy practices or trainer-scheduled workouts.

**This is Phase 18a (foundation). Phase 18b will add the self-create workouts flow** that lets a Player schedule and log their own off-ice training. Until 18b ships, a Player's "My Workouts" page shows empty.

---

## What's in this phase

### New role
- `'player'` added to the `app_role` enum
- New `category` column on `students` table: either `'student'` (default) or `'player'`
- All existing student rows automatically get `category='student'` via the column default

### Defense-in-depth exclusion
Players cannot be added to:
- **Practices** — DB trigger blocks ANY insert into `activity_students` for a player + practice activity
- **Trainer-scheduled workouts** — DB trigger blocks unless `activities.logged_by = player's own profile_id` (which is what Phase 18b will do when a Player self-creates a workout)
- **Games are fine** — Players use the same Phase 14 household-scheduled game flow as students

UI filters mirror the DB constraints — Players never appear in trainer's "add student to practice" or "add student to workout" pickers. The DB constraint is the safety net if a UI filter is missed or bypassed.

### New sidebar items

**For staff** (admin / director / coach / trainer): new **Players** sidebar item leading to `/dashboard/players` — a list of all Players with create / edit / deactivate controls. Separate from the existing "Students" item.

**For Players themselves**: a slim version of the student menu:
- Home (slim student dashboard, same data shape minus practices)
- Off Ice → My Workouts, Nutrition
- Performance → APA Sessions
- Game Review → My Games
- Goal Management → My Goals
- Coach's Corner
- User Profile

No "Practices" or "On Ice" section.

### Player Home page
Reuses `StudentDashboardView` — same goal cards, activity feed, etc. Title says "Player" instead of "Student." Since Players never have practice rows in `activity_students`, the activity feed simply omits practice entries.

---

## Files added/changed

### New
- `supabase/migrations/0023_phase18a_player_role.sql`
- `app/dashboard/players/page.tsx` — staff list of Players
- `app/dashboard/players/PlayersClient.tsx` — list UI with create/edit/deactivate
- `PHASE-18A-README.md`

### Modified
- `lib/supabase/types.ts` — `'player'` added to `AppRole`; `category: StudentCategory` added to `Student`; new `StudentCategory` type
- `app/actions.ts` — new `createPlayer` action (103 → 104); `'player'` added to `createInvite` valid-roles list; age-gate message generalized to "Minor athletes"
- `app/dashboard/page.tsx` — new `PlayerHome` function routing
- `components/layout/AppShell.tsx` — `'player'` role case with custom sidebar; new "Players" item for admin/director/coach/trainer; new `player` icon
- `app/dashboard/practices/page.tsx`, `app/dashboard/practices/[id]/page.tsx`, `app/dashboard/workouts/page.tsx` — added `.eq('category', 'student')` filter to student pickers (Q8/Q9 = C UI layer)
- `app/dashboard/my-performance/page.tsx`, `app/dashboard/my-games/page.tsx`, `app/dashboard/my-goals/page.tsx` (+ `[planId]`), `app/dashboard/my-workouts/page.tsx`, `app/dashboard/nutrition/page.tsx`, `app/dashboard/nutrition/history/page.tsx` — `requireRole('student')` widened to `requireRole('student', 'player')`
- `app/dashboard/workouts/[id]/mobile/page.tsx` — `'player'` added to role allow-list

### Files to delete from GitHub: none

### Action count: 103 → 104 (+1)
- `createPlayer` — staff creates a player record; sets `category='player'`, skips season auto-enrollment that `createStudent` does

---

## Deploy

### Step 1: Run migration 0023 in Supabase SQL Editor (FIRST)
1. Supabase Studio → SQL Editor
2. Open `supabase/migrations/0023_phase18a_player_role.sql`
3. Paste into a new query, Run

The migration is idempotent. It:
- Adds `'player'` to the `app_role` enum
- Adds `category` column to `students` with default `'student'`
- Adds a check constraint allowing only `'student'` or `'player'`
- Adds an index on `students(category)`
- Creates `is_player()` and `is_self_athlete()` helper functions
- Creates a trigger on `activity_students` that blocks Players from practices and from trainer-scheduled workouts
- Updates `handle_new_user()` to link Player invites the same way it links Student invites

### Step 2: Push code to GitHub
1. Unzip `mesa-v2-phase-18a-clean.zip`
2. Upload contents to GitHub via Add file → Upload files (replace conflicts)
3. Commit: "Phase 18a: Player role foundation"
4. Vercel auto-deploys ~90s

### Step 3: Verify

**As admin/director:**
1. Sidebar now has **Players** item in Administration group
2. Click → land on `/dashboard/players` (empty if first time)
3. Click **+ Add player** → form modal
4. Fill in name, optional details → Add player → appears in active list
5. Click **Edit** on a row → modify any field, save → reflected
6. Click **Deactivate** → confirm → moves to Inactive tab
7. Switch tab to Inactive → click **Reactivate** → moves back

**As coach/trainer:**
1. Same Players sidebar item
2. Same CRUD capability (Q10 = A)

**Invite a Player:**
1. Go to Add Users
2. Select role = Player, paste their email, optionally pick a linked Player record
3. They sign up → their profile gets role='player' and links to the Player record

**As a Player (after sign-up):**
1. Sidebar shows: Home, Off Ice (My Workouts + Nutrition), Performance (APA Sessions), Game Review (My Games), Goal Management (My Goals), Coach's Corner, User Profile
2. NO "Practices" item, NO "On Ice" group
3. **My Workouts is empty** — no trainer can schedule one for them, and self-create isn't built yet (Phase 18b)
4. Home page shows the student dashboard layout with their goals, recent activity, etc.

**DB-level exclusion test (try to break it):**
1. As coach, attempt to add a Player to a practice via the practice detail page
2. Player won't appear in the picker (UI filter)
3. If you somehow craft a direct API call with a Player's ID, the trigger raises `check_violation` with "Players cannot be added to practices."

---

## Known scope limits of 18a

### APA Sessions: trainer-add-Player not wired
Trainer's existing APA session UI filters students by current-season enrollment (`season_enrollments`). Players don't have season enrollments. So:
- A Player can VIEW their APA results via the `/dashboard/my-performance` page (role gate widened)
- But a Trainer CAN'T currently add a Player to an APA session through the existing UI

Fixing this cleanly requires deciding: do Players get season enrollments (defeats the "not on academy roster" model), or does the APA picker get a parallel "external athletes" path? Worth a separate elicitation. Until then, Players can't be scheduled into trainer APA sessions through the UI.

If you need this immediately and don't mind a hack: enrolling a Player in a season via the season enrollments table would make them visible in the APA picker. Not recommended long-term but works as a stopgap.

### My Workouts is empty for Players
Until Phase 18b ships, a Player has no workouts. The page works (role gate widened) but shows the empty state.

### No conversion UI
You can't convert an existing Student to a Player via the admin UI. If you need to flip an existing record's category, you'd do it manually via Supabase SQL Editor (`update public.students set category = 'player' where id = '...'`). Per Q11 = A — no conversion path was scoped for this phase.

### "Players" sidebar item appears even before any Player exists
Empty state shows "Add your first external player using the button above." Could be hidden until first player exists, but always-visible is simpler and discoverable.

### Display vocabulary
Per Q7 = B: UI says "Player" where the role is involved, schema stays "Student" everywhere internally. So you'll see "/dashboard/players" routes that read from a "students" table. Documented because it's intentional and might confuse future development.

### Player can't self-register without an invite
Same as Student/Parent — they need a staff-issued invite. Self-registration with role auto-detect is the existing parent/student flow; we didn't extend it. If you want public-facing Player signup, that's a future addition.

---

## Security model (defense in depth)

| Attempt | Stops at |
|---|---|
| Trainer adds Player to a practice via UI | UI filter (Player not in picker list) |
| Coach drafts direct API call adding Player to practice | DB trigger `check_player_activity_exclusion_trg` raises `check_violation` |
| Trainer adds Player to off-ice workout | UI filter |
| Trainer drafts direct API call adding Player to a trainer-created workout | DB trigger blocks (logged_by ≠ player's profile_id) |
| Player signs in and tries to access `/dashboard/my-practices` | `requireRole('student')` rejects (not widened) |
| Player tries to access `/dashboard/students` (admin staff list) | `requireRole('admin', 'director')` rejects |
| Anyone tries to add Player to a game | Allowed — same as student per Q3 = A (Phase 14 flow) |
| Coach tries to view a non-academy Player's data | Existing RLS on students/goals/etc. allows staff read (`is_staff()` includes coach) |

---

## Looking ahead — Phase 18b

The follow-up phase implements **self-create workouts for Players**:
- Player creates a workout from the exercise library (or picks a template)
- `activities.logged_by` set to their own `profile_id`
- The Phase 18a DB trigger allows the Player's own `activity_students` row to be created (since `logged_by = player_profile_id`)
- Player logs their sets in the existing mobile logger

After 18b ships, the Player's "My Workouts" page will populate with their own scheduled workouts.

---

## Suggested next steps

- **Phase 18b** — self-create workouts (the immediate follow-up)
- **Player-to-Student conversion admin UI** if you ever need to flip categories
- **Player season-enrollment-free APA picker path** so trainers can add Players to APA sessions cleanly
- **Public-facing Player signup** — let an external athlete request an account without an invite
- **Player billing / contract context** — track what services they're paying for, expiration dates
- **Phase 8 notifications via Resend** — still gated on signup
