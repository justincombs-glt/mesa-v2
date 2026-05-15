'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { markCoachsCornerWatched } from '@/app/actions';
import { providerLabel } from '@/lib/video-url';
import type { CoachsCornerProvider } from '@/lib/supabase/types';

interface Props {
  videoId: string;
  /** null when embed_id is missing — UI falls back to "open externally" link. */
  embedUrl: string | null;
  /** Original URL pasted by the coach — fallback link for non-embeddable cases. */
  url: string;
  provider: CoachsCornerProvider;
  initiallyWatched: boolean;
  /** Whether to show the "Mark as watched" toggle — only true for students (Q7 = A). */
  isStudent: boolean;
}

/**
 * Embedded video player with optional "mark as watched" button for students.
 *
 * Provider notes:
 *   - YouTube: embed reliably works for any public video
 *   - Vimeo: embed works for public videos; private+password-gated won't embed
 *   - Hudl: embed works ONLY for public-shared videos. Private team-account
 *           videos won't render in the iframe — for those, the fallback
 *           "Open in Hudl" link is the only option. We display that link
 *           prominently below the iframe.
 */
export function VideoPlayerWithWatch({
  videoId, embedUrl, url, provider, initiallyWatched, isStudent,
}: Props) {
  const router = useRouter();
  const [watched, setWatched] = useState(initiallyWatched);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    const next = !watched;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set('video_id', videoId);
    fd.set('watched', next ? '1' : '0');
    const res = await markCoachsCornerWatched(fd);
    setBusy(false);
    if (res.ok) {
      setWatched(next);
      router.refresh();
    } else {
      setError(res.error ?? 'Could not update.');
    }
  };

  return (
    <section>
      <div className="kicker mb-2">Video</div>

      {/* Embedded player */}
      <div className="card-base overflow-hidden">
        <div className="relative w-full bg-ink" style={{ paddingBottom: '56.25%' /* 16:9 */ }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title="Coach&rsquo;s Corner video"
              className="absolute inset-0 w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-paper text-sm">
              Unable to embed this video.
            </div>
          )}
        </div>

        {/* Hudl-specific fallback note — many Hudl videos require account access */}
        {provider === 'hudl' && (
          <div className="px-4 py-2.5 border-t border-ink-hair bg-sand-50 text-xs text-ink-dim">
            If the video doesn&rsquo;t load above, you may need to sign into Hudl.{' '}
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-crimson hover:underline">
              Open in {providerLabel(provider)} &rarr;
            </a>
          </div>
        )}
      </div>

      {/* Mark-watched toggle (students only) */}
      {isStudent && (
        <div className="mt-4 flex items-center justify-between gap-3 card-base p-4">
          <div className="flex items-center gap-3">
            {watched ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sage-dark flex-shrink-0">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <div className="text-sm text-ink">
                  <span className="font-medium">Watched</span>
                  <span className="text-ink-faint text-xs ml-2">&middot; Marked by you</span>
                </div>
              </>
            ) : (
              <div className="text-sm text-ink-dim">
                When you&rsquo;ve watched, tap below to let your coach know.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={busy}
            className={watched ? 'btn-secondary !h-9 text-[12px] !px-4' : 'btn-primary !h-9 text-[12px] !px-4'}
          >
            {busy ? '\u2026' : watched ? 'Unmark' : 'Mark as watched'}
          </button>
        </div>
      )}

      {error && <div className="mt-2 text-xs text-crimson">{error}</div>}
    </section>
  );
}
