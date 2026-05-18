// ============================================================================
// Device connection storage helpers
//
// Phase 9a: thin wrapper over the user_device_connections table. Encrypts
// tokens before writing, decrypts on read. Callers should not touch the
// raw DB rows directly.
// ============================================================================

import { encryptToken, decryptToken } from '@/lib/devices/encryption';

type Provider = 'google_health' | 'whoop';
type ConnectionStatus = 'connected' | 'reconnect_needed' | 'revoked';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

export interface DeviceConnection {
  id: string;
  profile_id: string;
  provider: Provider;
  external_user_id: string | null;
  /** Decrypted; safe to use in API calls. */
  access_token: string;
  /** Decrypted; safe to use to refresh. */
  refresh_token: string;
  expires_at: Date | null;
  scopes: string[];
  connected_at: Date;
  last_refresh_at: Date | null;
  status: ConnectionStatus;
}

/**
 * Look up the connection for one user + provider. Returns null if not
 * connected. Tokens in the returned object are decrypted.
 */
export async function getConnection(
  supabase: AnySupabaseClient,
  profileId: string,
  provider: Provider,
): Promise<DeviceConnection | null> {
  const { data, error } = await supabase
    .from('user_device_connections')
    .select('*')
    .eq('profile_id', profileId)
    .eq('provider', provider)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    profile_id: string;
    provider: Provider;
    external_user_id: string | null;
    access_token_encrypted: string | null;
    refresh_token_encrypted: string | null;
    expires_at: string | null;
    scopes: string[];
    connected_at: string;
    last_refresh_at: string | null;
    status: ConnectionStatus;
  };
  let access = '';
  let refresh = '';
  try {
    access = row.access_token_encrypted ? decryptToken(row.access_token_encrypted) : '';
    refresh = row.refresh_token_encrypted ? decryptToken(row.refresh_token_encrypted) : '';
  } catch {
    // Decryption failure: the row exists but we can't recover the tokens.
    // Return a row with empty tokens; callers handle as 'reconnect_needed'.
  }
  return {
    id: row.id,
    profile_id: row.profile_id,
    provider: row.provider,
    external_user_id: row.external_user_id,
    access_token: access,
    refresh_token: refresh,
    expires_at: row.expires_at ? new Date(row.expires_at) : null,
    scopes: row.scopes ?? [],
    connected_at: new Date(row.connected_at),
    last_refresh_at: row.last_refresh_at ? new Date(row.last_refresh_at) : null,
    status: row.status,
  };
}

/**
 * Insert or update a connection for one user + provider. Encrypts tokens
 * before storing. Idempotent (upserts by composite unique key).
 */
export async function saveConnection(
  supabase: AnySupabaseClient,
  params: {
    profile_id: string;
    provider: Provider;
    external_user_id?: string | null;
    access_token: string;
    refresh_token: string;
    expires_at: Date;
    scopes: string[];
  },
): Promise<{ ok: boolean; error?: string }> {
  let access_encrypted = '';
  let refresh_encrypted = '';
  try {
    access_encrypted = encryptToken(params.access_token);
    refresh_encrypted = encryptToken(params.refresh_token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `token encryption failed: ${msg}` };
  }

  const { error } = await supabase
    .from('user_device_connections')
    .upsert(
      {
        profile_id: params.profile_id,
        provider: params.provider,
        external_user_id: params.external_user_id ?? null,
        access_token_encrypted: access_encrypted,
        refresh_token_encrypted: refresh_encrypted,
        expires_at: params.expires_at.toISOString(),
        scopes: params.scopes,
        status: 'connected',
        last_refresh_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,provider' },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Mark a connection as needing reconnect (e.g. refresh token rejected).
 * Does NOT delete the row — preserves the external_user_id for context.
 */
export async function markReconnectNeeded(
  supabase: AnySupabaseClient,
  profileId: string,
  provider: Provider,
): Promise<void> {
  await supabase
    .from('user_device_connections')
    .update({ status: 'reconnect_needed' })
    .eq('profile_id', profileId)
    .eq('provider', provider);
}

/**
 * Delete the connection row entirely. Caller is responsible for revoking
 * the token at the provider side first (best-effort).
 */
export async function deleteConnection(
  supabase: AnySupabaseClient,
  profileId: string,
  provider: Provider,
): Promise<void> {
  await supabase
    .from('user_device_connections')
    .delete()
    .eq('profile_id', profileId)
    .eq('provider', provider);
}
