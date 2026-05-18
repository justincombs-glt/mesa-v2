// ============================================================================
// Google Health API OAuth 2.0 client
//
// Phase 9a: implements the OAuth Authorization Code flow with PKCE for the
// Google Health API. Used to obtain access + refresh tokens, refresh expired
// access tokens, and revoke tokens on disconnect.
//
// Why no SDK: the standard OAuth flow is small (3 HTTP calls). Adding
// `google-auth-library` would pull in 30+ transitive deps for ~50 lines of
// our own code. Direct fetch is clearer here.
//
// Environment variables required:
//   GOOGLE_HEALTH_CLIENT_ID     - OAuth client ID from Google Cloud Console
//   GOOGLE_HEALTH_CLIENT_SECRET - OAuth client secret
//   NEXT_PUBLIC_SITE_URL        - canonical site URL (for redirect URI)
//
// Scopes requested:
//   - googlehealth.activity_and_fitness.readonly  (HR + activity data)
//   - googlehealth.profile.readonly                (user identity)
// ============================================================================

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.profile.readonly',
];

export interface GoogleHealthTokenResult {
  access_token: string;
  refresh_token?: string;
  expires_at: Date;
  scopes: string[];
}

function _redirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('NEXT_PUBLIC_SITE_URL is not set');
  return `${base}/api/oauth/google-health/callback`;
}

function _clientId(): string {
  const v = process.env.GOOGLE_HEALTH_CLIENT_ID;
  if (!v) throw new Error('GOOGLE_HEALTH_CLIENT_ID is not set');
  return v;
}

function _clientSecret(): string {
  const v = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
  if (!v) throw new Error('GOOGLE_HEALTH_CLIENT_SECRET is not set');
  return v;
}

/**
 * Build the authorization URL the user is redirected to. State and PKCE
 * verifier are required by spec; state also protects our return route from
 * arbitrary callbacks.
 */
export function buildAuthorizeUrl(params: {
  state: string;
  codeChallenge: string;
}): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set('client_id', _clientId());
  u.searchParams.set('redirect_uri', _redirectUri());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', SCOPES.join(' '));
  // 'offline' is required to get a refresh token; 'consent' forces re-consent
  // which guarantees a refresh token (Google omits it on re-grants otherwise)
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('include_granted_scopes', 'true');
  u.searchParams.set('state', params.state);
  u.searchParams.set('code_challenge', params.codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

/**
 * Exchange the one-time `code` returned by Google for access + refresh tokens.
 */
export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
}): Promise<GoogleHealthTokenResult> {
  const body = new URLSearchParams({
    client_id: _clientId(),
    client_secret: _clientSecret(),
    code: params.code,
    code_verifier: params.codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: _redirectUri(),
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  const json = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: new Date(Date.now() + json.expires_in * 1000),
    scopes: (json.scope || '').split(' ').filter(Boolean),
  };
}

/**
 * Use a refresh token to get a fresh access token. Refresh tokens themselves
 * usually don't rotate, but the response may include a new one; we save it
 * if so.
 */
export async function refreshAccessToken(params: {
  refreshToken: string;
}): Promise<GoogleHealthTokenResult> {
  const body = new URLSearchParams({
    client_id: _clientId(),
    client_secret: _clientSecret(),
    refresh_token: params.refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  const json = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? params.refreshToken,
    expires_at: new Date(Date.now() + json.expires_in * 1000),
    scopes: (json.scope || '').split(' ').filter(Boolean),
  };
}

/**
 * Revoke a token at Google. Called on disconnect. Best-effort: if Google
 * returns an error we still proceed to delete the local DB row.
 */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const body = new URLSearchParams({ token });
    const res = await fetch(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Convenience: list of scopes we request (used for display in UI).
 */
export function getRequestedScopes(): string[] {
  return [...SCOPES];
}
