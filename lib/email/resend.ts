// ============================================================================
// Resend email client wrapper
//
// Phase 8a: thin wrapper around the Resend SDK so the rest of the app doesn't
// care about provider details.
//
// Design contract:
//   - Never throws. If sending fails or the env vars aren't set, we LOG
//     and return false. Callers continue normally. This means:
//       * In local dev without keys configured, the app still works — emails
//         just silently no-op.
//       * In production, a Resend outage doesn't break user-facing flows
//         like creating an invite. The invite row still gets created;
//         the email just doesn't fire.
//   - Caller decides what to do on failure (typically: log and move on).
//   - Single sendEmail() entry point; template files build the payload.
//
// Env vars required for actual sending:
//   RESEND_API_KEY      — secret API key from resend.com/api-keys
//   RESEND_FROM_EMAIL   — formatted "from" string, e.g.
//                          'MESA <noreply@mail.athletessuite.com>'
//
// If either is missing, sendEmail() logs once per call and returns false.
// ============================================================================

import { Resend } from 'resend';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Optional Reply-To. For invite emails we don't set this — invitees
   * shouldn't reply. For future notification types (game scheduled, goal
   * assigned, etc.) we'll set this to a real human inbox.
   */
  replyTo?: string;
}

/**
 * Send a single email via Resend. Returns true on success, false on any
 * failure (missing env, API error, network blip, etc.). Never throws.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    // Silent in dev. In prod this means an env var got missed during deploy.
    console.warn(
      '[email] RESEND_API_KEY or RESEND_FROM_EMAIL not set — skipping send',
      { to_redacted: params.to.replace(/(?<=^.).+(?=@)/, '***') }
    );
    return false;
  }

  try {
    const client = new Resend(apiKey);
    const result = await client.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    });

    if (result.error) {
      console.error('[email] Resend API returned error', {
        to_redacted: params.to.replace(/(?<=^.).+(?=@)/, '***'),
        error: result.error,
      });
      return false;
    }

    return true;
  } catch (err) {
    console.error('[email] sendEmail threw', {
      to_redacted: params.to.replace(/(?<=^.).+(?=@)/, '***'),
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
