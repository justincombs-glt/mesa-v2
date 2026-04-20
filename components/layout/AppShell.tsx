import Link from 'next/link';
import type { ReactNode } from 'react';
import type { AppRole, Season } from '@/lib/supabase/types';
import { SignOutButton } from './SignOutButton';
import { SeasonSelector } from './SeasonSelector';

interface AppShellProps {
  role: AppRole;
  email: string;
  displayName: string;
  children: ReactNode;
  currentPath?: string;
  selectedSeason?: Season | null;
  allSeasons?: Season[];
  isArchivedView?: boolean;
}

interface NavLink {
  href: string;
  label: string;
  icon: ReactNode;
}

function navForRole(role: AppRole): NavLink[] {
  const icons = {
    home: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>),
    family: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="7" r="2"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2M17 13a3 3 0 013 3v2"/></svg>),
    users: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>),
    invites: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>),
    goals: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>),
    drills: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>),
    exercises: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11M4 10v4M20 10v4M2 12h2M20 12h2"/><rect x="7" y="9" width="10" height="6" rx="1"/></svg>),
    practices: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
    activities: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>),
    workouts: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11"/><rect x="7" y="9" width="10" height="6" rx="1"/></svg>),
    performance: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/></svg>),
    tests: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>),
    settings: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>),
  };

  const home = { href: '/dashboard', label: 'Home', icon: icons.home };
  const settings = { href: '/dashboard/settings', label: 'Profile', icon: icons.settings };

  switch (role) {
    case 'admin':
      return [
        home,
        { href: '/dashboard/users', label: 'Users', icon: icons.users },
        { href: '/dashboard/drills', label: 'Drills', icon: icons.drills },
        { href: '/dashboard/exercises', label: 'Exercises', icon: icons.exercises },
        { href: '/dashboard/goal-templates', label: 'Goal Templates', icon: icons.goals },
        { href: '/dashboard/performance-tests', label: 'Performance Tests', icon: icons.tests },
        { href: '/dashboard/composite-performance-tests', label: 'Composite Tests', icon: icons.performance },
        { href: '/dashboard/cpt-sessions', label: 'CPT Sessions', icon: icons.tests },
        { href: '/dashboard/seasons', label: 'Seasons', icon: icons.activities },
        settings,
      ];
    case 'director':
      return [
        home,
        { href: '/dashboard/invite', label: 'Add Users', icon: icons.invites },
        { href: '/dashboard/students', label: 'Students', icon: icons.family },
        { href: '/dashboard/practice-plans', label: 'Practice Plans', icon: icons.practices },
        { href: '/dashboard/goal-management', label: 'Goal Management', icon: icons.goals },
        { href: '/dashboard/performance-management', label: 'Performance Management', icon: icons.performance },
        { href: '/dashboard/cpt-sessions', label: 'CPT Sessions', icon: icons.tests },
        { href: '/dashboard/seasons', label: 'Seasons', icon: icons.activities },
        settings,
      ];
    case 'coach':
      return [
        home,
        { href: '/dashboard/drills', label: 'Drills', icon: icons.drills },
        { href: '/dashboard/practices', label: 'Practices', icon: icons.practices },
        { href: '/dashboard/activities', label: 'Activities', icon: icons.activities },
        { href: '/dashboard/students', label: 'Students', icon: icons.family },
        settings,
      ];
    case 'trainer':
      return [
        home,
        { href: '/dashboard/exercises', label: 'Exercises', icon: icons.exercises },
        { href: '/dashboard/workouts', label: 'Off-Ice Workouts', icon: icons.workouts },
        { href: '/dashboard/cpt-sessions', label: 'CPT Sessions', icon: icons.tests },
        { href: '/dashboard/students', label: 'Students', icon: icons.family },
        settings,
      ];
    case 'student':
      return [
        home,
        { href: '/dashboard/goal-management', label: 'Goal Management', icon: icons.goals },
        { href: '/dashboard/performance-management', label: 'Performance Management', icon: icons.performance },
        settings,
      ];
    case 'parent':
      return [
        home,
        { href: '/dashboard/family', label: 'My Family', icon: icons.family },
        settings,
      ];
  }
}

export function AppShell({ role, email, displayName, children, currentPath, selectedSeason, allSeasons, isArchivedView }: AppShellProps) {
  const nav = navForRole(role);

  return (
    <div className="min-h-screen bg-ivory flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="md:w-64 md:min-h-screen md:border-r md:border-ink-hair md:bg-paper md:flex md:flex-col md:flex-shrink-0">
        {/* Brand */}
        <div className="px-5 md:px-6 py-5 md:py-7 border-b border-ink-hair md:border-b-0">
          <Link href="/dashboard" className="flex items-center gap-3 cursor-pointer">
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
        </div>

        {/* Season selector (sidebar) */}
        {selectedSeason && allSeasons && allSeasons.length > 0 && (
          <div className="hidden md:block px-4 pt-3 pb-1">
            <div className="kicker mb-1.5">Season</div>
            <SeasonSelector
              selected={selectedSeason}
              allSeasons={allSeasons}
            />
          </div>
        )}

        {/* Nav items */}
        <nav className="hidden md:flex md:flex-col gap-0.5 px-3 py-4 flex-1">
          {nav.map((item) => {
            const active = currentPath === item.href ||
              (item.href !== '/dashboard' && currentPath?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-ink text-paper'
                    : 'text-ink-dim hover:bg-ivory hover:text-ink'
                }`}
              >
                <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User block */}
        <div className="hidden md:flex md:flex-col gap-3 px-5 py-5 border-t border-ink-hair">
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

      {/* Mobile nav bar */}
      <nav className="md:hidden flex gap-1 overflow-x-auto px-3 py-2 border-b border-ink-hair bg-paper">
        {nav.map((item) => {
          const active = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                active ? 'bg-ink text-paper' : 'text-ink-dim'
              }`}
            >
              <span className="w-3.5 h-3.5">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {isArchivedView && selectedSeason && (
          <div className="bg-sand-100 border-b border-sand-200 px-5 md:px-10 py-3">
            <div className="max-w-[1200px] mx-auto flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-ink-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/>
                </svg>
                <span className="text-ink">
                  Viewing <strong>{selectedSeason.name}</strong> &mdash; archived. Read-only mode.
                </span>
              </div>
              <span className="text-xs text-ink-faint ml-auto">
                Switch to the current season from the selector in the sidebar to make changes.
              </span>
            </div>
          </div>
        )}
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-8 md:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
