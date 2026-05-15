'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { releaseWorkout } from '@/app/actions';

interface Props {
  workoutId: string;
  releasedAt: string | null;
  /** Disable interaction when the season is archived or the caller is otherwise blocked. */
  disabled?: boolean;
}

/**
 * Phase 16: release-status banner with action button. Shows above the workout
 * detail content.
 *
 *   - If released → green "Released" banner with timestamp (read-only display)
 *   - If unreleased → amber "Locked" banner with a Release button
 *
 * The release action is irreversible (Q5 = B). No "un-release" affordance is
 * offered. If a trainer wants to lock players out again, deleting the activity
 * is the path.
 */
export function ReleaseControl({ workoutId, releasedAt, disabled }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (releasedAt) {
    const when = new Date(releasedAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    return (
      <section className="card-base p-3 mb-6 flex items-center gap-3 border-2 border-sage/40 bg-sage/5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sage-dark flex-shrink-0">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <div className="text-sm text-ink">
          <span className="font-medium">Released to athletes</span>
          <span className="text-ink-faint text-xs ml-2">&middot; {when}</span>
        </div>
      </section>
    );
  }

  const handleRelease = async () => {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set('activity_id', workoutId);
    const res = await releaseWorkout(fd);
    setBusy(false);
    if (res.ok) {
      setConfirming(false);
      router.refresh();
    } else {
      setError(res.error ?? 'Could not release.');
    }
  };

  return (
    <section className="card-base p-3 mb-6 flex items-center justify-between gap-3 border-2 border-crimson/30 bg-crimson/5">
      <div className="flex items-center gap-3 min-w-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-crimson flex-shrink-0">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">Locked</div>
          <div className="text-[11px] text-ink-dim mt-0.5">
            Athletes can see the exercises but can&apos;t log sets until you release.
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {confirming ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRelease}
              disabled={busy || disabled}
              className="btn-primary !h-9 text-[12px] !px-4"
            >
              {busy ? 'Releasing\u2026' : 'Confirm release'}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setError(null); }}
              disabled={busy}
              className="btn-secondary !h-9 text-[12px] !px-4"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={disabled}
            className="btn-primary !h-9 text-[12px] !px-4"
          >
            Release
          </button>
        )}
        {error && <div className="text-[11px] text-crimson">{error}</div>}
      </div>
    </section>
  );
}
