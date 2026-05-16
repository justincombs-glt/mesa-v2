# MESA v2 — Phase 8a: Invite Emails via Resend

**Status:** Ready to deploy
**SQL migration required:** None
**New env vars required:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (you've already added these)

Adds outbound email for the first event type: **user invited**. When an admin or director sends an invite via `/dashboard/invite`, the invitee now receives an actual email with the sign-in link. The DB-level invite row creation continues to work exactly as before; the email is layered on top.

This is the foundation for Phase 8 (notifications generally). 8a covers only the invite email. Future sub-phases will add other event types (goal assigned, APA results, workout released, Coach's Corner posted, weekly digest, etc.).

---

## How it works

### Invite flow (now)
1. Admin or director goes to `/dashboard/invite` → clicks **+ Invite a member**
2. Fills in email + role + optional linked record + optional note
3. Submits → DB row created in `invites` table → email fires immediately
4. Invitee receives a branded HTML email with a "Sign in to MESA" button
5. They click → land on `/sign-in` → enter their email → get a magic link → sign in → `handle_new_user` trigger consumes the invite + assigns the role + links any related student/player record

### Resend invite button
The pending invites list on `/dashboard/invite` now has a **Resend** button next to **Revoke** on each row. Useful if:
- The invitee accidentally deleted the original email
- It went to spam and they didn't notice
- You want to nudge them after a few days

Tapping **Resend** rebuilds the email from the existing invite row and sends a fresh copy. No DB write happens; the existing invite is unchanged.

### What if email sending fails
**Best-effort fire-and-forget design.** If Resend is down, your env vars are misconfigured, or the API rejects the send, the invite row is STILL created and the admin sees a normal success. The failure is logged server-side (visible in Vercel runtime logs) but doesn't block the action.

This is intentional. The invite still works manually — the admin can share the sign-in URL out of band. The email is a convenience, not a single point of failure.

If you want to retry, tap the **Resend** button on the pending invites list. That call DOES surface failure to the UI (gray "Failed" indicator next to the button) since it's an explicit retry action.

---

## Files added/changed

### New
- `lib/email/resend.ts` — thin Resend SDK wrapper; never throws, returns boolean
- `lib/email/templates/invite.ts` — buildInviteEmail() function, returns { subject, html, text }
- `PHASE-8A-README.md`

### Modified
- `package.json` — added `resend ^4.0.0` dependency
- `app/actions.ts` — `createInvite` now fires the email after DB insert. New `resendInviteEmail` server action (110 → 111). Internal helper `_sendInviteEmailForRow` shared between the two paths.
- `app/dashboard/invite/InviteClient.tsx` — added **Resend** button per pending invite row; new `PendingInviteRow` subcomponent with client-side state for sending feedback

### Files to delete from GitHub: none

---

## Action count: 110 → 111 (+1)

| Action | Purpose |
|---|---|
| `resendInviteEmail` | Re-fires the invite email for an existing pending row. Admin/director only. |

`createInvite` was modified (not counted as a new action) to send the email after creation.

---

## Email design

### Subject
"You've been invited to MESA"

### Body
- MESA branding header
- "X invited you to join MESA as a [Role]." (Role = Student / Player / Parent / Coach / Trainer / Director / Admin, title-cased)
- The invitee's email address shown in a mono-font box so they know which address to sign in with
- A "Sign in to MESA" button linking to `/sign-in`
- Brief explanation of magic-link auth ("no password required")
- The inviter's note (if any) shown in a callout box
- Footer: "If you weren't expecting this, you can safely ignore."

### Plain text fallback
A clean text-only version is included for clients that don't render HTML (or strip styles).

### From address
Uses the `RESEND_FROM_EMAIL` env var. You set this to `MESA <noreply@mail.athletessuite.com>` during Resend setup. Recipients see "MESA" in their inbox.

### Reply-To
Not set for invite emails — invites are one-way. Future notification types will set Reply-To to a real human inbox.

---

## Environment variables

You've already added these in Vercel; documenting for reference and dev setup:

| Var | Value example | Required? |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxxxx` (from resend.com/api-keys) | Yes for prod |
| `RESEND_FROM_EMAIL` | `MESA <noreply@mail.athletessuite.com>` | Yes for prod |
| `NEXT_PUBLIC_SITE_URL` | `https://mesa-v2-five.vercel.app` (or your custom domain) | Recommended |

### About `NEXT_PUBLIC_SITE_URL`
This is the public base URL used to build the "Sign in to MESA" link in the email body. If unset, the code falls back to `VERCEL_URL` (auto-set per deployment, lacks https:// prefix — code prepends it), then localhost for dev.

**You should set `NEXT_PUBLIC_SITE_URL` in Vercel.** Without it, preview deploys would generate sign-in URLs pointing at the preview URL (e.g. `mesa-v2-git-feature-branch.vercel.app`) instead of your stable production URL. Set this in Vercel → Settings → Environment Variables → add `NEXT_PUBLIC_SITE_URL` with value `https://mesa-v2-five.vercel.app` (or your custom domain), scoped to all three environments.

### If env vars aren't set
The `sendEmail` wrapper logs a console warning ("RESEND_API_KEY or RESEND_FROM_EMAIL not set — skipping send") and returns false. The DB row still gets created; the email simply doesn't fire. This means local dev without a Resend key configured still works.

---

## Deploy

### Step 1: Push code to GitHub via Claude Code
```
cd ~/Desktop/mesa-v2
claude
```
Then:
```
Unzip ~/Downloads/mesa-v2-phase-8a-clean.zip into the current directory,
overwriting existing files. Then run `git status` and `npm install`
(since package.json changed). Stop there.
```

Once you see the diff includes `package.json`, `package-lock.json`, the two new `lib/email/` files, `app/actions.ts`, and `InviteClient.tsx`:
```
Commit "Phase 8a: invite emails via Resend" and push.
```

### Step 2: Vercel auto-deploys
Vercel will rebuild on push, including running `npm install` to pull the new `resend` package. Wait ~90 seconds.

### Step 3: Verify

**As admin or director:**
1. Go to `/dashboard/invite`
2. Tap **+ Invite a member**
3. Enter a real email address you have access to (use your own + a "+test" alias for easy filtering: `you+invitetest@gmail.com`)
4. Pick a role (Player is a good test)
5. Send

Check that test inbox within a few seconds. You should receive a styled email from "MESA" with a sign-in button. Click the button → lands on `/sign-in`.

**Test resend:**
1. Go back to `/dashboard/invite`
2. The row should appear in pending invites
3. Tap **Resend**
4. "Sending..." → "Sent" indicator appears briefly
5. Check inbox — a second copy of the same email

**Test failure handling:**
1. In Vercel, temporarily unset `RESEND_API_KEY` (or set it to garbage like `re_invalid`)
2. Redeploy so the change takes effect
3. Send a new invite
4. **The invite row still gets created** (admin sees success in the UI) — but no email arrives
5. Vercel runtime logs (Project → Logs → Functions) show: `[email] sendEmail threw` or `[email] Resend API returned error`
6. Restore `RESEND_API_KEY` and redeploy

---

## Email design philosophy

**Inline-styled HTML** because email clients (especially Gmail / Outlook) strip `<style>` tags and don't load external CSS. Inline styles render consistently across clients.

**Plain text fallback** because some clients prefer it, and providing both improves spam scores.

**No tracking pixels.** No `?utm_source` query params on links. Keep it clean and not creepy.

**Conservative palette** — ivory background, ink text, crimson accent. Matches the in-app design. Avoids the "stock SaaS template" look.

---

## What's NOT in this phase

- **No notification preferences UI.** Users can't opt out of invite emails. (Invites are transactional and don't typically warrant opt-out anyway.)
- **No unsubscribe link.** Invites are transactional, not marketing. Future event types (digest emails, content notifications) will need an unsubscribe mechanism — that's Phase 8b territory.
- **No other notification types.** Just invites. Goal assignment, APA results, workout release, Coach's Corner posts, practice scheduled, weekly digest — all deferred.
- **No email open/click tracking.** Resend can do this but we don't need it for transactional invites.
- **No A/B test of subject lines.** One subject, one template.
- **No invite-expiration emails.** Invites currently don't expire. If you add expiration later (Phase X), you'd want a reminder email N days before expiry.
- **No follow-up "you haven't signed up yet" reminders.** A future job could find pending invites older than N days and notify either the inviter or the invitee, but that requires a scheduler. Not in this phase.
- **No localization.** English only.

---

## Security & deliverability notes

### Resend key scope
You scoped the API key to "sending access only" (per Resend setup step). Even if the key leaked, an attacker couldn't read your email logs or modify your account — they could only send email from your domain. Still bad, but bounded.

If you ever suspect the key was leaked: Resend dashboard → API Keys → revoke → generate new → update `RESEND_API_KEY` in Vercel → redeploy.

### SPF / DKIM / DMARC
All three were configured during the Resend domain setup. The DKIM signature on outbound emails proves they came from MESA, not a spoofer. Gmail and Outlook will trust them and not flag as spam (assuming initial reputation builds normally).

### What if Resend logs sensitive data
The wrapper logs the recipient's email (partially redacted) on failure. That's the only data crossing into Vercel's log stream. Email body content stays inside Resend's infrastructure.

### Rate limits
Resend free tier: 3,000 emails/month, 100/day. MESA's invite volume should be nowhere near this — you'd have to invite 100 people in a single day to hit the daily limit. If you ever do hit limits, the wrapper logs the error and returns false; the invite still works manually.

---

## Suggested next steps

The natural follow-up phases:

- **Phase 8b: broader notification events.** Pick the next 1-3 events that matter most. My recommendation order:
   1. **Workout released by trainer** (athlete should know they can now log)
   2. **Goal assigned to athlete** (athlete + parent should know)
   3. **Coach's Corner video posted** (everyone, possibly digestable)
- **Phase 8c: notification preferences UI.** Per-event opt-out for athletes/parents. Required before broader notification rollout to avoid complaints.
- **Phase 8d: unsubscribe handling.** One-click unsubscribe link in every non-transactional email. Legally required in some jurisdictions.
- **Phase 8e: weekly digest mode.** "Send me a summary every Sunday" instead of individual notifications. Reduces email volume; better UX for some parents.

Each of these can be its own focused phase. Start with 8b once 8a is verified working in production.

---

## Troubleshooting

**Invite sent, no email arrives:**
1. Check spam folder first
2. Vercel → Logs → Functions → filter for `[email]` — look for warnings/errors
3. If "RESEND_API_KEY or RESEND_FROM_EMAIL not set" → env vars missing or last deploy didn't pick them up. Redeploy.
4. If "Resend API returned error" → check the error detail in logs. Common: domain not verified, key revoked, recipient on suppression list.
5. Resend dashboard → Emails → see if the email is logged. If yes, deliverability issue (recipient's server bouncing). If no, the API call didn't reach Resend — env var or network issue.

**Email arrives but links are broken (404):**
- `NEXT_PUBLIC_SITE_URL` is unset or points to a stale URL. Fix in Vercel env vars + redeploy.

**Email looks broken in Outlook:**
- Outlook's email renderer is notoriously bad. Forward the email to yourself via Gmail and confirm it looks right there. If Gmail's good but Outlook's bad, it's a rendering quirk we'd need to address in the template (some Outlook-specific tweaks).

**Resend says domain is "Pending" or "Failed":**
- DNS propagation incomplete. Wait. If still failed after 2 hours, paste the DNS records you added and we'll debug.

**The "Resend" button shows "Failed" repeatedly:**
- Same diagnostic path as "no email arrives." Check Vercel logs.
