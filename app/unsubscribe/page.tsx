// ============================================================================
// One-click unsubscribe (per Q10 = A)
//
// GET /unsubscribe?token=<unsubscribe_token>
//
// Renders a confirmation page that has already disabled the digest. Idempotent.
// No sign-in required — the token in the URL is the auth.
//
// The token is per-user, random 32-char hex from notification_settings.
// Worst-case impact of a leaked token: a third party can disable one user's
// digest. Low blast radius; acceptable tradeoff for one-click UX.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { token?: string };
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const token = (searchParams.token ?? '').trim();
  let result: 'ok' | 'invalid' | 'error' = 'invalid';
  let userEmail: string | null = null;

  if (token) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      // Find row by token
      const { data: row } = await supabase
        .from('notification_settings')
        .select('profile_id')
        .eq('unsubscribe_token', token)
        .maybeSingle();

      if (row) {
        const profileId = (row as { profile_id: string }).profile_id;
        // Set digest_enabled = false (idempotent)
        const { error } = await supabase
          .from('notification_settings')
          .update({ digest_enabled: false, updated_at: new Date().toISOString() })
          .eq('profile_id', profileId);
        if (!error) {
          // Resolve email for confirmation
          const { data: profRow } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', profileId)
            .maybeSingle();
          userEmail = (profRow as { email: string } | null)?.email ?? null;
          result = 'ok';
        } else {
          result = 'error';
        }
      } else {
        result = 'invalid';
      }
    } else {
      result = 'error';
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-5 py-10 bg-ivory">
      <div className="w-full max-w-[440px] bg-paper border border-ink-hair rounded-2xl p-8 md:p-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-ink grid place-items-center">
            <span className="font-serif italic text-paper text-lg">M</span>
          </div>
          <div>
            <div className="font-serif text-xl text-ink leading-none">MESA</div>
            <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-faint mt-1">
              Email preferences
            </div>
          </div>
        </div>

        {result === 'ok' && (
          <>
            <h1 className="font-serif text-2xl text-ink mb-2">Unsubscribed.</h1>
            <p className="text-sm text-ink-dim mb-6">
              {userEmail
                ? <>We won&rsquo;t send weekly digest emails to <strong>{userEmail}</strong> anymore.</>
                : <>We won&rsquo;t send you weekly digest emails anymore.</>}
            </p>
            <p className="text-xs text-ink-faint leading-relaxed">
              You&rsquo;ll still receive transactional emails: invite confirmations, password resets, and account-related messages.
            </p>
          </>
        )}

        {result === 'invalid' && (
          <>
            <h1 className="font-serif text-2xl text-ink mb-2">Link expired or invalid.</h1>
            <p className="text-sm text-ink-dim mb-6">
              We couldn&rsquo;t find this unsubscribe link. It may have been used already, or the link may have been altered.
            </p>
            <p className="text-xs text-ink-faint leading-relaxed">
              If you want to disable digest emails, sign in to MESA and visit your settings, or reply to any digest email and ask us to unsubscribe you.
            </p>
          </>
        )}

        {result === 'error' && (
          <>
            <h1 className="font-serif text-2xl text-ink mb-2">Something went wrong.</h1>
            <p className="text-sm text-ink-dim mb-6">
              We couldn&rsquo;t process your unsubscribe request right now. Please try again later, or reply to any digest email and ask us to unsubscribe you.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
