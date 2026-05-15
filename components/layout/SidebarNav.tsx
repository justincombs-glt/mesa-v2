'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import type { NavSection } from './AppShell';

interface Props {
  sections: NavSection[];
  currentPath?: string;
  /** Called when a link is clicked. Used by mobile drawer to close itself. */
  onNavigate?: () => void;
  /** Storage key suffix to namespace collapse state (e.g. 'desktop' vs 'mobile'). */
  storageKey?: string;
}

const STORAGE_PREFIX = 'mesa.sidebar.collapsed.';

/**
 * Renders the sidebar nav with collapsible group sections. Ungrouped sections
 * (group === null) render as a flat list of items. Grouped sections render
 * with a clickable header that toggles expand/collapse.
 *
 * Group expand/collapse state is persisted in localStorage. The group containing
 * the current page is always expanded on mount, regardless of stored state.
 */
export function SidebarNav({ sections, currentPath, onNavigate, storageKey = 'desktop' }: Props) {
  const fullStorageKey = STORAGE_PREFIX + storageKey;

  // Determine which group the current path lives in
  const activeGroupName = (() => {
    for (const sec of sections) {
      if (!sec.group) continue;
      const has = sec.items.some((it) =>
        currentPath === it.href ||
        (it.href !== '/dashboard' && currentPath?.startsWith(it.href))
      );
      if (has) return sec.group;
    }
    return null;
  })();

  // Collapsed state per group label. true = collapsed, false = expanded.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    // SSR-safe initial: everything expanded
    const init: Record<string, boolean> = {};
    sections.forEach((s) => {
      if (s.group) init[s.group] = false;
    });
    return init;
  });

  // After mount, hydrate from localStorage; force the active group expanded.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(fullStorageKey);
      const stored: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      const next: Record<string, boolean> = {};
      sections.forEach((s) => {
        if (s.group) {
          next[s.group] = s.group === activeGroupName ? false : !!stored[s.group];
        }
      });
      setCollapsed(next);
    } catch {
      // Ignore storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullStorageKey, activeGroupName]);

  const toggleGroup = (group: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [group]: !prev[group] };
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(fullStorageKey, JSON.stringify(next));
        }
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  return (
    <nav className="flex flex-col gap-1 px-3 py-4 flex-1 overflow-y-auto">
      {sections.map((sec, idx) => {
        if (!sec.group) {
          // Ungrouped: flat list
          return (
            <div key={`flat-${idx}`} className="flex flex-col gap-0.5">
              {sec.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  badge={item.badge}
                  active={isActive(currentPath, item.href)}
                  onClick={onNavigate}
                />
              ))}
            </div>
          );
        }

        const isCollapsed = collapsed[sec.group] === true;
        const groupHasActive = sec.group === activeGroupName;

        return (
          <div key={sec.group} className="flex flex-col mt-2 first:mt-0">
            <button
              type="button"
              onClick={() => toggleGroup(sec.group as string)}
              className="flex items-center justify-between gap-2 px-3 pt-2 pb-1.5 group"
              aria-expanded={!isCollapsed}
            >
              <span className={`text-[10px] font-mono tracking-[0.15em] uppercase ${groupHasActive ? 'text-ink' : 'text-ink-faint'}`}>
                {sec.group}
              </span>
              <svg
                width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`text-ink-faint transition-transform group-hover:text-ink ${isCollapsed ? '-rotate-90' : ''}`}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {!isCollapsed && (
              <div className="flex flex-col gap-0.5">
                {sec.items.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    badge={item.badge}
                    active={isActive(currentPath, item.href)}
                    onClick={onNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function isActive(currentPath: string | undefined, href: string): boolean {
  return currentPath === href ||
    (href !== '/dashboard' && !!currentPath?.startsWith(href));
}

function NavItem({
  href, label, icon, active, onClick, badge,
}: {
  href: string; label: string; icon: ReactNode; active: boolean;
  onClick?: () => void;
  /** Phase 17: optional small badge (e.g. unread count) shown to the right of the label. */
  badge?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-ink text-paper'
          : 'text-ink-dim hover:bg-ivory hover:text-ink active:bg-ivory'
      }`}
    >
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      {badge && (
        <span className={`flex-shrink-0 text-[10px] font-mono font-semibold rounded-full px-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center ${
          active ? 'bg-paper text-ink' : 'bg-crimson text-paper'
        }`}>
          {badge}
        </span>
      )}
    </Link>
  );
}
