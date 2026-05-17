// ============================================================================
// Weekly digest email template
//
// Phase 8c: renders a DigestContent object into HTML + plain text email.
// Visual language matches the invite email (ivory/ink/crimson, inline styles).
// ============================================================================

import type { DigestContent } from '@/lib/email/digest';

export interface DigestEmailParams {
  content: DigestContent;
  /** Public base URL for the dashboard link. */
  siteUrl: string;
  /** Per-user unsubscribe token. Built into the footer link. */
  unsubscribeToken: string;
}

/**
 * Build subject, HTML, and text body for a weekly digest email.
 */
export function buildDigestEmail(params: DigestEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { content, siteUrl, unsubscribeToken } = params;
  const baseUrl = siteUrl.replace(/\/+$/, '');
  const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const dashboardUrl = `${baseUrl}/dashboard`;

  const rangeLabel = `${_fmtDate(content.range_start)} \u2013 ${_fmtDate(content.range_end)}`;
  const upcomingLabel = `${_fmtDate(_addDays(content.range_end, 1))} \u2013 ${_fmtDate(content.upcoming_end)}`;
  const subject = `MESA weekly digest \u00b7 ${_fmtDate(content.range_end)}`;

  // ----- Plain text body -----
  const lines: string[] = [];
  lines.push(`Hi ${content.profile_name},`);
  lines.push('');
  lines.push(`Here's your MESA digest covering ${rangeLabel} and the week ahead.`);
  lines.push('');

  for (const a of content.athletes) {
    lines.push('=================================================');
    lines.push(a.student_name.toUpperCase());
    lines.push('=================================================');
    lines.push('');

    // ----- Past -----
    lines.push(`PAST WEEK (${rangeLabel}):`);
    const pastBits: string[] = [];

    if (a.past.workouts_logged.length > 0) {
      pastBits.push(`- Workouts logged (${a.past.workouts_logged.length}):`);
      for (const w of a.past.workouts_logged) {
        pastBits.push(`    ${_fmtDate(w.date)}${w.title ? ` \u2014 ${w.title}` : ''}`);
      }
    }

    if (a.past.practices_attended.length > 0) {
      pastBits.push(`- Practices attended (${a.past.practices_attended.length}):`);
      for (const p of a.past.practices_attended) {
        pastBits.push(`    ${_fmtDate(p.date)}${p.title ? ` \u2014 ${p.title}` : ''}`);
      }
    }

    if (a.past.games_reviewed.length > 0) {
      pastBits.push(`- Coach-reviewed games (${a.past.games_reviewed.length}):`);
      for (const g of a.past.games_reviewed) {
        const score = (g.our !== null && g.opp !== null) ? ` (${g.our}-${g.opp})` : '';
        pastBits.push(`    ${_fmtDate(g.date)} vs ${g.opponent ?? 'TBD'}${score}`);
      }
    }

    if (pastBits.length === 0) pastBits.push('  (quiet week)');
    lines.push(...pastBits);
    lines.push('');

    // ----- Upcoming -----
    lines.push(`COMING UP (${upcomingLabel}):`);
    const upBits: string[] = [];

    if (a.upcoming.practices.length > 0) {
      upBits.push(`- Practices:`);
      for (const p of a.upcoming.practices) {
        upBits.push(`    ${_fmtDate(p.date)}${p.time ? ` @ ${p.time}` : ''}${p.title ? ` \u2014 ${p.title}` : ''}`);
        for (const d of p.drills) {
          const dur = d.duration_minutes ? ` (${d.duration_minutes} min)` : '';
          upBits.push(`        \u2022 ${d.title}${dur}`);
        }
      }
    }

    if (a.upcoming.workouts_released.length > 0) {
      upBits.push(`- Workouts ready to log:`);
      for (const w of a.upcoming.workouts_released) {
        upBits.push(`    ${_fmtDate(w.date)}${w.title ? ` \u2014 ${w.title}` : ''}`);
      }
    }

    if (upBits.length === 0) upBits.push('  (nothing on the calendar)');
    lines.push(...upBits);
    lines.push('');
  }

  lines.push(`Open MESA: ${dashboardUrl}`);
  lines.push('');
  lines.push(`Unsubscribe from weekly digests: ${unsubscribeUrl}`);
  const text = lines.join('\n');

  // ----- HTML body -----
  const athleteHtml = content.athletes.map((a) => _renderAthleteHtml(a, rangeLabel, upcomingLabel)).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${_escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:#fafaf7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#0b1a2f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafaf7;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border:1px solid #e5e5dd; border-radius:8px;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 16px 40px; border-bottom:1px solid #e5e5dd;">
              <div style="font-family: Georgia, 'Times New Roman', serif; font-size:24px; font-weight:600; letter-spacing:-0.01em;">
                MESA
              </div>
              <div style="font-size:11px; color:#7a7a7a; text-transform:uppercase; letter-spacing:0.1em; margin-top:4px;">
                Weekly digest \u00b7 ${_escapeHtml(_fmtDate(content.range_end))}
              </div>
            </td>
          </tr>
          <!-- Greeting -->
          <tr>
            <td style="padding:24px 40px 0 40px;">
              <p style="margin:0 0 16px 0; font-size:15px; line-height:1.55; color:#0b1a2f;">
                Hi ${_escapeHtml(content.profile_name)}, here&rsquo;s your MESA digest for <strong>${_escapeHtml(rangeLabel)}</strong> and the week ahead.
              </p>
            </td>
          </tr>
          <!-- Athletes -->
          ${athleteHtml}
          <!-- CTA -->
          <tr>
            <td style="padding:8px 40px 32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                <tr>
                  <td style="background-color:#0b1a2f; border-radius:6px;">
                    <a href="${_escapeAttr(dashboardUrl)}" style="display:inline-block; padding:12px 24px; color:#ffffff; text-decoration:none; font-size:14px; font-weight:500;">
                      Open MESA
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px 40px; border-top:1px solid #e5e5dd; font-size:12px; line-height:1.55; color:#7a7a7a;">
              You received this because you have an account at MESA.
              <br>
              <a href="${_escapeAttr(unsubscribeUrl)}" style="color:#7a7a7a; text-decoration:underline;">Unsubscribe from weekly digests</a>
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

// ----------------------------------------------------------------------------
// HTML helpers
// ----------------------------------------------------------------------------

function _renderAthleteHtml(a: import('@/lib/email/digest').AthleteDigest, rangeLabel: string, upcomingLabel: string): string {
  const past = a.past;
  const up = a.upcoming;

  // ---- Past section items ----
  const pastItems: string[] = [];

  if (past.workouts_logged.length > 0) {
    const rows = past.workouts_logged.map((w) =>
      `<li>${_escapeHtml(_fmtDate(w.date))}${w.title ? ` \u2014 ${_escapeHtml(w.title)}` : ''}</li>`,
    ).join('');
    pastItems.push(
      `<li><strong>Workouts logged (${past.workouts_logged.length})</strong>` +
      `<ul style="margin:6px 0 0 0; padding-left:18px;">${rows}</ul></li>`,
    );
  }

  if (past.practices_attended.length > 0) {
    const rows = past.practices_attended.map((p) =>
      `<li>${_escapeHtml(_fmtDate(p.date))}${p.title ? ` \u2014 ${_escapeHtml(p.title)}` : ''}</li>`,
    ).join('');
    pastItems.push(
      `<li><strong>Practices attended (${past.practices_attended.length})</strong>` +
      `<ul style="margin:6px 0 0 0; padding-left:18px;">${rows}</ul></li>`,
    );
  }

  if (past.games_reviewed.length > 0) {
    const rows = past.games_reviewed.map((g) => {
      const score = (g.our !== null && g.opp !== null)
        ? ` <span style="color:#7a7a7a;">(${g.our}\u2013${g.opp})</span>`
        : '';
      return `<li>${_escapeHtml(_fmtDate(g.date))} vs ${_escapeHtml(g.opponent ?? 'TBD')}${score}</li>`;
    }).join('');
    pastItems.push(
      `<li><strong>Coach-reviewed games (${past.games_reviewed.length})</strong>` +
      `<ul style="margin:6px 0 0 0; padding-left:18px;">${rows}</ul></li>`,
    );
  }

  // ---- Upcoming section items ----
  const upItems: string[] = [];

  if (up.practices.length > 0) {
    const rows = up.practices.map((p) => {
      const header = `${_escapeHtml(_fmtDate(p.date))}${p.time ? ` @ ${_escapeHtml(p.time)}` : ''}${p.title ? ` \u2014 ${_escapeHtml(p.title)}` : ''}`;
      if (p.drills.length === 0) {
        return `<li>${header}</li>`;
      }
      const drillRows = p.drills.map((d) => {
        const dur = d.duration_minutes ? ` <span style="color:#7a7a7a;">(${d.duration_minutes} min)</span>` : '';
        return `<li>${_escapeHtml(d.title)}${dur}</li>`;
      }).join('');
      return `<li>${header}<ul style="margin:4px 0 0 0; padding-left:18px; font-size:13px; color:#5a5a5a;">${drillRows}</ul></li>`;
    }).join('');
    upItems.push(
      `<li><strong>Practices</strong><ul style="margin:6px 0 0 0; padding-left:18px;">${rows}</ul></li>`,
    );
  }

  if (up.workouts_released.length > 0) {
    const rows = up.workouts_released.map((w) =>
      `<li>${_escapeHtml(_fmtDate(w.date))}${w.title ? ` \u2014 ${_escapeHtml(w.title)}` : ''}</li>`,
    ).join('');
    upItems.push(
      `<li><strong>Workouts ready to log (${up.workouts_released.length})</strong>` +
      `<ul style="margin:6px 0 0 0; padding-left:18px;">${rows}</ul></li>`,
    );
  }

  return `
          <tr>
            <td style="padding:24px 40px 0 40px;">
              <h2 style="margin:0 0 12px 0; font-family: Georgia, 'Times New Roman', serif; font-size:20px; font-weight:600; color:#0b1a2f; border-bottom:1px solid #e5e5dd; padding-bottom:8px;">
                ${_escapeHtml(a.student_name)}
              </h2>
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.1em; color:#7a7a7a; margin-bottom:8px;">
                Past week \u00b7 ${_escapeHtml(rangeLabel)}
              </div>
              ${pastItems.length === 0
                ? '<p style="margin:0 0 16px 0; font-size:13px; color:#7a7a7a; font-style:italic;">Quiet week.</p>'
                : `<ul style="margin:0 0 16px 0; padding-left:20px; font-size:14px; line-height:1.6; color:#0b1a2f;">${pastItems.join('')}</ul>`
              }
              <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.1em; color:#7a7a7a; margin-bottom:8px;">
                Coming up \u00b7 ${_escapeHtml(upcomingLabel)}
              </div>
              ${upItems.length === 0
                ? '<p style="margin:0 0 8px 0; font-size:13px; color:#7a7a7a; font-style:italic;">Nothing on the calendar.</p>'
                : `<ul style="margin:0 0 8px 0; padding-left:20px; font-size:14px; line-height:1.6; color:#0b1a2f;">${upItems.join('')}</ul>`
              }
            </td>
          </tr>`;
}

function _fmtDate(d: string): string {
  // d is YYYY-MM-DD. Format as "Mon, May 16".
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
}

function _addDays(d: string, n: number): string {
  const dt = new Date(d + 'T00:00:00');
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

function _escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _escapeAttr(s: string): string {
  return _escapeHtml(s);
}
