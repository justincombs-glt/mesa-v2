# MESA v2 — Phase 9b: Practice Device Metrics Pull

**Status:** Ready to deploy
**SQL migration required:** `0027_phase9b_device_metrics.sql`
**Vercel.json updated:** Yes — adds a second cron job
**Action count:** 111 (unchanged)

Phase 9b makes the device data actually flow. After a practice ends, a cron job pulls heart rate and activity data from Google Health for every rostered athlete with a connected device, computes HR zones, and stores derived metrics. Phase 9a's connection plumbing is now actually used.

This phase deliberately does NOT add a coach view of the metrics. That's 9c. The data lands in the DB and is verifiable via SQL; the UI to surface it comes next.

---

## What this phase ships

1. **New migration 0027** — `practice_device_metrics` table for derived metrics + `practice_device_pull_attempts` audit log + adds `duration_minutes` column to `activities`
2. **HR zone computation** — Fitbit-style zones (Out of Range / Fat Burn / Cardio / Peak) computed from raw HR samples + age-based max HR
3. **Google Health API pull** — fetches HR samples + total calories for a time window
4. **Per-athlete pull orchestration** — handles token refresh, error categorization, idempotent metrics save
5. **Cron route** — runs daily at 7 AM UTC (~2-3 AM ET), processes practices from the last 7 days that ended 30+ min ago and haven't been pulled
6. **Manual refresh route** — staff can POST to `/api/devices/refresh-practice` to immediately pull metrics for a specific practice (used by coach UI in 9c)

### Out of scope for 9b
- **Coach view** of the metrics — that's 9c
- **Athlete history view** of their own metrics over time — later
- **Whoop integration** — comes in 9d when device arrives
- **Setting `duration_minutes` from the practice creation form** — see "UI follow-up" below

---

## Files added

### New
- `supabase/migrations/0027_phase9b_device_metrics.sql` — schema additions
- `lib/devices/hr-zones.ts` — HR sample summarization and zone bucketing
- `lib/devices/pull-google-health.ts` — Google Health API calls (HR + calories)
- `lib/devices/practice-pull.ts` — orchestrates a single (practice, athlete) pull
- `lib/devices/practice-window.ts` — converts (occurred_on, starts_at, duration_minutes) → ET civil time + UTC range
- `app/api/cron/device-metrics-pull/route.ts` — Vercel cron endpoint
- `app/api/devices/refresh-practice/route.ts` — staff-only manual refresh

### Modified
- `vercel.json` — adds second cron job

### Files NOT modified by this zip (you'll need to do these separately)
- **The practice creation form** — does not currently have a `duration_minutes` field. Existing practices default to 90. See "UI follow-up" below for adding the field.

---

## Schedule + cadence

**Hobby plan constraint:** Vercel Hobby allows only one cron invocation per day per cron job. The schedule is `0 7 * * *` = every day at 7:00 UTC (2-3 AM ET depending on DST).

What this means in practice:
- Practice happens Monday evening
- Tuesday at ~2 AM ET, cron fires
- Metrics for Monday's practice are ready when staff log in Tuesday morning

**If you upgrade to Vercel Pro:** Edit `vercel.json` schedule to `*/30 * * * *` (every 30 min) for faster turnaround. Code already supports this — only the schedule changes.

**For immediate pulls:** Use the manual refresh endpoint (`/api/devices/refresh-practice`) — the coach UI will have a "Refresh device data" button in 9c. Or test it now with curl.

---

## Required env vars

Same as 9a. Nothing new for 9b. Verify these are still set:

| Var | Notes |
|---|---|
| `GOOGLE_HEALTH_CLIENT_ID` | Already set in 9a |
| `GOOGLE_HEALTH_CLIENT_SECRET` | Already set in 9a |
| `DEVICE_TOKEN_ENCRYPTION_KEY` | Already set in 9a |
| `NEXT_PUBLIC_SUPABASE_URL` | Existing |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing |
| `CRON_SECRET` | Already set in 8c |
| `NEXT_PUBLIC_SITE_URL` | `https://mesa.athletessuite.com` |

---

## Deploy

### Step 1: Run migration

In Supabase SQL Editor, paste `mesa-v2-migration-0027.sql` and run. Idempotent.

Creates:
- `practice_device_metrics` table with RLS (athletes/parents see their own + their kids' rows; staff see all)
- `practice_device_pull_attempts` audit log with the same RLS pattern
- `activities.duration_minutes` column (defaults to 90 for existing practices)

### Step 2: Push code

```bash
cd ~/Desktop/mesa-v2
claude
```

```
Unzip ~/Downloads/mesa-v2-phase-9b-clean.zip into the current directory,
overwriting existing files. Then run git status. Stop there.
```

Should show ~7 new files + modified `vercel.json`. If clean:

```
Commit "Phase 9b: device metrics pull cron + manual refresh" and push.
```

Vercel will redeploy and pick up the new cron schedule. The cron registration takes effect on the next deploy.

### Step 3: Verify cron is registered

In Vercel → your project → top nav → **Settings** → **Cron Jobs**. Should see:

- `/api/cron/weekly-digest` — Friday at 23:00 UTC
- `/api/cron/device-metrics-pull` — Daily at 07:00 UTC

If the second one isn't listed, the deploy didn't pick up `vercel.json`. Redeploy.

### Step 4: Test with manual trigger (dry run)

In your browser (substitute YOUR_SECRET):

```
https://mesa.athletessuite.com/api/cron/device-metrics-pull?token=YOUR_SECRET&dry_run=true&t=99
```

Expect JSON like:

```json
{
  "eligible_practices": 0,
  "total_attempts": 0,
  ...
  "results": []
}
```

If you have no practices in the last 7 days that ended 30+ min ago, this is the correct response. To force-test, create a test practice that ended a few hours ago (covered below).

### Step 5: Test with a real pull

Create a test practice:

1. Sign in as admin/director
2. Create a practice for today (or recently), maybe `12:00 PM` start, `90 min` duration
3. Add yourself (Justin) to the roster
4. Make sure your Fitbit is connected via `/dashboard/settings`
5. Wait until practice end time + 30 min has passed (or use yesterday's date)

Then trigger the cron:

```
https://mesa.athletessuite.com/api/cron/device-metrics-pull?token=YOUR_SECRET&t=anothertoken
```

Expect JSON like:

```json
{
  "eligible_practices": 1,
  "total_attempts": 1,
  "success": 1,
  "results": [
    {
      "activity_id": "...",
      "student_id": "...",
      "status": "success"
    }
  ]
}
```

Then verify in Supabase:

```sql
select student_id, provider, avg_hr, max_hr, duration_minutes, calories,
       zone_out_of_range_min, zone_fat_burn_min, zone_cardio_min, zone_peak_min
from practice_device_metrics
order by pulled_at desc;
```

Should show a row with HR data populated.

If `status: 'no_data'`, the device didn't sync data for that window. Check:
- Was the Fitbit worn during that window?
- Was an Exercise/Workout started on the Fitbit during that window? (HR data is most reliable when associated with an exercise event)
- Has Fitbit synced to Google? (Sync happens every 15 min when the app is open)

### Step 6: Test manual refresh endpoint

If you want to immediately re-pull a practice without waiting for cron:

```bash
curl -X POST https://mesa.athletessuite.com/api/devices/refresh-practice \
  -H "Content-Type: application/json" \
  -H "Cookie: <your session cookies>" \
  -d '{"activity_id": "<practice-uuid>"}'
```

Easier to test once 9c is shipped and there's a button in the UI. For now you can use the cron URL with `?only_activity_id=<uuid>` to test against one practice:

```
https://mesa.athletessuite.com/api/cron/device-metrics-pull?token=YOUR_SECRET&only_activity_id=<practice-uuid>
```

---

## UI follow-up: practice creation form

The migration adds `activities.duration_minutes` with a default of 90 for existing rows. New practices will also default to 90 unless explicitly set.

To make this user-configurable, add a "Duration (minutes)" field to your practice creation form. Find the form (likely something like `app/dashboard/practices/new/page.tsx` or similar) and:

1. Add a number input labeled "Duration (minutes)"
2. Default value: 90
3. Min: 15, Max: 240 (sanity bounds)
4. Pass the value as `duration_minutes` to the `createPractice` action
5. In the action, include `duration_minutes` in the activities insert

If you'd like me to ship this UI change, share the current practice creation form file and I'll write the diff.

---

## How it works (technical)

### Time window math
For each practice with `occurred_on=2026-05-17`, `starts_at=17:30:00`, `duration_minutes=90`:

- Civil start (ET): `2026-05-17T17:30:00`
- Civil end (ET): `2026-05-17T19:00:00`
- UTC start: 2026-05-17T21:30:00Z (in EDT) or 22:30 (EST)
- UTC end: 2026-05-17T23:00:00Z (in EDT) or 2026-05-18T00:00:00Z (EST)

Google Health API expects civil time in the user's local timezone. We pass the ET civil strings; Google interprets them as ET because that's the user's Fitbit/Google timezone setting.

### HR zone computation
Each HR sample is bucketed into a zone based on % of max HR:
- Out of Range: < 50%
- Fat Burn: 50-69%
- Cardio: 70-84%
- Peak: 85%+

Max HR is computed from age (220 - age) using the athlete's `students.date_of_birth`. If DOB is missing, defaults to age 20.

Time-in-zone is calculated by attributing each sample's "duration" (gap to next sample) to its zone. Gaps over 60 seconds are capped (signal loss, paused workout, etc.) — prevents inflating one zone when the watch lost contact.

### Token refresh
The pull orchestration checks token expiry before calling the API. If expired (or expiring within 5 min), it calls `refreshAccessToken` from 9a's library. New tokens are encrypted and saved back.

If the refresh fails (refresh token rejected or revoked), the connection is marked `reconnect_needed` and the user has to manually reconnect via the settings page. They'll see "Reconnect needed" in the Devices section.

### Idempotency
The cron skips practices that already have a successful metrics row. Safe to re-run any time. The manual refresh endpoint always pulls fresh (overwrites existing) so staff can force a re-pull if needed.

The metrics table has a unique constraint on `(activity_id, student_id, provider)` so the upsert is naturally idempotent at the DB level too.

---

## Common issues / failure modes

**`status: 'no_data'` for every athlete**
→ Most likely cause: device wasn't worn or wasn't synced. Check Fitbit app — does the athlete see HR data for that time period? If yes but MESA shows no data, the issue is the Google Health API isn't returning that data for our query.

**`status: 'token_refresh_failed'`**
→ The refresh token was revoked. Athlete needs to reconnect via `/dashboard/settings`. Their connection row is now marked `reconnect_needed` and the UI will show the reconnect prompt.

**`status: 'api_error'` with HTTP 401**
→ Token rejected by Google. Refresh succeeded but the access token still isn't accepted — usually means the OAuth scopes don't include what we're trying to read. Verify in Google Cloud Console → OAuth consent → Data Access that `activity_and_fitness.readonly` and `profile.readonly` are listed.

**`status: 'api_error'` with HTTP 403**
→ The user removed your app's permission at https://myaccount.google.com/permissions. Mark for reconnect.

**`status: 'api_error'` with HTTP 429**
→ Rate limited. Google Health API has per-app and per-user rate limits. Try again later. Should only matter for very high athlete counts.

**Eligible practices count is 0 despite recent practices**
→ Check `duration_minutes` column on those practices. If null, the window can't be computed and they'll be skipped. Run an UPDATE to set duration on those rows, or let the cron's recent-7-day filter age them out and pull them naturally once duration is fixed.

**Cron never fires**
→ Vercel → Settings → Cron Jobs — confirm `/api/cron/device-metrics-pull` is listed. If not, the deploy didn't pick up `vercel.json`. Redeploy.

---

## Operational notes

### Audit log
Every pull attempt — success or failure — is logged to `practice_device_pull_attempts`. Useful for debugging:

```sql
select activity_id, student_id, status, error_message, http_status, attempted_at
from practice_device_pull_attempts
order by attempted_at desc
limit 50;
```

### Data retention
There's no automatic cleanup. `practice_device_pull_attempts` will grow with usage. Reasonable cleanup policy: drop rows older than 60 days. Not urgent at current scale.

### Privacy
Athletes and parents only see metrics for themselves / their kids per RLS. Staff see all. HR data is sensitive — make sure your privacy policy reflects this once we get to verification stage.

### Encryption boundary
The DB only holds encrypted tokens (Phase 9a). The pull library decrypts in-memory just before the API call, never persists plaintext. Logs don't contain tokens.

---

## Verification checklist

- [ ] `0027_phase9b_device_metrics` migration ran successfully
- [ ] `practice_device_metrics` + `practice_device_pull_attempts` tables exist
- [ ] `activities.duration_minutes` column exists with default 90 for old practices
- [ ] Vercel shows both cron jobs registered in Settings → Cron Jobs
- [ ] Manual cron trigger with `dry_run=true` returns valid JSON
- [ ] Manual cron trigger with a real practice produces a `success` row in `practice_device_metrics`
- [ ] HR zone columns are populated (`zone_out_of_range_min` through `zone_peak_min`)
- [ ] Failed scenarios log to `practice_device_pull_attempts` with sensible status values

---

## Next: Phase 9c

Coach view on the practice detail page. Shows per-athlete metrics in the roster table:

| Athlete | Attendance | Avg HR | Max HR | Time in Peak | Time in Cardio |
|---|---|---|---|---|---|
| Andrew Combs | ✓ | 152 | 178 | 18 min | 42 min |
| Logan Smith | ✓ | — | — | — | — |
| ...

Athletes without connected devices show "—". Add a "Refresh device data" button at the top of the page that calls the manual refresh endpoint.

Estimated scope: ~3-4 files, one component to modify, no migration needed (data already lands from 9b).

Once 9b is verified working and you have a real pull producing real metrics, ping me and I'll ship 9c.
