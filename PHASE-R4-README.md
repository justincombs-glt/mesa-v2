# MESA v2 — Phase R.4: Trainer Cleanup

**Status:** Ready to deploy
**No SQL migration required.** UI structure and navigation changes only.

The trainer experience now mirrors the cleanup pattern from director (R.2) and coach (R.3): home page is a read-only weekly activity log scoped to off-ice workouts only, sidebar restructured into Training and Performance Testing groups.

---

## What shipped

### Trainer home page = read-only weekly activity log
The trainer's `/dashboard` shows the same activity log surface that director and coach get, but scoped to trainer's domain:

- **Off-ice workouts only** — practices and games are filtered out at fetch time (those are coach's domain)
- **Default filter pre-applied to current week** (Monday–Sunday)
- **Read-only** — no click-through, no hover state, no "Manage →" links
- **Type filter dropdown** shows only "All types / Off-Ice Workouts" (the dropdown is technically pointless with one option, but the row stays visible for date and student filters)
- **1-column stat card row** — Off-Ice Workouts count
- **Footer link "Manage activities →"** routes to `/dashboard/workouts` (the existing trainer workout list)
- Adjustable filters as before — date range, student, type. "This week" button to snap back. "Clear dates" to broaden.

### Trainer sidebar grouped + collapsible

```
Home  (the weekly activity log)
─────────────────
Training ▾
  Exercises
  Workout Templates  (= Workout Plans, label changed)
  Off-Ice Workouts
─────────────────
Performance Testing ▾
  APA Sessions
─────────────────
User Profile
```

Same collapsible behavior as the other grouped sidebars (admin / director / coach): localStorage persistence, force-expand the group containing the current page on mount, separate state for desktop and mobile.

### Removals
- **Students** removed from trainer's sidebar entirely. Trainer still has roster context implicitly via workouts and APA sessions (rosters are managed there). The route `/dashboard/students` still exists for other roles; trainer just doesn't have a sidebar shortcut to it anymore.

### Renames in trainer context
- "Workout Plans" sidebar item → "**Workout Templates**" (route unchanged at `/dashboard/workout-plans`). This parallels coach's "Practice Templates" rename so the relationship between templates and instances is consistent across roles.
- "Profile" → "User Profile" (already happened in R.2 since the bottom item is shared)

### Reuses the configurable activity-log component
No changes needed to `ActivityLogView` or `fetchActivityLogData` — they're already configurable via `availableTypes` and `excludeTypes`. Trainer home calls them with `availableTypes={['off_ice_workout']}` and `excludeTypes=['practice', 'game']` respectively.

The 1-column grid layout for stat cards is already supported via the static-branch `gridColsClass` logic introduced in R.3.

---

## What did NOT change

- **Admin / director / coach / student / parent sidebars**: unchanged from prior phases
- **Director home page**: still shows all 3 activity types
- **Coach home page**: still shows practices + games only
- **Performance Management workbench**: unchanged
- **Routes and database**: unchanged
- **Trainer access**: trainer already had access to all relevant routes; no `requireRole` changes needed

---

## Files added/changed

**New:**
- PHASE-R4-README.md

**Changed:**
- app/dashboard/page.tsx — added `TrainerHome` branch rendering activity log with `availableTypes={['off_ice_workout']}` and `manageHref="/dashboard/workouts"`
- components/layout/AppShell.tsx — trainer's `case 'trainer'` now returns grouped `NavSection[]` with Training + Performance Testing; "Students" removed; "Workout Plans" → "Workout Templates"

**Files to delete from GitHub:**
- None this phase. No files were removed.

**Actions**: 86 total. **No new actions.** No schema changes.

---

## Database

**No migration required.**

---

## Deploy steps

1. Unzip `mesa-v2-phase-r4-clean.zip`
2. GitHub → `mesa-2` repo → Add file → Upload files → drag contents, replace conflicts
3. Commit: `Phase R.4: Trainer cleanup`
4. Vercel auto-deploys ~90s
5. Hard refresh

---

## How to test

### 1. Trainer home = workouts-only activity log
1. Sign in as trainer
2. Land on `/dashboard`
3. Page header reads "Trainer · {Season Name}" with welcome message
4. Below: 1 stat card — Off-Ice Workouts (no Practices or Games cards)
5. Filter row: Type dropdown shows only "All types / Off-Ice Workouts"
6. From/To date inputs pre-filled with this Mon and Sun
7. Activity list shows only this week's off-ice workouts
8. No row is clickable; no hover state
9. Footer has "Manage activities →" link → routes to `/dashboard/workouts`

### 2. Trainer sidebar groups
1. Sidebar shows: Home, [Training ▾], [Performance Testing ▾], User Profile
2. NO "Students" item anywhere
3. Tap "Training" header → expands to show Exercises / Workout Templates / Off-Ice Workouts
4. Tap "Performance Testing" header → expands to show single "APA Sessions" item
5. Reload → state persists
6. Navigate to Exercises → Training group auto-expands

### 3. Sidebar labels
1. "Workout Templates" appears in sidebar (not "Workout Plans")
2. Click it → routes to `/dashboard/workout-plans`; the page itself works as before
3. "Off-Ice Workouts" still labeled the same → routes to `/dashboard/workouts`
4. "APA Sessions" still labeled the same → routes to `/dashboard/cpt-sessions`

### 4. Footer link routes correctly
1. From trainer home, tap "Manage activities →"
2. Routes to `/dashboard/workouts` (the trainer's editable Off-Ice Workouts list)
3. NOT `/dashboard/performance-management` (admin/director only) and NOT `/dashboard/practices` (coach's surface)

### 5. Mobile drawer
1. On phone, tap hamburger
2. Drawer shows the same grouped layout
3. Tap a group header → collapses; reopen drawer → state persists
4. Tap a nav link → drawer closes and you navigate

### 6. Other roles unchanged
1. Director home still shows all 3 activity types
2. Coach home still shows practices + games only
3. Admin / student / parent sidebars unchanged
4. Performance Management workbench still shows all 3 types

---

## Known limits / cosmetic notes

- **Trainer has no editable activity workbench** — clicking "Manage activities →" goes to the workouts list. Trainer edits workouts via the existing detail pages.
- **Performance Testing group has one item** — same single-child group pattern as director's Goal Management and coach's Game Review. Looks slightly redundant but keeps the structure consistent and leaves room to add items later.
- **Type dropdown on trainer home is essentially decorative** with only one option. Could be removed for a cleaner look, but I left it in for symmetry with the other roles' activity log views.
- **"Students" page still exists at `/dashboard/students`** — trainer just doesn't have a sidebar link to it. If a trainer has a bookmark, it might still load (depends on the page's `requireRole`).

---

## Roles status after R / R.2 / R.3 / R.4

| Role | Sidebar grouped | Activity log home |
|---|---|---|
| Admin | ✓ Phase R | — (still welcome card) |
| Director | ✓ Phase R.2 | ✓ All 3 types |
| Coach | ✓ Phase R.3 | ✓ Practices + Games |
| Trainer | ✓ Phase R.4 | ✓ Off-Ice Workouts |
| Student | — (flat) | — (custom dashboard) |
| Parent | — (flat) | — (family list) |

Student and parent sidebars are intentionally simple (small surface area). They don't need grouping.

If you want admin home to also become an activity log (showing all 3 types like director, but maybe with admin-specific framing), that's a small follow-up.

---

## Next phase candidates

- Admin home as activity log? (would parallel director with full visibility)
- Phase 8 (notifications) — still gated on Resend signup
- Apple Health webhook
