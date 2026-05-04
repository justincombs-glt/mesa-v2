'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SignOutButton } from './SignOutButton';
import { SeasonSelector } from './SeasonSelector';
import type { AppRole, Season } from '@/lib/supabase/types';

interface NavLink {
  href: string;
  label: string;
  icon: ReactNode;
}

interface Props {
  nav: NavLink[];
  role: AppRole;
  email: string;
  displayName: string;
  currentPath?: string;
  selectedSeason?: Season | null;
  allSeasons?: Season[];
}

/**
 * Slide-in left drawer for mobile navigation. Shows season selector,
 * nav links, and user block. Closes on:
 *  - hamburger button tap
 *  - backdrop tap
 *  - escape key
 *  - link click (route change)
 *  - viewport resize past md breakpoint
 */
export function MobileNavDrawer({
  nav, role, email, displayName, currentPath, selectedSeason, allSeasons,
}: Props) {
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Close on resize past breakpoint
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  return (
    <>
      {/* Top bar visible on mobile only */}
      <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-ink-hair bg-paper">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="w-11 h-11 -ml-2 grid place-items-center rounded-lg active:bg-ivory"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>

        <Link href="/dashboard" className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-full bg-ink grid place-items-center flex-shrink-0">
            <span className="font-serif italic text-paper text-sm">M</span>
          </div>
          <div className="font-serif text-[15px] text-ink leading-none truncate">
            Michigan Elite
          </div>
        </Link>
      </div>

      {/* Backdrop */}
      {open && (
        <button
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="md:hidden fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
        />
      )}

      {/* Drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] bg-paper border-r border-ink-hair flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand + close */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-ink-hair">
          <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-ink grid place-items-center flex-shrink-0">
              <span className="font-serif italic text-paper text-lg">M</span>
            </div>
            <div className="min-w-0">
              <div className="font-serif text-[17px] text-ink leading-none truncate">
                Michigan Elite
              </div>
              <div className="kicker mt-1">Sports Academy</div>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="w-9 h-9 -mr-1 grid place-items-center rounded-lg active:bg-ivory text-ink-faint"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        {/* Season selector */}
        {selectedSeason && allSeasons && allSeasons.length > 0 && (
          <div className="px-4 pt-4">
            <div className="kicker mb-1.5">Season</div>
            <SeasonSelector selected={selectedSeason} allSeasons={allSeasons} />
          </div>
        )}

        {/* Nav links */}
        <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1 overflow-y-auto">
          {nav.map((item) => {
            const active = currentPath === item.href ||
              (item.href !== '/dashboard' && currentPath?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-ink text-paper'
                    : 'text-ink-dim active:bg-ivory hover:bg-ivory hover:text-ink'
                }`}
              >
                <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User block */}
        <div className="flex flex-col gap-3 px-5 py-5 border-t border-ink-hair">
          <div>
            <span
              className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono tracking-[0.15em] uppercase border ${
                role === 'director'
                  ? 'text-crimson border-crimson/30 bg-crimson/5'
                  : role === 'coach'
                  ? 'text-sage-dark border-sage/30 bg-sage/10'
                  : 'text-ink-dim border-ink-hair bg-ivory'
              }`}
            >
              {role}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink truncate">{displayName}</div>
            <div className="text-xs text-ink-faint truncate">{email}</div>
          </div>
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
