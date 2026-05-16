'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 8b: reset-password landing page (clicked from password recovery email).
 *
 * Flow:
 *   1. User clicks "Reset password" link in their email
 *   2. Supabase Auth verifies the code and creates a session for them
 *      (via /auth/callback route which already exchanges code for session)
 *   3. /auth/callback redirects here with the session active
 *   4. They set a new password via supabase.auth.updateUser
 *   5. They're redirected to /dashboard signed in
 *
 * Edge case: if they arrive here without a session (link expired, opened
 * in different browser, etc.), we show a fallback that prompts them to
 * request a fresh reset link.
 */
export function ResetPasswordForm() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // On mount, confirm we have an active session. If not, redirect to /forgot-password.
  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      setAuthed(!!data.session);
    };
    check();
  }, []);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Password must be at least 8 characters.';
    if (!/\d/.test(pwd)) return 'Password must include at least one number.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg(null);

    if (password !== confirm) {
      setStatus('error');
      setErrorMsg("Passwords don't match.");
      return;
    }
    const pwErr = validatePassword(password);
    if (pwErr) {
      setStatus('error');
      setErrorMsg(pwErr);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
      return;
    }
    setStatus('success');
    // Brief pause so user sees confirmation, then redirect.
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1200);
  };

  return (
    <main className="min-h-screen grid place-items-center px-5 py-10">
      <div className="w-full max-w-[440px]">
        <Link href="/" className="flex items-center gap-3 mb-12 cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-ink grid place-items-center">
            <span className="font-serif italic text-paper text-lg">M</span>
          </div>
          <div>
            <div className="font-serif text-xl text-ink leading-none">
              Michigan Elite
            </div>
            <div className="kicker mt-1">Sports Academy</div>
          </div>
        </Link>

        <div className="bg-paper border border-ink-hair rounded-2xl p-8 md:p-10">
          {authed === null && (
            <div className="text-sm text-ink-dim text-center py-6">{'Loading\u2026'}</div>
          )}

          {authed === false && (
            <>
              <h1 className="font-serif text-3xl text-ink mb-2">Link expired</h1>
              <p className="text-sm text-ink-dim mb-7">
                This password reset link is no longer valid. They expire one hour after being sent.
              </p>
              <Link
                href="/forgot-password"
                className="btn-primary inline-block text-center w-full"
              >
                Request a new link
              </Link>
            </>
          )}

          {authed === true && status !== 'success' && (
            <>
              <h1 className="font-serif text-3xl text-ink mb-2">Set new password</h1>
              <p className="text-sm text-ink-dim mb-7">
                Pick a password you&rsquo;ll use to sign in from now on.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="kicker">New password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="At least 8 characters, includes a number"
                    className="input-base"
                    autoComplete="new-password"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="kicker">Confirm password</span>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Type it again"
                    className="input-base"
                    autoComplete="new-password"
                  />
                </label>

                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="btn-primary mt-2"
                >
                  {status === 'submitting' ? 'Saving\u2026' : 'Save new password'}
                </button>

                {errorMsg && <div className="text-sm text-crimson mt-1">{errorMsg}</div>}
              </form>
            </>
          )}

          {status === 'success' && (
            <div className="p-5 bg-sage/10 border border-sage/30 rounded-xl">
              <div className="font-mono text-[10px] text-sage-dark tracking-[0.2em] uppercase mb-2">
                {'\u2713'} Password updated
              </div>
              <div className="text-[14px] text-ink">
                {'Redirecting to your dashboard\u2026'}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
