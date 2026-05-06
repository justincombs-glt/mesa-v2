# MESA v2 — Phase 10: Student Sidebar Reorganization + On Ice Surfaces

**Status:** Ready to deploy
**No SQL migration required.** Existing RLS policies already permit students to SELECT activities/attendance/game_stats they're enrolled in. Pure code changes.

The student sidebar is restructured into three collapsible groups (Off Ice, On Ice, Goal Management). Two new student-facing surfaces let them browse and view details on practices and games they're scheduled for.

---

## What shipped

### Student sidebar grouped + collapsible

```
Home
─────────────────
Off Ice ▾
  My Workouts
─────────────────
On Ice ▾
  Practices  (NEW)
  Games      (NEW)
─────────────────
Goal Management ▾
  My Goals
─────────────────
User Profile
```

- Same collapsible behavior as admin/director/coach/trainer sidebars: localStorage persistence, force-expand the group containing the current page on mount, separate state for desktop and mobile.

### Removals
- **My Performance** removed from the sidebar. The route at `/dashboard/my-performance` still works (so any existing bookmarks aren't broken), but it's no longer surfaced in the navigation. Test trends and performance data are still accessible to students through their per-goal-plan detail pages and the home dashboard.

### New: My Practices
**`/dashboard/my-practices`** — list page
- Lists all practices the student is rostered onto for the current season
- Split into Upcoming and Past sections
- Each row shows date, time, title, and focus
- Tap any row → routes to detail

**`/dashboard/my-practices/[id]`** — detail page
- Read-only view of practice metadata (date, time, duration, venue)
- Focus statement
- Practice plan (if attached): drill list with sequence numbers, drill names, categories, durations, coach notes for each item
- Coach notes for the overall practice
- The student's attendance status in a colored card (Present / Absent / not yet recorded)
- Roster size (just count, not names — privacy)
- Defense in depth: if a student manually navigates to a practice they aren't on, returns 404 (RLS would block the read anyway)

### New: My Games
**`/dashboard/my-games`** — list page
- Lists all games the student is rostered onto for the current season
- Split into Upcoming and Past
- Each row shows date, time, opponent (with @ prefix for away games), and the game's W/L/T result with score if available
- Tap any row → routes to detail

**`/dashboard/my-games/[id]`** — detail page
- Game header with home/away + opponent name
- Score banner: large W/L/T box with final score in academy colors (sage for win, crimson for loss)
- **My stats** section (the personal version of the trainer's box score):
  - Forwards/defense: G / A / +− / Shots / PIM / TOI grid
  - Goalies: Saves / Shots Against / Goals Against / Save % grid
  - Coach notes attached to that stat line if any
  - Empty state when stats haven't been recorded yet
- Coach notes for the overall game
- The student's attendance card
- Roster size

### Student dashboard rows now route to detail pages
The `<StudentDashboardView>` component (used on the student home and inside parent's family detail) had off-ice workout rows tappable as of Phase 9. Now ALL three activity types are tappable for student-self views (and only for student-self, not parent-viewing-child):
- Off-ice workout rows still route to `/dashboard/workouts/[id]/mobile` (the Phase 9 logger), CTA "Log →"
- Practice rows now route to `/dashboard/my-practices/[id]` (read-only detail), CTA "View →"
- Game rows now route to `/dashboard/my-games/[id]` (read-only detail), CTA "View →"

Parent views remain non-tappable as before (they're observational only — parents see their child's data but don't drill into per-activity detail pages).

### Privacy boundaries enforced
- Students can only see practices and games they're rostered onto. Manually navigating to others returns 404.
- Students see their own attendance and stats only.
- Roster size shown as a count, never with names — the academy's other students' identities aren't exposed.
- Game stats are scoped to the student's own row in `game_stats`.

### What did NOT change
- Coach, trainer, admin, director sidebars: unchanged
- Trainer mobile workout logger: unchanged
- Parent dashboard: unchanged
- Existing `/dashboard/my-goals` and `/dashboard/my-performance` pages: unchanged
- Database: nothing
- Server actions: nothing (no new actions, no modified actions)
- RLS policies: nothing (existing student-read policies already cover everything)

---

## Files added/changed

**New:**
- app/dashboard/my-practices/page.tsx — student practice list
- app/dashboard/my-practices/[id]/page.tsx — student practice detail (read-only)
- app/dashboard/my-games/page.tsx — student game list
- app/dashboard/my-games/[id]/page.tsx — student game detail (read-only) with personal stats
- PHASE-10-README.md

**Changed:**
- components/layout/AppShell.tsx — student case now returns grouped `NavSection[]` with Off Ice / On Ice / Goal Management; My Performance removed from sidebar
- components/student/StudentDashboardView.tsx — `<ActivityRow>` now tappable for all 3 activity types when `allowLog` (renamed semantically to "tappable for student-self") is true; routes to type-appropriate detail page

**Files to delete from GitHub:** none.

**Actions**: 87 total. **No new actions.** No schema changes.

---

## Database

**No migration required.** All RLS policies needed for these surfaces already exist:

| Table | Policy used | Existing? |
|---|---|---|
| `activities` | `Activity: student-or-parent reads if enrolled` | ✓ |
| `activity_students` | `ActivityStudents: student-parent reads own` | ✓ |
| `attendance` | `Attendance: student-parent reads own` | ✓ |
| `game_stats` | `GameStats: reads if can view student` | ✓ |
| `practice_plan_items` | reads via plan ownership chain | ✓ |
| `drills` | reads | ✓ |

If reads fail unexpectedly, suspect that one of these policies has been changed in a recent migration — but they should all be intact from Phase 6 / 6a.

---

## Deploy steps

1. Unzip `mesa-v2-phase-10-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
3. Commit: `Phase 10: Student sidebar groups + On Ice surfaces`
4. Vercel auto-deploys ~90s
5. Hard refresh

---

## How to test

### Setup
Need a student-role user account linked to a student record that's been rostered onto:
- At least one practice (with or without a practice plan attached)
- At least one game (with or without stats recorded)

### 1. Sidebar
1. Sign in as student
2. Sidebar shows: Home, [Off Ice ▾], [On Ice ▾], [Goal Management ▾], User Profile
3. NO "My Performance" item
4. Tap "On Ice" → expands to show Practices and Games
5. State persists across navigation
6. Same on mobile drawer

### 2. My Practices list
1. Tap Practices → routes to `/dashboard/my-practices`
2. See Upcoming and Past sections
3. Tap a practice row → routes to detail

### 3. Practice detail
1. Page shows date, time, duration, venue
2. Focus card if focus is set
3. Practice plan items if a plan was attached (numbered list with drills/skills, durations, coach notes)
4. Coach notes for the practice
5. My attendance card on the right (Present/Absent/Not yet recorded)
6. Roster count (e.g. "12 players scheduled")
7. NO names of other players visible
8. Breadcrumb: "My practices · Practice"
9. Try to manually paste a practice URL the student isn't on → 404

### 4. My Games list
1. Tap Games → routes to `/dashboard/my-games`
2. See Upcoming and Past
3. Past games show W/L/T badge with score
4. Tap a game row → routes to detail

### 5. Game detail
1. Page header: "vs Opponent" or "@ Opponent"
2. Score banner if final score recorded (sage for win, crimson for loss)
3. My stats grid (skater stats: G/A/+−/Shots/PIM/TOI, or goalie stats: Saves/SA/GA/SV%)
4. Coach notes if any
5. Attendance card
6. Roster count

### 6. Dashboard rows tappable
1. Go back to Home (`/dashboard`)
2. Upcoming/Recent activity rows show CTAs:
   - Off-ice workouts: "Log →"
   - Practices: "View →"
   - Games: "View →"
3. Tap each — routes to the right detail page

### 7. My Performance still alive
1. Manually paste `/dashboard/my-performance` into URL
2. Page still loads (route preserved per Q3 = A)
3. Just no longer reachable from the sidebar

### 8. Parent view unchanged
1. Sign in as parent
2. Open family child detail page
3. Activity rows are NOT tappable (parents are observational viewers)
4. No "View →" CTAs on rows

### 9. Mobile
1. On phone, hamburger drawer shows the same grouped student sidebar
2. List pages and detail pages render correctly on phone
3. Score banner, stats grid, attendance card all stack vertically

---

## Known limits / cosmetic notes

- **Game stats grid uses `md:grid-cols-6`** for skaters and `md:grid-cols-4` for goalies. On phones, falls back to `grid-cols-3` (skaters) or `grid-cols-2` (goalies). Looks balanced.
- **No detail-from-history view** — once a student is logged into the detail page, they can't drill further. There's no "view all my stats this season" aggregate view (that's what `/dashboard/my-performance` was for; if you want it back later, just put the sidebar item back).
- **No edits anywhere** — these are read-only surfaces. Students can't correct stats or change attendance from these pages. They'd need to message a coach.
- **My Performance route preserved** — if you genuinely never want students to access that page again, we can remove the route in a follow-up. For now it's reachable by direct URL.

---

## Roles status (sidebar grouping + activity log home)

| Role | Sidebar | Home page |
|---|---|---|
| Admin | ✓ Phase R (groups) | Welcome card |
| Director | ✓ Phase R.2 (groups) | Activity log (all 3 types) |
| Coach | ✓ Phase R.3 (groups) | Activity log (practices + games) |
| Trainer | ✓ Phase R.4 (groups) | Activity log (off-ice workouts) |
| **Student** | **✓ Phase 10 (groups)** | Custom student dashboard |
| Parent | Flat | Family list |

Parent is the last role with a flat sidebar — could group it later if you want. Otherwise the role cleanup is done.

---

## Next phase candidates

- **Parent sidebar grouping** — for completeness
- **Self-create workouts** for students (the deferred Q1=C from Phase 9)
- **`entered_by` audit** on workout sets
- **Phase 8 notifications** — still gated on Resend signup
- **Apple Health webhook** for auto-importing workout data
