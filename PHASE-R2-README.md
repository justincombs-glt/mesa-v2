# MESA v2 — Phase R.2: Director Sidebar Grouping + Activity Log Home

**Status:** Ready to deploy
**No SQL migration required.** Pure UI structure changes — no actions, no schema.

The director's experience is reorganized along the same lines as Phase R did for admin. Home page becomes a read-only weekly activity log; sidebar gets grouped into Administration / Goal Management / Performance Management / Training Library.

---

## What shipped

### Director home page = read-only weekly activity log
The director's `/dashboard` no longer shows the generic "welcome" content. Instead it shows the same activity log surface that was previously only at `/dashboard/performance-management`, but with these defaults:

- **Date filter pre-applied to current week** (Monday–Sunday)
- **Click-through and edit affordances are HIDDEN** — rows are static, no "Manage →" link, no hover state
- **Footer shows a "Manage activities →" link** routing to `/dashboard/performance-management` for when director needs to take action
- **Filters are still adjustable** — director can change the date range, type filter, student filter, or hit "Clear dates" to see everything in the current season. There's a "This week" button to snap back. Per Q3 = A, same filter shape on both views.

### `/dashboard/performance-management` becomes the editable workbench
Same activity log component, but with `readOnly={false}`:

- **Click any row to manage** — routes to the existing detail page for that activity:
  - Practices → `/dashboard/practices/[id]`
  - Games → `/dashboard/activities/[id]`
  - Off-Ice Workouts → `/dashboard/workouts/[id]`
- **No inline delete** (per Q2 = B) — director must click through to the activity's detail page where the existing delete affordance lives
- **No date filter pre-applied** — shows the full season by default; director picks dates when wanted
- **Stat cards** at top now reflect the FILTERED count (not the total). When you narrow the filter, the cards update.

### Director sidebar grouped + collapsible

```
Home  (the weekly activity log)
─────────────────
Administration ▾
  Seasons
  Add Users
  Students
─────────────────
Goal Management ▾
  Goal Management
─────────────────
Performance Management ▾
  Performance Management   (the editable activity workbench)
  APA Sessions
─────────────────
Training Library ▾
  Practice Plans
─────────────────
User Profile  (renamed from "Profile")
```

Same collapsible behavior as admin's grouped sidebar from Phase R: localStorage persistence, current group force-expanded on mount, separate state for desktop and mobile.

### Profile → User Profile (admin and director)
The bottom sidebar item that links to `/dashboard/settings` now reads "User Profile" everywhere. The route is unchanged.

### What did NOT change
- **Coach, trainer, student, parent sidebars**: unchanged. None had been grouped, and your spec was admin + director only.
- **Database**: nothing.
- **Routes**: `/dashboard/performance-management` still exists at the same URL. Bookmarks intact.
- **Other roles' home pages**: unchanged. Coach/trainer still see the generic welcome; student sees their dashboard; parent sees the family list.
- **No new actions** — the activity log is read-only data display. Edits happen on existing detail pages with their existing actions.

---

## Files added/changed

**New:**
- components/activity-log/ActivityLogView.tsx — reusable activity-log component, `readOnly` prop drives behavior
- lib/activity-log.ts — server helper `fetchActivityLogData(seasonId)` shared by both home and performance-management pages
- PHASE-R2-README.md

**Removed:**
- app/dashboard/performance-management/PerformanceManagementClient.tsx (replaced by shared `ActivityLogView`)

**Changed:**
- app/dashboard/performance-management/page.tsx — uses shared `ActivityLogView` with `readOnly={false}`, fetches data via the new helper
- app/dashboard/page.tsx — adds a `DirectorHome` branch that renders `ActivityLogView` with `readOnly={true}`
- components/layout/AppShell.tsx — director's `case 'director'` returns grouped `NavSection[]`; settings label "Profile" → "User Profile" (affects both admin and director)

**Actions**: 86 total. **No new actions.** No schema changes.

---

## Database

**No migration required.**

---

## Deploy steps

1. Unzip `mesa-v2-phase-r2-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
3. Commit: `Phase R.2: Director sidebar groups + activity log home`
4. Vercel auto-deploys ~90s
5. Hard refresh

---

## How to test

### 1. Director home = activity log
1. Sign in as director
2. Land on `/dashboard`
3. Page header reads "Director · {Season Name}" with welcome message
4. Below: 3 stat cards (Practices / Games / Off-Ice Workouts), each showing the count for the current week
5. Filter row shows: Type · Student · From · To · "This week" button · "Clear dates" link. The From/To date inputs are pre-filled with this Monday and this Sunday.
6. Activity list below shows only this week's activities
7. Click a row → nothing happens (read-only mode)
8. Hover a row on desktop → no hover state, no "Manage →" arrow
9. Footer has "Manage activities →" link

### 2. Director sidebar groups
1. Sidebar shows: Home, [Administration ▾], [Goal Management ▾], [Performance Management ▾], [Training Library ▾], User Profile
2. Tap "Administration" → expands to show Seasons / Add Users / Students; tap again to collapse
3. State persists across page navigation (localStorage)
4. Navigate to Practice Plans → Training Library auto-opens (current page in that group)
5. On phone, hamburger drawer shows the same grouped layout
6. Mobile and desktop have independent collapse state

### 3. "User Profile" rename
1. Bottom of sidebar shows "User Profile" (not "Profile")
2. Same for admin
3. Click it → still routes to `/dashboard/settings`

### 4. Performance Management workbench
1. Navigate to Performance Management (in the sidebar)
2. Page header reads "Director · Performance Management" with title "Activity log"
3. Filter row shows the same fields, but date is BLANK (no week pre-filled — full season visible)
4. Click "This week" button → date inputs populate with this week
5. Activity rows have "Manage →" text on the right
6. Hover a row → ivory background highlights
7. Click a practice row → routes to `/dashboard/practices/[id]` (existing detail page with all edit/delete affordances)
8. Click a game row → routes to `/dashboard/activities/[id]`
9. Click a workout row → routes to `/dashboard/workouts/[id]`

### 5. Click-through round-trip
1. From performance-management, click into an activity → you're on the detail page
2. Edit something (e.g., change date), save
3. Click breadcrumb back to performance-management → see the change reflected in the row

### 6. Filter sync
1. On home page, change date filter to "last week" and Type = "Game"
2. Stat cards now reflect the filtered set
3. Navigate to Performance Management — the filter state is NOT shared (each page has its own state). This is intended; the home is "this week," the workbench is for ad-hoc filtering.

### 7. Empty states
1. As director with no activities yet in current season → home shows the empty card
2. Add a practice as coach → director's home this week shows it (provided it's dated within this Mon–Sun)

---

## Known limits / cosmetic notes

- **Filter state is NOT shared between home and performance-management**. They're independent surfaces. If you want them to sync, that'd be a follow-up.
- **No real-time updates**. If a coach logs a practice while director is on the home page, director needs to refresh to see it. (No phase has live data — this is consistent with everything else.)
- **No selection/multi-row actions**. The workbench is "click-through to manage one." Bulk delete or bulk move would be a follow-up.
- **APA Sessions and reviews are NOT in the activity log**. Per Q7 = A, only practices + games + workouts. APA sessions still have their own page in the sidebar; reviews still live on each student's insights page.
- **Director's Goal Management group has only one item** (Goal Management). Looks slightly redundant; alternative is to ungroup it. Left as-is per Q4 = A.

---

## Next phase candidates

- Phase 8 (notifications) — still gated on Resend signup
- Apple Health webhook
- Cross-cutting analytics
