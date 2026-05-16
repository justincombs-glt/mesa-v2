// ============================================================================
// Diagnostic route: GET /api/test-email
//
// Phase 8a debugging only. Hit this URL once to verify:
//   1. Phase 8a code is actually deployed (route exists, returns JSON)
//   2. RESEND_API_KEY env var is set
//   3. RESEND_FROM_EMAIL env var is set
//   4. The Resend SDK can actually authenticate with the given key
//   5. What the from email is parsed as
//
// Returns JSON describing what it found. Does NOT send a real email by
// default. To actually send a test email, pass ?to=your@email.com in the query string.
//
// SECURITY: This route is read-only diagnostic info, but it does expose
// whether env vars are set (boolean only, not values). Once Phase 8a is
// verified working, delete this file.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const to = url.searchParams.get('to');

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl = process.env.VERCEL_URL;

  const env = {
    RESEND_API_KEY_set: !!apiKey,
    RESEND_API_KEY_prefix: apiKey ? apiKey.slice(0, 3) + '...' : null,
    RESEND_API_KEY_length: apiKey ? apiKey.length : 0,
    RESEND_FROM_EMAIL_set: !!from,
    RESEND_FROM_EMAIL_value: from || null,
    NEXT_PUBLIC_SITE_URL_set: !!siteUrl,
    NEXT_PUBLIC_SITE_URL_value: siteUrl || null,
    VERCEL_URL_set: !!vercelUrl,
    VERCEL_URL_value: vercelUrl || null,
  };

  // If no ?to=, just return env diagnostic info
  if (!to) {
    return NextResponse.json({
      phase: '8a-diagnostic',
      message: 'Phase 8a code is deployed. To send a test email, add ?to=your@email.com to the URL.',
      env,
    });
  }

  // Send a real test email and return the result
  const sent = await sendEmail({
    to,
    subject: 'MESA Phase 8a diagnostic test',
    text: 'This is a test email from the diagnostic route. If you received this, Resend is working correctly. You can now delete the app/api/test-email/ folder.',
    html: '<p>This is a test email from the diagnostic route. If you received this, <strong>Resend is working correctly</strong>.</p><p>You can now delete the <code>app/api/test-email/</code> folder.</p>',
  });

  return NextResponse.json({
    phase: '8a-diagnostic',
    env,
    sendResult: sent,
    message: sent
      ? `Email send returned true. Check ${to} inbox (and spam folder).`
      : 'Email send returned false. Check Vercel runtime logs for the [email] line with details.',
  });
}
