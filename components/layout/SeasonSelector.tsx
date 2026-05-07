'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { selectSeason } from '@/app/actions';
import type { Season } from '@/lib/supabase/types';

interface Props {
  selected: Season;
  allSeasons: Season[];
}

export function SeasonSelector({ selected, allSeasons }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handlePick = (id: string) => {
    if (id === selected.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', id);
      await selectSeason(fd);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-ink-hair bg-paper hover:bg-ivory text-left text-sm disabled:opacity-50"
      >
        <div className="min-w-0 flex-1">
          <div className="font-medium text-ink truncate">{selected.name}</div>
          <div className="text-[10px] font-mono tracking-wider text-ink-faint mt-0.5">
            {selected.is_current ? 'CURRENT' : selected.archived_at ? 'ARCHIVED' : 'UPCOMING'}
          </div>
        </div>
        <svg className={`w-3.5 h-3.5 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-paper border border-ink-hair rounded-lg shadow-lg z-50 overflow-hidden max-h-80 overflow-y-auto">
            {allSeasons.map((s) => {
              const active = s.id === selected.id;
              const status = s.is_current ? 'CURRENT' : s.archived_at ? 'ARCHIVED' : 'UPCOMING';
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handlePick(s.id)}
                  className={`w-full text-left px-3 py-2 flex items-start justify-between gap-2 ${active ? 'bg-ivory' : 'hover:bg-ivory'}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium truncate ${active ? 'text-crimson' : 'text-ink'}`}>
                      {s.name}
                    </div>
                    <div className="text-[10px] text-ink-faint mt-0.5">
                      {formatDate(s.starts_on)} – {formatDate(s.ends_on)}
                    </div>
                  </div>
                  <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${
                    status === 'CURRENT' ? 'bg-sage/10 text-sage-dark border border-sage/30' :
                    status === 'ARCHIVED' ? 'bg-sand-100 text-ink-faint border border-sand-200' :
                    'bg-paper text-ink-faint border border-ink-hair'
                  }`}>
                    {status}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
