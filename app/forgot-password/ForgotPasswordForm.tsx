'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 8b: forgot-password request page.
 *
 * Flow:
 *   1. User enters their email
 *   2. Submit -> supabase.auth.resetPasswordForEmail
 *   3. Supabase sends a recovery email via SMTP (routed through Resend)
 *   4. Email contains a link to /auth/callback?code=... which then redirects
 *      to /reset-password (via the next= param)
 *
 * Privacy: we always show a success state regardless of whether the email
 * exists in our system. Otherwise a stranger could enumerate which emails
 * have MESA accounts by trying different addresses.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg(null);
    const supabase = createClient();

    // Tell Supabase where to send the user after they click the reset link.
    // It goes through /auth/callback (existing code-exchange route), which
    // then forwards to /reset-password where they set the new password.
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    // Privacy: only surface "error" for clearly malformed input. For "user
    // not found" type errors (which Supabase might return), still show
    // success — we don't want to leak which emails have accounts.
    if (error && /invalid|format/i.test(error.message)) {
      setStatus('error');
      setErrorMsg(error.message);
      return;
    }
    setStatus('sent');
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
          <h1 className="font-serif text-3xl text-ink mb-2">Reset password</h1>
          <p className="text-sm text-ink-dim mb-7">
            Enter your email and we&rsquo;ll send a link to set a new password.
          </p>

          {status === 'sent' ? (
            <div className="p-5 bg-sage/10 border border-sage/30 rounded-xl">
              <div className="font-mono text-[10px] text-sage-dark tracking-[0.2em] uppercase mb-2">
                {'\u2713'} Check your email
              </div>
              <div className="text-[14px] text-ink">
                If an account exists for <strong>{email}</strong>, a password reset link is on its way. It expires in one hour.
              </div>
              <div className="mt-4 text-[12px] text-ink-dim">
                Didn&rsquo;t get it? Check spam, then try again.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="kicker">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="input-base"
                  autoComplete="email"
                />
              </label>

              <button
                type="submit"
                disabled={status === 'sending'}
                className="btn-primary mt-2"
              >
                {status === 'sending' ? 'Sending\u2026' : 'Send reset link'}
              </button>

              {errorMsg && <div className="text-sm text-crimson mt-1">{errorMsg}</div>}
            </form>
          )}

          <div className="mt-5 pt-5 border-t border-ink-hair text-center">
            <Link
              href="/sign-in"
              className="text-[12px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
