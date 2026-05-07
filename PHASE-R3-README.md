# MESA v2 — Phase R.3: Coach Cleanup

**Status:** Ready to deploy
**No SQL migration required.** UI structure and navigation changes only.

The coach experience now mirrors director: home page is a read-only weekly activity log (excluding off-ice workouts since those are trainer's domain), and the sidebar is grouped into Practice Management and Game Review.

---

## What shipped

### Coach home page = read-only weekly activity log
The coach's `/dashboard` shows the same activity log surface that director gets, but scoped to coach's domain:

- **Practices and games only** — off-ice workouts are filtered out at fetch time (since they're trainer's domain)
- **Default filter pre-applied to current week** (Monday–Sunday)
- **Read-only** — no click-through, no hover state, no "Manage →" links
- **Type filter dropdown shows just Practices and Games** (no "Off-Ice Workouts" option)
- **2-column stat card row** — Practices count + Games count
- **Footer link "Manage activities →"** routes to `/dashboard/practices` (since coach has no performance-management workbench page; the practices list is the closest editable surface)
- Adjustable filters as before — date range, student, type. "This week" button to snap back to default. "Clear dates" to broaden.

### Coach sidebar grouped + collapsible

```
Home  (the weekly activity log)
─────────────────
Practice Management ▾
  Drills
  Practice Templates  (= Practice Plans, label changed)
  Practices
─────────────────
Game Review ▾
  Game Review  (= Activities, label changed)
─────────────────
User Profile
```

Same collapsible behavior as admin and director sidebars from Phase R / R.2 — localStorage persistence, force-expand the current group on mount, separate state for desktop and mobile.

### Removals
- **Students** removed from coach's sidebar entirely. Coaches don't need direct roster admin; their student-related work happens via practices/games (rosters are managed there) and per-student insights pages.

### Renames in coach context
- "Practice Plans" sidebar item → "**Practice Templates**" (route unchanged)
- "Activities" sidebar item → "**Game Review**" (route unchanged at `/dashboard/activities`)
- "Profile" → "User Profile" (already happened in R.2 since the bottom item is shared)

### Reusable activity-log component now configurable
The `ActivityLogView` component (originally introduced in R.2 for director) is now reusable across roles:
- Accepts `availableTypes` prop to scope which activity types appear in the type dropdown + stat cards
- Accepts `manageHref` prop for where the read-only footer link routes to
- Stat card grid auto-adjusts column count based on the number of available types (1, 2, or 3 columns)

The data fetcher `fetchActivityLogData(seasonId, excludeTypes?)` filters at the database level so coach never sees off-ice workouts in their query results.

---

## What did NOT change

- **Admin / director / trainer / student / parent sidebars**: unchanged from R.2
- **Director home page**: still shows all 3 activity types
- **Performance Management workbench**: unchanged (still all 3 types, still admin/director only)
- **Routes and database**: unchanged
- **Coach access**: coach already had access to `/dashboard/practice-plans` (verified — no `requireRole` change needed)

---

## Files added/changed

**New:**
- PHASE-R3-README.md

**Changed:**
- lib/activity-log.ts — `fetchActivityLogData` now accepts `excludeTypes?: ActivityType[]` parameter, filters the Supabase query
- components/activity-log/ActivityLogView.tsx — accepts `availableTypes` prop; stat cards + type dropdown render only those types; column count auto-adjusts (1/2/3 cols)
- app/dashboard/page.tsx — added `CoachHome` branch rendering activity log with `availableTypes={['practice', 'game']}` and `manageHref="/dashboard/practices"`
- components/layout/AppShell.tsx — coach's `case 'coach'` now returns grouped `NavSection[]` with Practice Management + Game Review; "Students" removed; "Practice Plans" → "Practice Templates"; "Activities" → "Game Review"

**Files to delete from GitHub** (orphaned files from previous phases will keep failing builds):
- None this phase — no files were removed.

**Actions**: 86 total. **No new actions.** No schema changes.

---

## Database

**No migration required.**

---

## Deploy steps

1. Unzip `mesa-v2-phase-r3-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
3. Commit: `Phase R.3: Coach cleanup`
4. Vercel auto-deploys ~90s
5. Hard refresh

---

## How to test

### 1. Coach home = activity log (no workouts)
1. Sign in as coach
2. Land on `/dashboard`
3. Page header reads "Coach · {Season Name}" with welcome message
4. Below: 2 stat cards — Practices and Games (no Off-Ice Workouts card)
5. Filter row: Type dropdown shows only "All types / Games / Practices" (no Off-Ice Workouts option)
6. From/To date inputs pre-filled with this Mon and Sun
7. Activity list shows only this week's practices and games
8. No row is clickable; no hover state
9. Footer has "Manage activities →" link

### 2. Coach sidebar groups
1. Sidebar shows: Home, [Practice Management ▾], [Game Review ▾], User Profile
2. NO "Students" item anywhere
3. Tap "Practice Management" header → expands to show Drills / Practice Templates / Practices
4. Reload → state persists
5. Navigate to Drills page → Practice Management group auto-expands
6. Tap "Game Review" header → expands to show single "Game Review" item
7. Tap "Game Review" item → routes to `/dashboard/activities` (the route is unchanged)

### 3. Sidebar labels
1. "Practice Templates" appears in sidebar (not "Practice Plans")
2. Click it → routes to `/dashboard/practice-plans`; the page itself still works as before
3. "Game Review" appears in Game Review group (not "Activities")
4. Click it → routes to `/dashboard/activities`; the games page works as before

### 4. Footer link routes correctly
1. From coach home, tap "Manage activities →"
2. Routes to `/dashboard/practices` (coach's editable practice list)
3. NOT `/dashboard/performance-management` (that's director's surface; coach doesn't have access)

### 5. Mobile drawer
1. On phone, tap hamburger
2. Drawer shows the same grouped layout
3. Tap a group header → collapses; reopen drawer → state persists
4. Tap a nav link → drawer closes and you navigate

### 6. Other roles unchanged
1. Director home still shows all 3 activity types
2. Performance Management still shows all 3 types
3. Admin sidebar unchanged
4. Trainer/student/parent sidebars unchanged

---

## Known limits / cosmetic notes

- **Coach has no editable activity workbench** — clicking "Manage activities →" goes to the practices list. Coach edits practices and games via their respective detail pages (which are clickable from `/dashboard/practices` and `/dashboard/activities` lists, same as before).
- **Game Review group has one item** — same single-child group pattern as director's Goal Management. Looks slightly redundant but keeps the structure consistent and leaves room to add items later.
- **"Students" page is GONE from coach's sidebar** but the route still exists (`/dashboard/students`). If a coach has a bookmark, it might still load (depends on requireRole on that page). If you want the page actually inaccessible to coach, that's a separate change.

---

## Next phase candidates

- **Trainer cleanup** — same treatment? Trainer currently has Exercises, Workout Plans, Off-Ice Workouts, APA Sessions, Students in a flat sidebar. Could group as Training Library + Performance Management with a similar weekly activity log home (showing off-ice workouts only).
- Phase 8 (notifications) — still gated on Resend signup
- Apple Health webhook
