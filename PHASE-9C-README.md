# MESA v2 — Phase 9c: Coach View of Device Metrics

**Status:** Ready to deploy
**SQL migration required:** None
**New env vars required:** None
**Action count:** 111 (unchanged)

Surfaces the device metrics that Phase 9b produces. Staff viewing a practice detail page see a table of per-athlete metrics (avg HR, max HR, time in cardio+peak zones) plus a button to refresh on demand.

This phase is purely UI. No data model changes, no new backend endpoints (uses the existing `/api/devices/refresh-practice` from 9b).

---

## What this phase ships

A drop-in `<DeviceMetricsTable>` component you mount once on the practice detail page. It:

- Fetches metrics + connection status from the DB (RLS-aware — staff see all rows)
- Renders a roster table with metric columns
- Shows "no device connected" subtitle for athletes without a Fitbit
- Shows "reconnect needed" subtitle (red) for athletes whose token went stale
- Shows "no data for this practice" subtitle when device exists but no data was returned
- Has a "Refresh device data" button that synchronously triggers a fresh pull
- Shows "Last refreshed [relative time]" indicator

### Out of scope for 9c
- **Per-athlete history view** — showing an athlete's metrics across multiple practices on their profile page. Future phase.
- **Drill-down details** — clicking a row to see HR zone breakdown, time-series chart, etc. Future phase.
- **Mini stacked-bar HR zone visualization** — just numbers for now.
- **Per-row individual refresh buttons** — one button refreshes the whole roster.

---

## Files added

### New
- `app/dashboard/practices/[id]/DeviceMetricsTable.tsx` — server component; loads data + renders the table
- `app/dashboard/practices/[id]/RefreshDeviceMetricsButton.tsx` — client component; the refresh button + status messages

### Modified
**The practice detail page** (`app/dashboard/practices/[id]/page.tsx` or wherever your practice detail lives) — you mount the new component with **one import + one JSX line**. See "How to mount" below.

---

## How to mount

Open your existing practice detail page. Find the section that renders the practice roster (or where you'd naturally want the device metrics to appear — probably near the bottom, after the roster).

### Step 1: Import at the top

```tsx
import { DeviceMetricsTable } from './DeviceMetricsTable';
```

### Step 2: Determine if viewer is staff

You probably already have the current user's profile loaded (with role). If not:

```tsx
// In your existing data loading section
const { data: viewerProfile } = await supabase
  .from('profiles').select('role').eq('id', user.id).maybeSingle();
const viewerIsStaff = ['admin', 'director', 'coach', 'trainer'].includes(
  (viewerProfile as { role: string } | null)?.role ?? ''
);
```

### Step 3: Mount the component

Wherever you want it (somewhere below the existing roster section):

```tsx
{viewerIsStaff && (
  <DeviceMetricsTable
    activityId={practice.id}
    roster={rosterArray.map((r) => ({
      student_id: r.student_id,
      student_name: r.student_full_name, // adjust to match your existing field name
      profile_id: r.student_profile_id, // may be null; adjust to match your existing field name
    }))}
  />
)}
```

The exact field names depend on how your existing page loads the roster. The component needs three things per row:
- `student_id` (UUID)
- `student_name` (display string)
- `profile_id` (UUID or null — null for student records not yet linked to an auth profile)

### Step 4: If you don't currently load `profile_id` for the roster

You'll need to extend the query that loads the roster. If your existing code does something like:

```ts
.from('activity_students')
.select('student_id, students(id, full_name)')
```

Extend the inner select to include profile_id:

```ts
.from('activity_students')
.select('student_id, students(id, full_name, profile_id)')
```

---

## Visual / UX behavior

### Headers (right-aligned for numeric columns)
| Athlete | Avg HR | Max HR | Time in Cardio+Peak |
|---|---|---|---|

### Athlete column states

| Connection state | Subtitle shown under name |
|---|---|
| No connection at all | "no device connected" (faint) |
| Connection exists, status = `reconnect_needed` | "reconnect needed" (crimson) |
| Connection exists, status = `connected`, but no metrics row for this practice | "no data for this practice" (faint) |
| Connection exists, metrics row exists | — (no subtitle) |

### Metric cells
- Filled cells: number, right-aligned, tabular-nums for clean alignment
- Empty cells: em-dash (—) in faint color

### Header area
- **H2** "Device metrics"
- **Tiny line** "Last refreshed 12 min ago" (or "Tue May 17 · 7:32 AM" for older)
- **Right side** "Refresh device data" button

### Refresh button states
- **Idle:** "Refresh device data"
- **In flight:** "Refreshing…" (disabled, no spinner — relies on text)
- **After success:** brief summary line "5 updated · 2 no data · 1 no device"
- **After error:** crimson error message ("502: connection refused" etc.)
- After success, the table re-renders with fresh data (uses `router.refresh()`)

---

## Refresh behavior

When clicked:

1. POST `/api/devices/refresh-practice` with `{ activity_id }` in body
2. The endpoint (from 9b) iterates every rostered athlete with a connected device
3. For each: refreshes token if needed, pulls fresh data from Google Health, saves metrics, logs attempt
4. Returns a JSON summary
5. Component parses summary into a counts string
6. Component calls `router.refresh()` which re-fetches server data

**Synchronous wait time** scales with roster size — roughly 2-5 seconds per athlete with a connection (token refresh + API call). For a typical hockey practice (~15 athletes, ~5 with connected devices), expect 10-30 seconds.

The button is disabled during the wait. The page itself remains interactive (you can navigate away if needed — the request will continue server-side).

---

## Deploy

### Step 1: Push code

```bash
cd ~/Desktop/mesa-v2
claude
```

```
Unzip ~/Downloads/mesa-v2-phase-9c-clean.zip into the current directory,
overwriting existing files. Then run git status. Stop there.
```

Should show 2 new files in `app/dashboard/practices/[id]/` plus the README.

### Step 2: Mount the component

Open your practice detail page (`app/dashboard/practices/[id]/page.tsx` or similar). Add the import + JSX block per "How to mount" above.

If you'd like me to write the exact integration:
- Share the current contents of your practice detail page file
- I'll write a precise diff
- Otherwise do it yourself (or with Claude Code) — should be straightforward

### Step 3: Commit and push

```
Commit "Phase 9c: device metrics table on practice detail page" and push.
```

### Step 4: Verify

1. Sign in as staff (admin/director/coach/trainer)
2. Navigate to any practice detail page
3. Scroll to find "Device metrics" section
4. Should see roster with metric columns
5. Athletes without devices show "no device connected"
6. Click "Refresh device data" → wait → summary appears, table re-renders

For a fully populated test:
1. Create a practice with you on roster, set start time to a few hours ago, duration 90 min
2. Connect Fitbit at `/dashboard/settings` (if not already)
3. Make sure your Fitbit synced for that time period
4. Visit the practice page
5. Click refresh
6. Should see your HR data in the row

### Step 5: Confirm staff-only behavior

Sign out, sign in as a parent/athlete. Visit a practice detail page. **Device metrics section should NOT appear.** If you forgot the `{viewerIsStaff && ...}` gate, parents/athletes would see the section but with empty rows (RLS hides other athletes' metrics). The gate is for UX clarity — they shouldn't see the section at all.

---

## What viewers see (by role)

### Staff (admin/director/coach/trainer)
- Full device metrics table
- All athletes' metrics visible (their own data + every other athlete on roster)
- Refresh button works

### Parent / Athlete
- No device metrics section at all (assuming you wrap with `{viewerIsStaff && ...}`)
- Their data still shows up in:
  - The weekly digest email
  - (Future) athlete profile page when 9c+ adds that view

---

## Edge cases

**Practice has no roster**
→ Table renders with "No athletes on roster." message. Refresh button still works (returns 0 results).

**Athlete with no profile**
→ Shows in roster with "no device connected" subtitle. The refresh endpoint also skips them (no profile = no possible connection).

**Refresh while another refresh is in-flight**
→ Button is disabled during in-flight. Single-flight only.

**Token expired and refresh fails**
→ Athlete's row shows "no data for this practice" (with the connection still showing). Behind the scenes, that athlete's connection is now marked `reconnect_needed`. Next visit to the page shows "reconnect needed" subtitle. They have to reconnect via `/dashboard/settings`.

**Mobile / narrow screens**
→ Table has `overflow-x-auto` so it horizontally scrolls. Could be made more compact in a future pass.

---

## Verification checklist

- [ ] Both files copied to `app/dashboard/practices/[id]/`
- [ ] Practice detail page imports `DeviceMetricsTable`
- [ ] `viewerIsStaff` boolean computed correctly
- [ ] Component mounted with `activityId` and `roster` props
- [ ] Roster array contains `student_id`, `student_name`, `profile_id` for each row
- [ ] Staff viewing practice detail page see the new section
- [ ] Parents/athletes do NOT see the section
- [ ] "no device connected" subtitle appears for athletes without connections
- [ ] Refresh button triggers a pull and the table re-renders

---

## What's next

Once 9c is mounted and verified working with at least one connected athlete:

- **Phase 9d:** Whoop integration. Once you have a Whoop device, register as a developer at developer.whoop.com, mirror the Google Health flow. Whoop as a second device option in the settings page. Whoop strain score becomes a 4th metric column when applicable.

- **Phase 9e (later):** Submit for Google Health verification before academy-wide rollout. 4-6 week Google review process. Required before non-test-list users can connect.

- **Phase 9f (later):** Per-athlete history view. New page or section on athlete profile showing recent practice metrics over time. Maybe a small chart of avg HR trend.

- **Practice duration form field:** Still pending from 9b. Add a "Duration (minutes)" field to practice creation form. Defaults to 90.

- **Settings sidebar link:** Still pending from 9a. Add a "Settings" link to your sidebar pointing at `/dashboard/settings`.
