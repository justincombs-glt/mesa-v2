// ============================================================================
// POST /api/oauth/google-health/disconnect
//
// Phase 9a: user-initiated disconnect.
//   1. Look up the user's current connection
//   2. Best-effort revoke the access token at Google (so they can re-consent
//      cleanly if they reconnect later)
//   3. Delete the local DB row
//   4. Redirect back to /dashboard/settings
// ============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revokeToken } from '@/lib/oauth/google-health';
import { getConnection, deleteConnection } from '@/lib/devices/connection';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.redirect(
      new URL('/sign-in?next=/dashboard/settings', _siteUrl()),
    );
  }

  const connection = await getConnection(supabase, userData.user.id, 'google_health');
  if (connection?.access_token) {
    // Fire-and-forget revoke; we don't want a Google API hiccup to block
    // the user's disconnect intent
    await revokeToken(connection.access_token);
  }
  await deleteConnection(supabase, userData.user.id, 'google_health');

  const u = new URL('/dashboard/settings', _siteUrl());
  u.searchParams.set('devices_status', 'disconnected');
  return NextResponse.redirect(u);
}

function _siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
