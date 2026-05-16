'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 8b: password-only sign-in.
 *
 * Magic link was removed from the user-facing flow per Q3=A. The Supabase
 * Auth instance still supports magic link technically (used for password
 * recovery under the hood), so existing users who never set a password
 * recover by clicking "Forgot password?" below.
 */
export function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus('error');
      if (/invalid login credentials/i.test(error.message)) {
        setErrorMsg(
          "Email or password isn't correct. If this is your first time signing in with a password, use \u201cForgot password?\u201d below to set one."
        );
      } else {
        setErrorMsg(error.message);
      }
    } else {
      window.location.href = next;
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
          <h1 className="font-serif text-3xl text-ink mb-2">Welcome back</h1>
          <p className="text-sm text-ink-dim mb-7">
            Sign in to your family or coach account.
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
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                className="input-base"
                autoComplete="current-password"
              />
            </label>

            <button type="submit" disabled={status === 'sending'} className="btn-primary mt-2">
              {status === 'sending' ? 'Signing in\u2026' : 'Sign in'}
            </button>

            {errorMsg && <div className="text-sm text-crimson mt-1">{errorMsg}</div>}
          </form>

          <div className="mt-5 pt-5 border-t border-ink-hair text-center">
            <Link
              href="/forgot-password"
              className="text-[12px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <p className="text-xs text-ink-faint text-center mt-6 leading-relaxed">
          New families join MESA by invitation from the academy. If you&apos;re
          expecting an invite and haven&apos;t received one, check your spam or
          contact the front office.
        </p>
      </div>
    </main>
  );
}
