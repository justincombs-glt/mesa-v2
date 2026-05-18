// ============================================================================
// GET /api/oauth/google-health/callback
//
// Phase 9a: Google redirects the user here after they consent (or deny).
//   1. Verify state cookie matches state query param (CSRF check)
//   2. Look up PKCE verifier from cookie
//   3. Exchange the one-time `code` for access + refresh tokens
//   4. Store encrypted tokens in user_device_connections
//   5. Redirect user back to /dashboard/settings with success/error indicator
//
// User must already be signed in at MESA — middleware enforces this for
// /dashboard/settings, but Google's flow doesn't carry our session forward
// directly. The user's browser still has our session cookie when it lands
// back here.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens } from '@/lib/oauth/google-health';
import { saveConnection } from '@/lib/devices/connection';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  // Helper to bounce back to settings with a status flag in the URL
  const back = (status: string, msg?: string): NextResponse => {
    const u = new URL('/dashboard/settings', _siteUrl());
    u.searchParams.set('devices_status', status);
    if (msg) u.searchParams.set('devices_msg', msg);
    const res = NextResponse.redirect(u);
    res.cookies.delete('gh_oauth_verifier');
    res.cookies.delete('gh_oauth_state');
    return res;
  };

  // User denied consent or Google itself errored
  if (errorParam) {
    return back('error', errorDesc || errorParam);
  }
  if (!code || !stateParam) {
    return back('error', 'Missing code or state from Google');
  }

  // Auth check — must be signed in to connect a device
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.redirect(
      new URL('/sign-in?next=/dashboard/settings', _siteUrl()),
    );
  }

  // CSRF check: state cookie must match state query param
  const stateCookie = req.cookies.get('gh_oauth_state')?.value;
  if (!stateCookie || stateCookie !== stateParam) {
    return back('error', 'State mismatch (CSRF check failed)');
  }

  // PKCE verifier from cookie
  const verifier = req.cookies.get('gh_oauth_verifier')?.value;
  if (!verifier) {
    return back('error', 'Missing PKCE verifier (session expired?)');
  }

  // Exchange code for tokens
  let tokens;
  try {
    tokens = await exchangeCodeForTokens({ code, codeVerifier: verifier });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return back('error', `Token exchange: ${msg}`);
  }

  if (!tokens.refresh_token) {
    // Google sometimes omits refresh_token if the user has already granted
    // access to this app before. The `prompt=consent` in buildAuthorizeUrl
    // should force a fresh refresh token; if we still don't have one,
    // something's off.
    return back('error', 'No refresh token returned by Google');
  }

  // Store the connection
  const saveResult = await saveConnection(supabase, {
    profile_id: userData.user.id,
    provider: 'google_health',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at,
    scopes: tokens.scopes,
  });
  if (!saveResult.ok) {
    return back('error', saveResult.error || 'Failed to save connection');
  }

  return back('connected');
}

function _siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
