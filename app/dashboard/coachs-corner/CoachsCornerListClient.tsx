'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createCoachsCornerVideo,
  updateCoachsCornerVideo,
  deleteCoachsCornerVideo,
} from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { providerLabel } from '@/lib/video-url';
import type { CoachsCornerVideo } from '@/lib/supabase/types';

export interface VideoForDisplay extends CoachsCornerVideo {
  posterName: string | null;
  watched: boolean;
}

export interface DayForDisplay {
  date: string;
  videos: VideoForDisplay[];
}

interface Props {
  days: DayForDisplay[];
  /** True for admin/director/coach — shows post + edit + delete affordances. */
  canPost: boolean;
  /** True for student — shows watched-state badge on rows. */
  isStudent: boolean;
}

export function CoachsCornerListClient({ days, canPost, isStudent }: Props) {
  const [postOpen, setPostOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoForDisplay | null>(null);

  // Q3 = C: "Jump to date" picker — flat list of all dates with videos
  const dateRef = useRef<HTMLInputElement>(null);
  const availableDates = useMemo(() => new Set(days.map((d) => d.date)), [days]);

  const handleJumpToDate = () => {
    const target = dateRef.current?.value;
    if (!target) return;
    const el = document.getElementById(`day-${target}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      alert('No videos posted on that date.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top controls bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <input
            ref={dateRef}
            type="date"
            list="cc-date-list"
            className="input-base !h-9 text-[13px]"
            aria-label="Jump to date"
          />
          {/* HTML5 datalist — gives the browser autocomplete on dates that have content */}
          <datalist id="cc-date-list">
            {Array.from(availableDates).map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={handleJumpToDate}
            className="btn-secondary !h-9 text-[12px] !px-3"
          >
            Jump
          </button>
        </div>

        {canPost && (
          <button
            type="button"
            onClick={() => setPostOpen(true)}
            className="btn-primary !h-9 text-[13px] !px-4"
          >
            + Post video
          </button>
        )}
      </div>

      {/* Empty state */}
      {days.length === 0 && (
        <div className="card-base p-10 text-center">
          <h3 className="font-serif text-xl text-ink mb-2">Nothing here yet</h3>
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            {canPost
              ? 'Post your first video using the button above.'
              : 'Check back later when your coaches share something.'}
          </p>
        </div>
      )}

      {/* Day-grouped list, most recent first */}
      {days.map((day) => (
        <DayBlock
          key={day.date}
          day={day}
          canPost={canPost}
          isStudent={isStudent}
          onEdit={(v) => setEditingVideo(v)}
        />
      ))}

      {/* Post modal */}
      {canPost && (
        <PostVideoModal
          open={postOpen}
          onClose={() => setPostOpen(false)}
          mode="create"
        />
      )}

      {/* Edit modal — same component, different mode + initial values */}
      {canPost && editingVideo && (
        <PostVideoModal
          open={true}
          onClose={() => setEditingVideo(null)}
          mode="edit"
          existing={editingVideo}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Day card
// ----------------------------------------------------------------------------

function DayBlock({
  day, canPost, isStudent, onEdit,
}: {
  day: DayForDisplay;
  canPost: boolean;
  isStudent: boolean;
  onEdit: (v: VideoForDisplay) => void;
}) {
  const date = new Date(day.date + 'T00:00:00');
  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <section id={`day-${day.date}`}>
      <div className="kicker mb-3">{dateLabel}</div>
      <div className="card-base overflow-hidden">
        {day.videos.map((v, idx) => (
          <VideoRow
            key={v.id}
            video={v}
            canPost={canPost}
            isStudent={isStudent}
            first={idx === 0}
            onEdit={() => onEdit(v)}
          />
        ))}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Single video row
// ----------------------------------------------------------------------------

function VideoRow({
  video, canPost, isStudent, first, onEdit,
}: {
  video: VideoForDisplay;
  canPost: boolean;
  isStudent: boolean;
  first: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${video.title}"? This cannot be undone.`)) return;
    setBusy(true);
    const fd = new FormData();
    fd.set('id', video.id);
    await deleteCoachsCornerVideo(fd);
    router.refresh();
  };

  return (
    <div className={`flex items-stretch ${first ? '' : 'border-t border-ink-hair'}`}>
      <Link
        href={`/dashboard/coachs-corner/${video.id}`}
        className="flex items-center gap-4 px-5 py-3.5 group flex-1 min-w-0 hover:bg-ivory"
      >
        {/* Provider badge */}
        <div className="flex-shrink-0 w-12 text-center">
          <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-ink text-paper">
            {providerLabel(video.provider).slice(0, 4)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-medium text-ink group-hover:text-crimson transition-colors truncate">
              {video.title}
            </span>
            {isStudent && video.watched && (
              <span className="text-[9px] font-mono tracking-wider uppercase text-sage-dark inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sage-dark inline-block" aria-hidden />
                Watched
              </span>
            )}
          </div>
          <div className="text-xs text-ink-faint truncate">
            {video.posterName && <>Posted by {video.posterName}</>}
            {video.posterName && video.description && <span className="mx-1.5">&middot;</span>}
            {video.description && <span>{video.description}</span>}
          </div>
        </div>

        <div className="flex-shrink-0 text-[10px] font-mono uppercase tracking-wider text-ink-faint group-hover:text-crimson">
          Watch &rarr;
        </div>
      </Link>

      {canPost && (
        <div className="flex items-center gap-1 pr-3 flex-shrink-0">
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson disabled:opacity-50 px-2"
            aria-label="Edit video"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson disabled:opacity-50 px-2"
            aria-label="Delete video"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Post / Edit modal
// ----------------------------------------------------------------------------

function PostVideoModal({
  open, onClose, mode, existing,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  existing?: VideoForDisplay;
}) {
  const router = useRouter();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [forDate, setForDate] = useState<string>(existing?.for_date ?? todayStr);
  const [title, setTitle] = useState<string>(existing?.title ?? '');
  const [url, setUrl] = useState<string>(existing?.url ?? '');
  const [description, setDescription] = useState<string>(existing?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set('for_date', forDate);
    fd.set('title', title);
    fd.set('url', url);
    fd.set('description', description);

    let res: { ok: boolean; error?: string };
    if (mode === 'edit' && existing) {
      fd.set('id', existing.id);
      res = await updateCoachsCornerVideo(fd);
    } else {
      res = await createCoachsCornerVideo(fd);
    }
    setSaving(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      setError(res.error ?? 'Could not save.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit video' : 'Post a video'}
      description={mode === 'edit'
        ? 'Change any field. URL will be re-validated.'
        : 'Paste a YouTube, Vimeo, or Hudl link.'}
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Date" required help="The date this video is for. Athletes browse by date.">
          <input
            type="date"
            value={forDate}
            onChange={(e) => setForDate(e.target.value)}
            required
            className="input-base"
          />
        </FormField>

        <FormField label="Title" required help="Short name for the video. Shown in the list.">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="e.g. Pre-game forecheck breakdown"
            className="input-base"
          />
        </FormField>

        <FormField label="Video URL" required help="YouTube, Vimeo, or Hudl link.">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://youtube.com/watch?v=\u2026"
            className="input-base"
          />
        </FormField>

        <FormField label="Description" help="Optional. What should athletes pay attention to?">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Optional context, key moments, things to watch for\u2026"
            className="input-base resize-y min-h-[88px]"
          />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Saving\u2026' : (mode === 'edit' ? 'Save changes' : 'Post video')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
