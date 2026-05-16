'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 8b: brand-new user signup.
 *
 * Flow:
 *   1. Invitee clicks "Set up your account" in the invite email
 *   2. Lands here with their email prefilled via ?email=... query param
 *   3. They pick a password + confirm
 *   4. Submit -> supabase.auth.signUp -> Supabase creates the auth user
 *   5. The handle_new_user Postgres trigger runs (consumes the matching
 *      invite row, sets role, links student/player record as applicable)
 *   6. They're immediately signed in (Confirm email is OFF in Supabase
 *      settings, so signUp returns both user + session)
 *   7. Redirect to /dashboard
 *
 * Password requirements per Q2 = B:
 *   - At least 8 characters
 *   - Must contain at least one digit
 *
 * Supabase also enforces 8-char minimum at the server level (set in
 * Authentication -> Policies). The digit requirement is client-side only;
 * Supabase doesn't natively enforce that — but rejecting client-side keeps
 * the UX consistent.
 */
export function SignUpForm() {
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get('email') ?? '';
  const next = searchParams.get('next') ?? '/dashboard';

  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Update email if URL changes after first render (e.g. user goes back)
  useEffect(() => {
    if (emailFromUrl && emailFromUrl !== email) setEmail(emailFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailFromUrl]);

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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      setStatus('error');
      // Common case: email already exists (user previously signed up).
      // Supabase returns a generic message; we route them to sign in.
      if (/already registered|exists/i.test(error.message)) {
        setErrorMsg(
          'An account with this email already exists. Sign in instead, or use \u201cForgot password?\u201d if you don\u2019t remember it.'
        );
      } else {
        setErrorMsg(error.message);
      }
      return;
    }

    // With Confirm email OFF, signUp returns a session immediately.
    // Just in case it's not set (e.g. someone re-enabled confirmations),
    // fall back to redirecting to sign-in.
    if (data.session) {
      window.location.href = next;
    } else {
      window.location.href = `/sign-in?next=${encodeURIComponent(next)}`;
    }
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
          <h1 className="font-serif text-3xl text-ink mb-2">Set up your account</h1>
          <p className="text-sm text-ink-dim mb-7">
            Pick a password. You&rsquo;ll use it to sign in from now on.
          </p>

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
                readOnly={!!emailFromUrl}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="kicker">Password</span>
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
              {status === 'submitting' ? 'Creating account\u2026' : 'Create account'}
            </button>

            {errorMsg && <div className="text-sm text-crimson mt-1">{errorMsg}</div>}
          </form>

          <div className="mt-5 pt-5 border-t border-ink-hair text-center">
            <Link
              href={`/sign-in?next=${encodeURIComponent(next)}`}
              className="text-[12px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>

        <p className="text-xs text-ink-faint text-center mt-6 leading-relaxed">
          By signing up you agree to MESA&rsquo;s terms of service.
        </p>
      </div>
    </main>
  );
}
