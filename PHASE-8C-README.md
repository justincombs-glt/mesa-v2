# MESA v2 — Phase 8c: Weekly Digest Email

**Status:** Ready to deploy
**SQL migration required:** `0025_phase8c_weekly_digest.sql`
**New env var required:** `CRON_SECRET` (any random string — you'll generate one and add it to Vercel)
**Schedule:** Every Friday at 11 PM UTC (6 PM EST / 7 PM EDT)

Sends a single weekly email to every athlete and parent summarizing the past week's activity and the week ahead. This is the ONLY non-transactional email MESA sends — there are no real-time notification pings for individual events. Per your design intent: "very limited notifications."

---

## How it works

### Recipients
- **Athletes** (role = `student` or `player`): personal digest covering their own workouts, practices, games, goals, APA results.
- **Parents** (role = `parent`): household digest covering every linked child via `family_links`.
- **Staff** (admin / director / coach / trainer): no digest. They have the dashboard.

### Schedule
Vercel Cron Job fires every Friday at 11 PM UTC. This is **6 PM Eastern Standard Time** in winter, **7 PM Eastern Daylight Time** in summer. The hour stays the same in UTC year-round; the local clock shifts with DST.

If you want a strict ET hour (e.g. always 6 PM regardless of DST), you'd need to update `vercel.json` twice a year. Currently it shifts; acceptable for now.

### Content per athlete

**Past week** (last 7 days ending today):
- Workouts the athlete actually logged sets for (not just rostered)
- Count of practices on the schedule
- Games played with scores
- Goal plans updated (any field touched)
- APA results recorded
- Game review notes added by coaches

**Coming up** (next 7 days):
- Scheduled practices with date and time
- Scheduled games with opponent and home/away
- Released workouts ready to log
- Active goals (up to 5, titles only)

### Empty digest skipping (Q6 = C)
If ALL athletes in scope have empty past AND empty upcoming, the email is skipped entirely. A `digest_sends` row is logged with status `skipped_empty` so we can see who got skipped and why.

### Unsubscribe (Q10 = A)
Every digest email has a one-click "Unsubscribe from weekly digests" link in the footer. The URL contains a per-user random token. Clicking takes them to `/unsubscribe?token=...` which immediately sets `digest_enabled = false` and shows a confirmation page. No login required.

Transactional emails (invites, password resets) are NOT affected by unsubscribe — those continue regardless.

---

## Files added

### New
- `supabase/migrations/0025_phase8c_weekly_digest.sql` — `notification_settings` + `digest_sends` tables; updated `handle_new_user` trigger to auto-create a settings row for new users
- `lib/email/digest.ts` — `buildDigestForProfile()` queries the data and builds structured `DigestContent`
- `lib/email/templates/digest.ts` — `buildDigestEmail()` renders the digest into HTML + plain text
- `app/api/cron/weekly-digest/route.ts` — the cron endpoint Vercel hits weekly
- `app/unsubscribe/page.tsx` — the one-click unsubscribe landing page
- `vercel.json` — cron schedule configuration
- `PHASE-8C-README.md`

### Modified
- `middleware.ts` — `/unsubscribe` and `/api/cron/*` added to public allowlist

### Action count: 111 (unchanged)
The digest is built entirely in helper libraries + the API route; no new server actions needed for users.

---

## Required env vars

| Var | Purpose | Where set |
|---|---|---|
| `RESEND_API_KEY` | (already set) Sends digest emails via Resend | Vercel + dev |
| `RESEND_FROM_EMAIL` | (already set) From address | Vercel + dev |
| `NEXT_PUBLIC_SITE_URL` | (recommended) Used in email links | Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | (already set) For cross-user data aggregation | Vercel |
| `NEXT_PUBLIC_SUPABASE_URL` | (already set) Supabase project URL | Vercel |
| `CRON_SECRET` | **NEW** — Vercel sends this in the `Authorization: Bearer` header to authenticate cron requests | Vercel **only** (do NOT commit) |

### Generate `CRON_SECRET`

Pick any 32+ character random string. Easiest method on Mac:

```bash
openssl rand -hex 32
```

Output looks like `a3f8e2c91b4d7e6f2a8b9c4d1e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f`. Copy that.

Then in Vercel → Settings → Environment Variables:
- Name: `CRON_SECRET`
- Value: paste the random string
- Environments: Production only is fine (cron only runs in production)
- Save

Redeploy after adding so the env var takes effect.

---

## Deploy

### Step 1: Run migration

In Supabase SQL Editor:
1. Open `supabase/migrations/0025_phase8c_weekly_digest.sql`
2. Paste and Run

The migration is idempotent. It:
- Creates `notification_settings` table with RLS (users can read/update their own)
- Creates `digest_sends` log table with read-access for self + staff
- Updates `handle_new_user` to auto-create a settings row for new signups
- Backfills `notification_settings` rows for existing users with `digest_enabled = true`

### Step 2: Add CRON_SECRET env var in Vercel

(see above)

### Step 3: Push code via Claude Code

```bash
cd ~/Desktop/mesa-v2
claude
```

```
Unzip ~/Downloads/mesa-v2-phase-8c-clean.zip into the current directory,
overwriting existing files. Then run git status. Stop there.
```

Should show new files in `app/api/cron/`, `app/unsubscribe/`, `lib/email/`, plus modified `middleware.ts` and new `vercel.json` and migration.

```
Commit "Phase 8c: weekly digest emails via Vercel cron" and push.
```

### Step 4: Verify with manual trigger

After Vercel finishes deploying (~90s), test the cron job manually using the secret + query param.

Hit this URL in a browser (replace `YOUR_SECRET` with your actual CRON_SECRET, and the domain with your production URL):

```
https://mesa-v2-five.vercel.app/api/cron/weekly-digest?token=YOUR_SECRET&dry_run=true
```

You should get JSON like:

```json
{
  "range_start": "2026-05-10",
  "range_end": "2026-05-16",
  "upcoming_end": "2026-05-23",
  "total": 12,
  "success": 4,
  "skipped_empty": 7,
  "skipped_disabled": 0,
  "error": 1,
  "dry_run": true,
  "results": [
    { "profile_id": "...", "email": "you@example.com", "status": "success" },
    ...
  ]
}
```

`dry_run=true` builds the digest content but doesn't actually send. Read the JSON, confirm the per-user statuses look reasonable.

### Step 5: Send a real test to YOURSELF only

```
https://mesa-v2-five.vercel.app/api/cron/weekly-digest?token=YOUR_SECRET&only=YOUR_PROFILE_ID
```

Find your profile ID by running this in Supabase SQL Editor:

```sql
select id, email, role from public.profiles where email = 'justin.combs@gltconsulting.io';
```

Paste the `id` value into the `&only=` param. This sends only YOUR digest. Check your inbox.

### Step 6: Wait for Friday

Once verified working, the cron will fire automatically Friday at 6/7 PM ET. Vercel will hit `/api/cron/weekly-digest` with the `Authorization: Bearer YOUR_CRON_SECRET` header, and the digest goes out to everyone with `digest_enabled = true`.

---

## What's NOT in this phase

- **No last-minute exception notifications.** Per Q12 = A, even same-day practice cancellations only show up in the next Friday digest.
- **No preferences page in the UI.** Users can opt out via the email footer link, but they can't toggle it back ON without admin help. If you want a settings page, that's a follow-up phase.
- **No notification preferences for OTHER event types** because there are no other event types. Digest is the only thing being sent.
- **No SMS / push notifications.** Email only.
- **No per-event opt-out granularity.** All or nothing — you get the digest or you don't.
- **No HTML email preview in the dashboard.** Admin can manually trigger with `?only=` + their own profile to see what their digest would look like; no in-app preview.
- **No internationalization.** English only.

---

## Operational notes

### When does the cron actually run?

Vercel Cron is documented as "approximate" — the actual fire time can drift by ±60 seconds. For a weekly job, this is fine.

### What happens if the cron job fails?

If the endpoint throws or returns a non-2xx status, Vercel logs it but **does NOT retry automatically**. You'd need to manually trigger it via the `?token=` URL. Realistically the only ways for it to fail are:
- `CRON_SECRET` env var missing → 500
- Supabase down or slow → individual recipient send errors logged per-user
- Resend down → all recipients get `error` status

Check Vercel logs (filter `/api/cron`) for the run output after each Friday to confirm it went well.

### Audit log

Every recipient's outcome is recorded in `digest_sends`:

```sql
select profile_id, sent_at, status, error_message
from public.digest_sends
order by sent_at desc
limit 50;
```

Statuses: `success` | `skipped_empty` | `skipped_disabled` | `error`. The `error_message` column has detail when `status = 'error'`.

### Volume estimate

For your current scale (~10-15 active users), each Friday digest is at most ~10 emails. Resend free tier handles 3,000/month easily. Even at 200 users you'd be at ~800 emails/month.

### What if a user has 4 kids?

A parent with 4 athletes gets ONE email containing 4 athlete sections (one per kid). The email body is longer but still one send.

### Players & nutrition / Coach's Corner / etc.

The digest deliberately leaves out:
- Nutrition (private to athlete + linked staff, not really "newsworthy" weekly)
- Coach's Corner views (low-value notification)
- Player profile details (static)

If you want any of those in the digest later, the `_buildAthleteDigest` function in `lib/email/digest.ts` is where you'd add the queries.

---

## Cleanup item

Remove the Phase 8a diagnostic route (you may have already done this — if so, skip):

```
Delete the folder app/api/test-email/ entirely. Also remove this line
from middleware.ts: "pathname.startsWith('/api/test-email') ||"
Then run git status, stop there.
```

Then commit + push.

---

## Suggested next steps

After this verifies in production with one or two real Friday sends:

- **Notification preferences UI** — let users toggle digest_enabled back ON after unsubscribing, or add per-event-type toggles if you ever expand beyond the digest. Probably belongs in a `/dashboard/settings` page that doesn't exist yet.
- **Admin "preview my digest" button** — internal tool for admins to see what's about to go out before Friday.
- **Cron run history page** — admin view of recent `digest_sends` rows, statuses, and a button to manually trigger.
- **Per-staff "weekly recap"** — admin/director/coach/trainer roles could optionally get their OWN digest about academy activity (Q5=B currently excludes them; reversal would be a small change).
- **Discontinue unused tables** — if `digest_sends` grows large, set up a cron to delete rows older than 90 days.
