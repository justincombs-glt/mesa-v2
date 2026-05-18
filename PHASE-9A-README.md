# MESA v2 — Phase 9a: Device Connections (Google Health / Fitbit OAuth)

**Status:** Ready to deploy
**SQL migration required:** `0026_phase9a_device_connections.sql`
**New env vars required:** `GOOGLE_HEALTH_CLIENT_ID`, `GOOGLE_HEALTH_CLIENT_SECRET`, `DEVICE_TOKEN_ENCRYPTION_KEY`
**Action count:** 111 (unchanged)

First phase of the wearable integration. Builds the OAuth connection plumbing for the new Google Health API (which replaces the legacy Fitbit Web API in September 2026). Phase 9a does NOT pull data yet — it only establishes the connection. Athletes can connect their Fitbit (via Google Health OAuth), see the connection status, and disconnect. The actual data pulls come in Phase 9b.

---

## What this phase ships

1. **New settings page** at `/dashboard/settings` with a "Devices" section and stubs for future settings
2. **Google Health OAuth flow** — standard authorization code with PKCE
3. **Encrypted token storage** — access + refresh tokens stored as AES-256-GCM ciphertext
4. **Connect / Disconnect UX** — one-click flow, status banners, error handling

### Out of scope for 9a (coming in later phases)

- **9b:** Cron job + on-demand pulls of practice metrics from connected devices
- **9c:** Coach view on practice detail page showing per-athlete HR / zones
- **9d (later):** Whoop OAuth — added when you receive your Whoop device

---

## Files added

### New
- `supabase/migrations/0026_phase9a_device_connections.sql` — `user_device_connections` table + RLS
- `lib/oauth/google-health.ts` — OAuth client: authorize URL, code exchange, refresh, revoke
- `lib/devices/encryption.ts` — AES-256-GCM token encrypt/decrypt helpers
- `lib/devices/connection.ts` — high-level get/save/delete connection wrappers with encryption baked in
- `app/api/oauth/google-health/start/route.ts` — initiates OAuth (sets PKCE cookies, redirects to Google)
- `app/api/oauth/google-health/callback/route.ts` — handles return from Google, exchanges code for tokens
- `app/api/oauth/google-health/disconnect/route.ts` — revokes token at Google, deletes local row
- `app/dashboard/settings/page.tsx` — settings index with Devices section + Notification/Account stubs
- `app/dashboard/settings/devices/DevicesSection.tsx` — interactive Devices UI

### Modified
None in this zip. **One small follow-up needed in your sidebar component** — see "Sidebar link" section below.

---

## Required env vars

| Var | Value | Where |
|---|---|---|
| `GOOGLE_HEALTH_CLIENT_ID` | OAuth client ID from Google Cloud Console (looks like `xxxxx.apps.googleusercontent.com`) | Vercel — all environments |
| `GOOGLE_HEALTH_CLIENT_SECRET` | OAuth client secret from Google Cloud Console (looks like `GOCSPX-...`) | Vercel — Production only |
| `DEVICE_TOKEN_ENCRYPTION_KEY` | A base64-encoded 32-byte random key | Vercel — all environments |

You already have the first two in Vercel from the Google Cloud setup. You need to generate and set the third.

### Generate `DEVICE_TOKEN_ENCRYPTION_KEY`

In Terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Output: a 44-character base64 string like `Kx7vQ2mN8pL4...=`. Copy it.

Add as Vercel env var:
- Name: `DEVICE_TOKEN_ENCRYPTION_KEY`
- Value: paste the base64 string
- Environments: Production, Preview, Development (all three)
- Save

**Critical: do NOT change this value after the first user connects a device.** If you rotate this key, all existing encrypted tokens become unreadable and users will need to reconnect. If you ever need to rotate (e.g. you suspect the key leaked), plan for forced reconnection of all users at the same time.

### Redeploy

After all three env vars are set, redeploy from Vercel so they load.

---

## Deploy

### Step 1: Run migration

In Supabase SQL Editor, paste `mesa-v2-migration-0026.sql` and run. Idempotent.

The migration creates:
- `user_device_connections` table (one row per user per provider)
- RLS policies (users see/delete only their own rows)
- `touch_device_connection_updated_at` trigger for `updated_at` column

### Step 2: Add env vars + redeploy

Per "Required env vars" section above.

### Step 3: Push code

```bash
cd ~/Desktop/mesa-v2
claude
```

```
Unzip ~/Downloads/mesa-v2-phase-9a-clean.zip into the current directory,
overwriting existing files. Then run git status. Stop there.
```

Should show new files in `app/api/oauth/google-health/`, `app/dashboard/settings/`, `lib/oauth/`, `lib/devices/`, plus the migration and README.

```
Commit "Phase 9a: device OAuth flow + settings page (Google Health)" and push.
```

### Step 4: Add sidebar link (small follow-up)

The settings page is reachable by typing `/dashboard/settings` in the URL bar, but you'll want a sidebar link. Find your existing sidebar component (likely something like `app/dashboard/_components/Sidebar.tsx`) and add a settings link. The standard pattern:

```tsx
<Link href="/dashboard/settings">Settings</Link>
```

Place it near the bottom (above "Sign out" if you have one). Available to all roles.

If you'd like me to ship the sidebar edit, share the current sidebar file contents and I'll write the exact diff. Otherwise you can do this yourself or with Claude Code.

### Step 5: Verify end-to-end

1. Sign in to MESA as yourself (Justin, with `combsjus@gmail.com` as test user)
2. Navigate to `https://mesa.athletessuite.com/dashboard/settings`
3. Should see "Devices" section with a "Connect" button next to "Fitbit (via Google Health)"
4. Click **Connect** → redirects to `accounts.google.com/o/oauth2/v2/auth?...`
5. You should land on Google's consent screen showing MESA's app name and the two scopes (activity & fitness, profile)
6. Sign in with `combsjus@gmail.com` if not already
7. Click "Continue" / "Allow"
8. You'll be redirected back to `https://mesa.athletessuite.com/dashboard/settings?devices_status=connected`
9. Should see green success banner: "Connected. We'll pull practice data from your device automatically."
10. The Fitbit row now shows "Connected May 17, 2026" and a "Disconnect" button

**Verify in Supabase:**

```sql
select profile_id, provider, status, scopes, connected_at, length(access_token_encrypted) as enc_len
from user_device_connections;
```

Should show one row with `status = 'connected'`, `provider = 'google_health'`, and `enc_len` around 200-400 characters (the encrypted access token).

**Test disconnect:**

1. Click **Disconnect**
2. Should redirect back with "Disconnected" message
3. Row should be gone from `user_device_connections`
4. Google revoked the access — if you reconnect, you'll see the consent screen again (rather than auto-approval)

---

## Test user reminder

Because the OAuth consent screen is in "Testing" mode, only Google accounts in the test users list can complete the flow. Currently that includes only `combsjus@gmail.com` based on our setup. To test with anyone else (e.g. a real athlete's Fitbit account):

1. Google Cloud Console → Google Auth Platform → Audience
2. Find "Test users" section
3. Add their Google account
4. They can now use the flow

100-user limit during testing. When the app is ready for general rollout, we'd submit for verification (4-6 weeks via Google's review). Not in scope yet.

---

## Common issues

**"Access blocked: This app's request is invalid"**
→ The redirect URI in Google Cloud Console doesn't match what the code sends. Check Google Cloud → OAuth Client → Authorized redirect URIs includes exactly `https://mesa.athletessuite.com/api/oauth/google-health/callback` (no trailing slash, https, exact subdomain).

**"Access blocked: This app is not verified"**
→ Either the user trying to connect is NOT in the test users list, OR the app is in testing mode and the user clicked through the wrong path. Add them as a test user.

**"State mismatch (CSRF check failed)" banner after callback**
→ User took longer than 10 minutes between clicking Connect and finishing Google's consent flow. The cookies expired. Just have them click Connect again.

**"No refresh token returned by Google"**
→ Google sometimes omits the refresh token if the user has previously granted access to your app. The code requests `prompt=consent` to force fresh tokens, but if Google still doesn't return one, the user can revoke MESA at https://myaccount.google.com/permissions and then reconnect.

**Settings page shows error banner about `DEVICE_TOKEN_ENCRYPTION_KEY`**
→ Env var isn't set or didn't load. Set it in Vercel, redeploy, retry.

**Disconnect doesn't actually revoke at Google's side**
→ Visible if you immediately reconnect and the consent screen auto-approves. Means the revoke API call failed silently. Acceptable for v1 — the local DB row is gone so MESA stops using the token. User can manually revoke at myaccount.google.com if they care.

---

## Security notes

### Token encryption
Access and refresh tokens are encrypted at rest using AES-256-GCM. The key never appears in source code or in the database. Anyone with read access to the Supabase database alone (without the Vercel env vars) cannot decrypt the tokens.

### PKCE
The OAuth flow uses Proof Key for Code Exchange (PKCE) to defend against authorization code interception attacks. The code verifier is held in an httpOnly cookie that expires in 10 minutes.

### CSRF
The OAuth `state` parameter is generated randomly per request and stored in an httpOnly cookie. The callback route verifies the state matches before proceeding.

### Scope minimization
We request only two scopes: `activity_and_fitness.readonly` (HR + activity data) and `profile.readonly` (user identity). We do NOT request sleep, nutrition, location, or body measurements.

### Token lifetime
Google Health access tokens are short-lived (~1 hour). Phase 9b will add automatic refresh before expiry. In Phase 9a, since we don't pull data, token expiry doesn't matter yet.

---

## Suggested next steps

- **Phase 9b:** Data pull cron job. Adds a `practice_device_metrics` table and a Vercel cron that runs ~30 min after each practice end, queries the Google Health API for HR data in the practice time window, and stores derived metrics (avg HR, max HR, calories, HR zone minutes).
- **Phase 9c:** Coach view. Adds columns to the practice roster table on `/dashboard/practices/[id]` showing each athlete's metrics. Indicators for missing data ("—"), missing device ("not connected"), etc.
- **Phase 9d:** Whoop OAuth. Once your Whoop device arrives, register as a Whoop developer, mirror the Google Health flow, add Whoop as a second device option.
- **Phase 9e (eventual):** Submit for Google Health verification before academy-wide rollout. ~4-6 week review process. Required before non-test-list users can connect.

---

## Verification checklist

Before declaring 9a done, verify all of these:

- [ ] `0026_phase9a_device_connections` migration ran successfully in Supabase
- [ ] `user_device_connections` table exists with RLS enabled
- [ ] `GOOGLE_HEALTH_CLIENT_ID` env var set in Vercel
- [ ] `GOOGLE_HEALTH_CLIENT_SECRET` env var set in Vercel (Production only)
- [ ] `DEVICE_TOKEN_ENCRYPTION_KEY` env var set in Vercel
- [ ] Redeployed after env vars
- [ ] `combsjus@gmail.com` added as test user in Google Cloud OAuth consent screen
- [ ] OAuth redirect URI in Google Cloud Console matches `https://mesa.athletessuite.com/api/oauth/google-health/callback`
- [ ] Successfully completed Connect → Google consent → return → status row in DB
- [ ] Successfully completed Disconnect → row deleted from DB
- [ ] Reconnect after disconnect shows Google consent screen (not auto-approval)
- [ ] Sidebar link added (or alternate navigation path documented)
