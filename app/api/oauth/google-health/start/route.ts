// ============================================================================
// GET /api/oauth/google-health/start
//
// Phase 9a: initiates the OAuth flow.
//   1. Authenticated user clicks "Connect Google Health" in settings
//   2. We generate PKCE verifier + state, stash them in cookies
//   3. We build Google's authorize URL and 302 redirect
//   4. Google sends them back to /api/oauth/google-health/callback with `code`
//
// Cookies are httpOnly, secure, and short-lived (10 min) — they only need to
// survive the round-trip to Google's consent page.
// ============================================================================

import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { buildAuthorizeUrl } from '@/lib/oauth/google-health';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Auth check — user must be signed in to connect a device
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.redirect(
      new URL('/sign-in?next=/dashboard/settings', _siteUrl()),
    );
  }

  // PKCE verifier: random 32-byte string, base64url-encoded
  const verifier = _base64Url(randomBytes(32));
  // PKCE challenge: SHA-256 of verifier, base64url-encoded
  const challenge = _base64Url(createHash('sha256').update(verifier).digest());
  // State: CSRF protection, random hex
  const state = randomBytes(16).toString('hex');

  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl({ state, codeChallenge: challenge });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(`/dashboard/settings?devices_error=${encodeURIComponent(msg)}`, _siteUrl()),
    );
  }

  const res = NextResponse.redirect(authorizeUrl);
  // Cookies survive only the OAuth round-trip
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600,  // 10 minutes
  };
  res.cookies.set('gh_oauth_verifier', verifier, cookieOpts);
  res.cookies.set('gh_oauth_state', state, cookieOpts);
  return res;
}

function _siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function _base64Url(buf: Buffer): string {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
