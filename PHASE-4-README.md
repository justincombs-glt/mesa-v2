# MESA v2 — Phase 4: Coach Module

**Status:** Ready to deploy
**What's new:** Coaches (and admins/directors) can now schedule practices and log games with per-player stats.

---

## What shipped

### Practices
- **List page** (`/dashboard/practices`): all practices for the current season, each showing date, time, roster count, and attendance-marked count.
- **Schedule-practice modal**: date, time, optional practice plan template, focus, notes — PLUS a **checkbox roster** (every active student pre-checked, uncheck absentees before creating). Q7 part A.
- **Detail page** (`/dashboard/practices/[id]`): edit meta, view plan items (read-only — edit the plan itself to change), 3-state attendance grid (Present / Absent / Clear), add students to roster via modal (Q7 part B — post-creation checkbox).
- Season-scoped via `getSeasonContext` + cookie selector.
- Archived seasons render the whole page read-only.

### Games (activities)
- **List page** (`/dashboard/activities`): all games for the current season with opponent, score (color-coded: sage = win, crimson = loss, muted = tie), venue, roster count, stats-recorded count.
- **Log-game modal**: opponent, date, time, home/away, scores, venue, notes. Creates game and redirects to detail page.
- **Detail page** (`/dashboard/activities/[id]`):
  - Edit meta (opponent, date, home/away, scores, venue, notes) with delete
  - Roster section — add/remove players; **picker shows only current-season enrolled students** (Q4 = B)
  - **Two separate stat grids** (Q6 = B):
    - **Skater stats table**: G, A, +/−, Shots, PIM, TOI
    - **Goalie stats table**: Saves, SA, GA, SV% (auto-computed)
  - Click any row to inline-edit; non-displayed fields preserved on save.

### Stats data model (Q5 deferred to Phase 4.5)
Phase 4 uses the **existing `game_stats` table** with its hardcoded column set (goals, assists, plus_minus, shots, penalty_mins, time_on_ice, saves, shots_against, goals_against, notes). This is the **A2 default set**. Admin's "define your own stats" UI will ship in a later phase (Option 1 — deferred).

---

## Files added/changed

**New files:**
```
app/dashboard/practices/page.tsx
app/dashboard/practices/PracticesClient.tsx
app/dashboard/practices/[id]/page.tsx
app/dashboard/practices/[id]/PracticeDetailClient.tsx
app/dashboard/activities/page.tsx
app/dashboard/activities/ActivitiesClient.tsx
app/dashboard/activities/[id]/page.tsx
app/dashboard/activities/[id]/GameDetailClient.tsx
```

**Actions added to `app/actions.ts`** (10 new, 61 total unique):
```
createPractice, updatePractice, deletePractice
createGame, updateGame, deleteGame
addStudentToActivity, removeStudentFromActivity
setAttendance
upsertGameStat
```

---

## Database

**No new migrations.** All tables already exist from prior phases:
- `activities` (Phase 1) — handles both practice and game rows via `activity_type`
- `activity_students` (Phase 1) — many-to-many roster
- `attendance` (Phase 1) — student per activity with status
- `game_stats` (Phase 1) — per-player stats for games
- `season_enrollments` (Phase 3.5) — used to filter the game roster picker

---

## Deploy steps

1. **Unzip** `mesa-v2-phase4-clean.zip` on your Mac.
2. **Go to GitHub → the `mesa-2` repo → Add file → Upload files.**
3. **Drag the CONTENTS of the unzipped folder** (not the folder itself) onto the upload page. When prompted, choose "Replace" for any conflicts.
4. **Commit message:** `Phase 4: Coach module (practices + games)`
5. **Wait ~90 seconds** for Vercel to redeploy.
6. **Hard refresh** (`Cmd+Shift+R`) or open an Incognito window.

No SQL to run. No env var changes. No schema cache reload needed.

---

## How to test

### As a coach (or admin / director)
1. Make sure a season is active. If not, create one in `/dashboard/seasons` and mark it current.
2. Ensure at least 2–3 active students enrolled in that season (enrollment happens automatically on student creation if there's a current season).
3. **Practices flow:**
   - Go to `/dashboard/practices` → click **Schedule practice**
   - Pick a date/time, leave the checkbox roster as-is (or uncheck someone)
   - Save → land on list
   - Click the new practice → attendance grid appears with one row per rostered student
   - Click **Present** / **Absent** buttons; they toggle and persist
   - Try **Add player** to bring someone else onto the roster
4. **Games flow:**
   - Go to `/dashboard/activities` → click **Log game**
   - Fill opponent/date/scores → save → lands on detail page
   - Click **+ Add player** — confirm only current-season-enrolled students appear
   - Add a skater and a goalie (position = G)
   - Confirm TWO stat tables render (skaters up top, goalies below)
   - Click a skater row → edit goals, assists, etc. → save → row collapses with the new values
   - Click a goalie row → edit saves & shots against → save → SV% auto-computes

### Archive test
1. Archive the season (requires no in-progress plans/reviews — may need to complete/delete any).
2. Navigate to the practices list for that season → confirm **Schedule practice** is disabled.
3. Navigate to a game detail page → confirm stat rows don't enter edit mode when clicked and all delete/edit buttons are gone.

---

## Known limits / deferred work

- **Admin stat definitions UI** — deferred to Phase 4.5 per Q5 Option 1. The default stat set (A2) is hardcoded.
- **Per-player season totals** — not shown anywhere yet (will surface in Phase 5/6 player dashboards).
- **Attendance percentages** rolled up to goal plans — deferred to Phase 7 (auto-populated review data).

---

## Next phase

**Phase 5 — Trainer module:**
- Exercises repo (already built)
- Workout plans + scheduled off-ice workouts
- Per-student per-set logging (weight/reps)
- **CPT session recording** — this is what populates the currently-empty year-over-year performance tables on goal plan detail pages.
