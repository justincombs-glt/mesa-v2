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

    // Past
    lines.push(`PAST WEEK (${rangeLabel}):`);
    const pastBits: string[] = [];
    if (a.past.workouts_logged > 0) pastBits.push(`- ${a.past.workouts_logged} workout${a.past.workouts_logged === 1 ? '' : 's'} logged`);
    if (a.past.practices_attended > 0) pastBits.push(`- ${a.past.practices_attended} practice${a.past.practices_attended === 1 ? '' : 's'} on the schedule`);
    if (a.past.games_played.length > 0) {
      pastBits.push(`- ${a.past.games_played.length} game${a.past.games_played.length === 1 ? '' : 's'}:`);
      for (const g of a.past.games_played) {
        const score = (g.our !== null && g.opp !== null) ? ` (${g.our}-${g.opp})` : '';
        pastBits.push(`    ${_fmtDate(g.date)} vs ${g.opponent ?? 'TBD'}${score}`);
      }
    }
    if (a.past.goal_updates.length > 0) {
      pastBits.push(`- ${a.past.goal_updates.length} goal update${a.past.goal_updates.length === 1 ? '' : 's'}`);
    }
    if (a.past.apa_results_count > 0) pastBits.push(`- ${a.past.apa_results_count} APA result${a.past.apa_results_count === 1 ? '' : 's'} recorded`);
    if (a.past.game_review_notes_count > 0) pastBits.push(`- Coach added review notes on ${a.past.game_review_notes_count} game${a.past.game_review_notes_count === 1 ? '' : 's'}`);
    if (pastBits.length === 0) pastBits.push('  (quiet week)');
    lines.push(...pastBits);
    lines.push('');

    // Upcoming
    lines.push(`COMING UP (${upcomingLabel}):`);
    const upBits: string[] = [];
    if (a.upcoming.practices.length > 0) {
      upBits.push(`- Practices:`);
      for (const p of a.upcoming.practices) {
        upBits.push(`    ${_fmtDate(p.date)}${p.time ? ` @ ${p.time}` : ''}${p.title ? ` \u2014 ${p.title}` : ''}`);
      }
    }
    if (a.upcoming.games.length > 0) {
      upBits.push(`- Games:`);
      for (const g of a.upcoming.games) {
        upBits.push(`    ${_fmtDate(g.date)} ${g.home_away ? `(${g.home_away})` : ''} vs ${g.opponent ?? 'TBD'}`);
      }
    }
    if (a.upcoming.workouts_released.length > 0) {
      upBits.push(`- Workouts ready to log: ${a.upcoming.workouts_released.length}`);
    }
    if (a.upcoming.active_goals.length > 0) {
      upBits.push(`- Active goals: ${a.upcoming.active_goals.map((g) => g.title).join('; ')}`);
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

  const pastItems: string[] = [];
  if (past.workouts_logged > 0) pastItems.push(`<li><strong>${past.workouts_logged}</strong> workout${past.workouts_logged === 1 ? '' : 's'} logged</li>`);
  if (past.practices_attended > 0) pastItems.push(`<li><strong>${past.practices_attended}</strong> practice${past.practices_attended === 1 ? '' : 's'} on the schedule</li>`);
  if (past.games_played.length > 0) {
    const gameRows = past.games_played.map((g) => {
      const score = (g.our !== null && g.opp !== null) ? ` <span style="color:#7a7a7a;">(${g.our}\u2013${g.opp})</span>` : '';
      return `<li>${_escapeHtml(_fmtDate(g.date))} vs ${_escapeHtml(g.opponent ?? 'TBD')}${score}</li>`;
    }).join('');
    pastItems.push(`<li><strong>${past.games_played.length}</strong> game${past.games_played.length === 1 ? '' : 's'}<ul style="margin:6px 0 0 0; padding-left:18px;">${gameRows}</ul></li>`);
  }
  if (past.goal_updates.length > 0) pastItems.push(`<li>${past.goal_updates.length} goal update${past.goal_updates.length === 1 ? '' : 's'}</li>`);
  if (past.apa_results_count > 0) pastItems.push(`<li>${past.apa_results_count} APA result${past.apa_results_count === 1 ? '' : 's'} recorded</li>`);
  if (past.game_review_notes_count > 0) pastItems.push(`<li>Coach added review notes on ${past.game_review_notes_count} game${past.game_review_notes_count === 1 ? '' : 's'}</li>`);

  const upItems: string[] = [];
  if (up.practices.length > 0) {
    const rows = up.practices.map((p) =>
      `<li>${_escapeHtml(_fmtDate(p.date))}${p.time ? ` @ ${_escapeHtml(p.time)}` : ''}${p.title ? ` \u2014 ${_escapeHtml(p.title)}` : ''}</li>`,
    ).join('');
    upItems.push(`<li>Practices<ul style="margin:6px 0 0 0; padding-left:18px;">${rows}</ul></li>`);
  }
  if (up.games.length > 0) {
    const rows = up.games.map((g) =>
      `<li>${_escapeHtml(_fmtDate(g.date))} ${g.home_away ? `(${g.home_away})` : ''} vs ${_escapeHtml(g.opponent ?? 'TBD')}</li>`,
    ).join('');
    upItems.push(`<li>Games<ul style="margin:6px 0 0 0; padding-left:18px;">${rows}</ul></li>`);
  }
  if (up.workouts_released.length > 0) {
    upItems.push(`<li><strong>${up.workouts_released.length}</strong> workout${up.workouts_released.length === 1 ? '' : 's'} ready to log</li>`);
  }
  if (up.active_goals.length > 0) {
    upItems.push(`<li>Active goals: ${up.active_goals.map((g) => _escapeHtml(g.title)).join(', ')}</li>`);
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
