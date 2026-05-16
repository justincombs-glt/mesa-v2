// ============================================================================
// Invite email template
//
// Phase 8a: rendered HTML + plain-text version of the email an invitee
// receives. The HTML uses inline styles since email clients (especially
// Gmail/Outlook) strip <style> tags and don't load external CSS. Inline-
// styled HTML is the lowest-common-denominator approach that renders
// consistently across clients.
//
// We send both `html` and `text`. Email clients pick whichever they prefer;
// providing both also improves spam scores.
// ============================================================================

import type { AppRole } from '@/lib/supabase/types';

export interface InviteEmailParams {
  /** Recipient's email — used only inside the body, not the To field. */
  toEmail: string;
  /** Role they're being invited as. Title-cased in the body. */
  role: AppRole;
  /** Display name of the staff member who issued the invite. */
  invitedByName: string;
  /** Public base URL of the deployed app, e.g. https://mesa-v2-five.vercel.app */
  siteUrl: string;
  /** Optional short note set by the inviter. */
  note?: string | null;
}

/**
 * Build the subject, HTML body, and plain-text body for an invite email.
 */
export function buildInviteEmail(params: InviteEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { toEmail, role, invitedByName, siteUrl, note } = params;

  // Title-case the role for display (e.g. 'player' -> 'Player')
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  // Strip trailing slash if present so URL building is predictable
  const baseUrl = siteUrl.replace(/\/+$/, '');
  // Phase 8b: invite recipients land on /sign-up where they set their initial
  // password. Email is prefilled via the query param so they can't accidentally
  // type a different address than the one the invite was issued to.
  const signUpUrl = `${baseUrl}/sign-up?email=${encodeURIComponent(toEmail)}`;

  const subject = `You\u2019ve been invited to MESA`;

  // ----- Plain text version -----
  const textLines = [
    `Hi,`,
    ``,
    `${invitedByName} has invited you to join MESA as a ${roleLabel}.`,
    ``,
    `To accept, set up your account at:`,
    `${signUpUrl}`,
    ``,
    `You\u2019ll pick a password on the next screen, then you\u2019re in.`,
  ];
  if (note) {
    textLines.push('', `Note from ${invitedByName}: ${note}`);
  }
  textLines.push(
    ``,
    `If you weren\u2019t expecting this, you can safely ignore this email.`,
    ``,
    `\u2014 MESA`,
  );
  const text = textLines.join('\n');

  // ----- HTML version (inline styles only) -----
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:#fafaf7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#0b1a2f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafaf7;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background-color:#ffffff; border:1px solid #e5e5dd; border-radius:8px;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 16px 40px; border-bottom:1px solid #e5e5dd;">
              <div style="font-family: Georgia, 'Times New Roman', serif; font-size:24px; font-weight:600; letter-spacing:-0.01em;">
                MESA
              </div>
              <div style="font-size:11px; color:#7a7a7a; text-transform:uppercase; letter-spacing:0.1em; margin-top:4px;">
                Academy training platform
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 16px 0; font-family: Georgia, 'Times New Roman', serif; font-size:24px; font-weight:600; line-height:1.3; color:#0b1a2f;">
                You\u2019ve been invited.
              </h1>
              <p style="margin:0 0 16px 0; font-size:15px; line-height:1.55; color:#0b1a2f;">
                <strong style="color:#0b1a2f;">${escapeHtml(invitedByName)}</strong> invited you to join MESA as a <strong style="color:#d4342f;">${escapeHtml(roleLabel)}</strong>.
              </p>
              <p style="margin:0 0 24px 0; font-size:15px; line-height:1.55; color:#0b1a2f;">
                Click below to set up your account. You\u2019ll use this email to sign in:
              </p>
              <p style="margin:0 0 24px 0; font-size:14px; color:#5a5a5a; background-color:#fafaf7; padding:12px 16px; border-radius:6px; font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;">
                ${escapeHtml(toEmail)}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:#0b1a2f; border-radius:6px;">
                    <a href="${escapeAttr(signUpUrl)}" style="display:inline-block; padding:14px 28px; color:#ffffff; text-decoration:none; font-size:15px; font-weight:500;">
                      Set up your account
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px 0; font-size:13px; line-height:1.55; color:#5a5a5a;">
                You\u2019ll pick a password on the next screen. Takes about 30 seconds.
              </p>
              ${note ? `<div style="margin:24px 0 0 0; padding:16px; background-color:#fafaf7; border-left:3px solid #7a9b7e; border-radius:4px;">
                <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.1em; color:#7a7a7a; margin-bottom:6px;">Note from ${escapeHtml(invitedByName)}</div>
                <div style="font-size:14px; line-height:1.55; color:#0b1a2f;">${escapeHtml(note)}</div>
              </div>` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px 40px; border-top:1px solid #e5e5dd; font-size:12px; line-height:1.55; color:#7a7a7a;">
              If you weren\u2019t expecting this invitation, you can safely ignore this email. Your address won\u2019t be used for anything else.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Escape user-provided text for safe insertion into HTML body.
 * Email clients are forgiving of HTML errors but injecting an inviter's
 * note containing a literal `<` could break rendering or worse.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape values being placed inside an HTML attribute (href, etc.).
 * Same set as escapeHtml — separate function name for clarity at call sites.
 */
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
