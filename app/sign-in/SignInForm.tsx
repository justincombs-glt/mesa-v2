'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Mode = 'password' | 'magic';

export function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      window.location.href = next;
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      setStatus('sent');
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

          <div className="flex gap-1 p-1 bg-ivory border border-ink-hair rounded-lg mb-6">
            <button
              type="button"
              onClick={() => { setMode('password'); setStatus('idle'); setErrorMsg(null); }}
              className={`flex-1 py-2 rounded-md font-mono text-[10px] tracking-[0.15em] uppercase transition-colors ${
                mode === 'password' ? 'bg-ink text-paper' : 'bg-transparent text-ink-faint hover:text-ink'
              }`}
            >Password</button>
            <button
              type="button"
              onClick={() => { setMode('magic'); setStatus('idle'); setErrorMsg(null); }}
              className={`flex-1 py-2 rounded-md font-mono text-[10px] tracking-[0.15em] uppercase transition-colors ${
                mode === 'magic' ? 'bg-ink text-paper' : 'bg-transparent text-ink-faint hover:text-ink'
              }`}
            >Magic Link</button>
          </div>

          {status === 'sent' && mode === 'magic' ? (
            <div className="p-5 bg-sage/10 border border-sage/30 rounded-xl">
              <div className="font-mono text-[10px] text-sage-dark tracking-[0.2em] uppercase mb-2">✓ Link sent</div>
              <div className="text-[14px] text-ink">
                Check <strong>{email}</strong> for a sign-in link. It expires in one hour.
              </div>
            </div>
          ) : (
            <form onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="kicker">Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="input-base" />
              </label>

              {mode === 'password' && (
                <label className="flex flex-col gap-2">
                  <span className="kicker">Password</span>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="input-base" />
                </label>
              )}

              <button type="submit" disabled={status === 'sending'} className="btn-primary mt-2">
                {status === 'sending'
                  ? mode === 'password' ? 'Signing in…' : 'Sending…'
                  : mode === 'password' ? 'Sign in' : 'Email me a sign-in link'}
              </button>

              {errorMsg && <div className="text-sm text-crimson mt-1">{errorMsg}</div>}
            </form>
          )}
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
