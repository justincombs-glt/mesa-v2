# MESA v2 — Phase 8b: Password Authentication

**Status:** Ready to deploy
**SQL migration required:** None
**Supabase config required:** Confirm email OFF + custom SMTP (Resend) — already done

Replaces magic-link sign-in with email + password. Builds on top of Phase 8a's Resend integration. Auth emails (password reset, etc.) flow through Resend SMTP so the branding is consistent.

---

## How it works

### New user flow (invited)
1. Admin invites user → invite email goes out from Resend
2. Invitee clicks **Set up your account** button → lands on `/sign-up?email=their@email.com`
3. Email is prefilled (read-only). They pick a password + confirm it
4. Submit → `supabase.auth.signUp()` creates the auth user
5. `handle_new_user` Postgres trigger fires, consumes the matching invite row, assigns role, links student/player record
6. Confirm-email is OFF in Supabase, so the signup returns a session immediately
7. Auto-redirect to `/dashboard`

### Returning user flow
1. Land on `/sign-in`
2. Enter email + password
3. Submit → `supabase.auth.signInWithPassword()` → session created
4. Redirect to dashboard (or `?next=...` if specified)

### Forgot password flow
1. `/sign-in` → click **Forgot password?** at the bottom
2. `/forgot-password` → enter email
3. `supabase.auth.resetPasswordForEmail()` sends recovery email via Resend SMTP
4. User receives "Reset your password" email from `MESA <noreply@mail.athletessuite.com>`
5. Click the link → goes to `/auth/callback?code=...&next=/reset-password`
6. `/auth/callback` exchanges code for session → redirects to `/reset-password`
7. User sets a new password → `supabase.auth.updateUser({ password })` → redirected to dashboard signed in

### Existing users (no password set)
Every existing user signed up via magic link, so they have NO password in `auth.users.encrypted_password`. When they next try to sign in:

1. They enter email + their old non-existent password → fails with "Invalid login credentials"
2. The UI surfaces a helpful message: "If this is your first time signing in with a password, use 'Forgot password?' below to set one."
3. They click **Forgot password?** → recovery email arrives → they set their first password
4. They're now in the password world for good

**Per Q3=A: this is the intended path.** No bulk session termination or special migration needed — the lack of a password is the natural force-reset mechanism.

---

## Files added/changed

### New
- `app/sign-up/page.tsx` — Suspense wrapper
- `app/sign-up/SignUpForm.tsx` — signup form with email + password + confirm; calls `supabase.auth.signUp`
- `app/forgot-password/page.tsx` — Suspense wrapper
- `app/forgot-password/ForgotPasswordForm.tsx` — email input → triggers reset email; always shows success state (no email enumeration)
- `app/reset-password/page.tsx` — Suspense wrapper
- `app/reset-password/ResetPasswordForm.tsx` — handles landing from reset email; sets new password; redirects to dashboard
- `PHASE-8B-README.md`

### Modified
- `app/sign-in/SignInForm.tsx` — removed magic-link tab; now password-only; added "Forgot password?" link; improved error message for invalid-credentials case
- `middleware.ts` — added `/sign-up`, `/forgot-password`, `/reset-password` to public allowlist; signed-in users on `/sign-up` or `/forgot-password` redirect to `/dashboard` (but `/reset-password` does NOT redirect, since signed-in users land there mid-reset)
- `lib/email/templates/invite.ts` — invite button now says "Set up your account" and points to `/sign-up?email=...` with the email prefilled

### Files to delete from GitHub: none

### Action count: 111 (unchanged)
No new server actions — auth flows all go through Supabase's client SDK directly.

---

## Routes overview

| Route | Public? | Signed-in redirect? | Purpose |
|---|---|---|---|
| `/sign-in` | ✓ | → `/dashboard` | Email + password sign-in |
| `/sign-up?email=...` | ✓ | → `/dashboard` | First-time signup with password set |
| `/forgot-password` | ✓ | → `/dashboard` | Request reset email |
| `/reset-password` | ✓ | (no redirect — needs session) | Set new password from reset link |
| `/auth/callback` | ✓ | (handles exchange) | Existing — exchanges code for session |

---

## Password rules

| Rule | Where enforced |
|---|---|
| 8+ characters | Supabase server-side (Authentication → Policies) + client-side validation |
| Includes a digit | Client-side validation only (Supabase doesn't natively support character class requirements) |

The client-side check fires before submitting to Supabase. If somehow bypassed, the user could create a password without a digit, but the next time they reset they'd be re-prompted. Worth noting as a minor enforcement gap — fully correct enforcement would require an Edge Function or auth hook.

---

## Auth email templates

Phase 8b uses Supabase's built-in email templates for password reset and any other auth emails, NOT a custom MESA template. Why:

- **Invite emails** (sent BY MESA when admin invites someone) go through MESA's `sendEmail` wrapper using the `buildInviteEmail` template. Fully branded.
- **Auth emails** (password reset, password changed notification, etc.) are sent by Supabase itself via SMTP. Branding comes from the "Sender name" you set in Supabase SMTP config (`MESA`) and the "Sender email" (`noreply@mail.athletessuite.com`).

The Supabase default email templates are minimal but functional. To customize them:

1. Supabase dashboard → Authentication → **Email Templates**
2. Edit the "Reset Password" template — change subject, body, styling
3. Save

This is optional. Default templates are fine for now; we can revisit if you want fully matching branding across both invite and password-reset emails.

---

## Deploy

### Step 1: Verify Supabase config

Before pushing code, confirm these are set in Supabase dashboard:

- Authentication → Providers → Email → **Confirm email** = OFF
- Authentication → Policies (or Providers → Email) → **Minimum password length** = 8
- Authentication → Emails → SMTP Settings → Custom SMTP enabled (Resend)

### Step 2: Push code via Claude Code

```bash
cd ~/Desktop/mesa-v2
claude
```

```
Unzip ~/Downloads/mesa-v2-phase-8b-clean.zip into the current directory,
overwriting existing files. Then run `git status`. Stop there.
```

Diff should include: 7 new files in `app/sign-up/`, `app/forgot-password/`, `app/reset-password/`; modified `app/sign-in/SignInForm.tsx`, `middleware.ts`, `lib/email/templates/invite.ts`; new README.

If clean:

```
Commit "Phase 8b: password authentication, replace magic link" and push.
```

### Step 3: Verify

**New user signup flow:**
1. As admin/director, send a fresh invite to `you+pwtest@gmail.com`
2. Check inbox — invite email arrives with "Set up your account" button
3. Click → lands on `/sign-up?email=you+pwtest@gmail.com` with email prefilled and locked
4. Pick a password ("password1" — meets 8 chars + digit) and confirm
5. Submit → should redirect to `/dashboard` signed in

**Returning user flow:**
1. Sign out
2. `/sign-in` → enter the same email + password
3. Should sign in and redirect to `/dashboard`

**Forgot password flow:**
1. Sign out
2. `/sign-in` → click **Forgot password?**
3. Enter the email → submit
4. Check inbox — recovery email arrives from `MESA <noreply@mail.athletessuite.com>` (not the Supabase default sender — confirms SMTP is routing through Resend)
5. Click the reset link → lands on `/reset-password`
6. Pick a new password → submit → redirects to `/dashboard`
7. Sign out, try the OLD password — should fail
8. Sign in with the NEW password — should succeed

**Existing user (no-password) flow:**
1. Sign out
2. `/sign-in` → try signing in as Justin Combs with any password
3. Fails with the helpful "first time signing in with a password" message
4. Click **Forgot password?** → enter `justin.combs@gltconsulting.io`
5. Recovery email arrives
6. Set a password → signed in
7. From now on, use email + password to sign in

---

## What's NOT in this phase

- **No 2FA / MFA.** Supabase supports it; we don't expose it. Future phase.
- **No social logins (Google, Apple).** Email + password only.
- **No "Remember me" toggle.** Supabase persists sessions for 1 hour by default, refreshed automatically while the user is active. Good enough for now.
- **No password strength meter.** UI shows min requirements as placeholder text; doesn't visualize strength dynamically.
- **No account deletion / data export.** Users can change their password but can't delete their account through the UI.
- **No email change flow.** If a user wants to change their email, they need an admin's help. Future phase.
- **No password history / rotation policy.** Users can keep the same password forever and re-use old ones. Industry guidance has moved away from forced rotation; we follow that.
- **No proactive "set your password" email** for existing users. Per Q3=A reasoning above, the natural flow handles this. If you want to send an explicit heads-up email to all existing users, you'd do it manually (suggested copy below).
- **No session termination on deploy.** Existing logged-in sessions remain valid until they expire. Per Q3=A reasoning, existing users only need to set a password the next time they're signed OUT and need to sign back in. If you want to force everyone out immediately, you can do this in Supabase dashboard → Authentication → Users → bulk action "Sign out all users" (or run SQL: `update auth.users set updated_at = now() where true;` and then revoke all refresh tokens — but easier to just do it through the UI).

---

## Suggested heads-up email for existing users

If you want to proactively notify the 5-15 existing users about the change rather than letting them discover it on next sign-in, here's draft copy you can send via Resend dashboard or any email client:

> Subject: MESA: password sign-in is now live
>
> Hi,
>
> We've simplified MESA sign-in. Going forward, you'll sign in with your
> email and a password instead of clicking a magic link every time.
>
> Since you signed up before this change, you don't have a password yet.
> To set one:
>
> 1. Go to https://mesa-v2-five.vercel.app/sign-in
> 2. Click "Forgot password?" at the bottom
> 3. Enter your email
> 4. You'll get a reset link — click it and pick a password
>
> That's it. Future sign-ins just need your email + the password you set.
>
> Questions? Reply to this email.
>
> — MESA

Send this from `justin.combs@gltconsulting.io` (or wherever) rather than the no-reply address, so replies actually reach you.

---

## Security notes

### Email enumeration prevention
The `/forgot-password` page ALWAYS shows the success state, even if the email doesn't exist in our system. This prevents attackers from probing valid email addresses.

### Session persistence
Supabase tokens are stored in cookies (HttpOnly when possible) and refresh automatically. Sessions persist across tabs and browser restarts unless the user explicitly signs out.

### Password reset link expiry
Reset links from `resetPasswordForEmail` expire after 1 hour. After that, the user has to request a new one.

### Brute-force protection
Supabase has built-in rate limiting on auth endpoints. After several failed sign-in attempts, the user is temporarily blocked. No additional CAPTCHA layer at this time — we can add `hCaptcha` later if needed.

### Cookie-based auth
Sessions are stored in cookies, which means:
- Sign-in persists across browser tabs ✓
- Sign-in does NOT persist across different browsers / devices (expected)
- Sign-out clears the cookie

---

## Cleanup item

Remove the `/api/test-email` diagnostic route from Phase 8a. Use Claude Code:

```
Delete the folder app/api/test-email/ entirely. Also remove the line
"pathname.startsWith('/api/test-email') ||" from middleware.ts.
Then run git status and stop there.
```

Then commit + push. Not urgent but cleaner to remove now.

---

## Suggested next steps

After this verifies in production:

- **Phase 8c: notification preferences UI.** Users can opt out of specific email types (Coach's Corner notifications, weekly digest, etc.). Becomes relevant once you ship more notification types.
- **Phase 8d: more notification types.** Workout released, goal assigned, Coach's Corner posted, practice scheduled. Each is small now that the email infrastructure exists.
- **2FA toggle for admins/directors.** Supabase supports TOTP-based MFA. Easy to add for high-privilege roles.
- **Account settings page.** Where a signed-in user can change their password, change their email (with verification), see active sessions. Currently no such page exists.
- **Email change flow.** Required if you want users to update their email without admin help. Supabase has `updateUser({ email })` which sends confirmation emails to both old and new addresses.
