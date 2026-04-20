'use client';

import { useState } from 'react';
import { createSeason, activateSeason, archiveSeason, deleteSeason } from '@/app/actions';
import { toFormAction } from '@/lib/form-helpers';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { SeasonRow } from './page';

interface Props {
  seasons: SeasonRow[];
  addOnly?: boolean;
}

export function SeasonsClient({ seasons, addOnly }: Props) {
  const [addOpen, setAddOpen] = useState(false);

  if (addOnly) {
    return (
      <>
        <button onClick={() => setAddOpen(true)} className="btn-primary !h-10 !px-4 text-[13px]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New season
        </button>
        <NewSeasonModal open={addOpen} onClose={() => setAddOpen(false)} />
      </>
    );
  }

  if (seasons.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No seasons defined yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          Create the academy&apos;s first season. Every plan, activity, and result is scoped to a season.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card-base overflow-hidden">
        {seasons.map((s, idx) => <SeasonRowItem key={s.id} season={s} first={idx === 0} />)}
      </div>
      <NewSeasonModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function SeasonRowItem({ season, first }: { season: SeasonRow; first: boolean }) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const status = season.is_current ? 'current' : season.archived_at ? 'archived' : 'upcoming';
  const statusStyle = status === 'current'
    ? 'bg-sage/10 text-sage-dark border border-sage/30'
    : status === 'archived'
    ? 'bg-sand-100 text-ink-faint border border-sand-200'
    : 'bg-paper text-ink-faint border border-ink-hair';

  const blockedReasons: string[] = [];
  if (season.draft_or_active_plan_count > 0) {
    blockedReasons.push(`${season.draft_or_active_plan_count} plan${season.draft_or_active_plan_count === 1 ? '' : 's'} still draft or active`);
  }
  if (season.open_review_count > 0) {
    blockedReasons.push(`${season.open_review_count} review${season.open_review_count === 1 ? '' : 's'} not completed`);
  }
  const canArchive = !season.archived_at && blockedReasons.length === 0;
  const canDelete = !season.archived_at && season.plan_count === 0 && season.activity_count === 0 && !season.is_current;

  return (
    <div className={`flex items-center gap-5 px-5 py-4 ${first ? '' : 'border-t border-ink-hair'} ${season.archived_at ? 'opacity-70' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-medium text-ink">{season.name}</span>
          <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${statusStyle}`}>
            {status}
          </span>
        </div>
        <div className="text-xs text-ink-faint">
          {formatDate(season.starts_on)} &rarr; {formatDate(season.ends_on)}
          {season.archived_at && <span> · Archived {formatDate(season.archived_at.slice(0, 10))}</span>}
        </div>
      </div>

      <div className="flex gap-6 flex-shrink-0 text-right text-xs">
        <div>
          <div className="font-mono text-sm text-ink">{season.enrollment_count}</div>
          <div className="kicker text-[9px] mt-0.5">Enrolled</div>
        </div>
        <div>
          <div className="font-mono text-sm text-ink">{season.plan_count}</div>
          <div className="kicker text-[9px] mt-0.5">Plans</div>
        </div>
        <div>
          <div className="font-mono text-sm text-ink">{season.activity_count}</div>
          <div className="kicker text-[9px] mt-0.5">Activities</div>
        </div>
      </div>

      <div className="flex flex-col gap-1 flex-shrink-0">
        {!season.archived_at && !season.is_current && (
          <form action={toFormAction(activateSeason)}>
            <input type="hidden" name="id" value={season.id} />
            <button type="submit" className="text-xs font-mono uppercase tracking-wider text-sage-dark hover:text-sage">
              Activate
            </button>
          </form>
        )}
        {canArchive && (
          <button
            type="button"
            onClick={() => setArchiveOpen(true)}
            className="text-xs font-mono uppercase tracking-wider text-ink-faint hover:text-ink"
          >
            Archive
          </button>
        )}
        {!canArchive && !season.archived_at && blockedReasons.length > 0 && (
          <span className="text-xs font-mono uppercase tracking-wider text-ink-faint opacity-50 cursor-not-allowed"
            title={`Cannot archive: ${blockedReasons.join(', ')}`}>
            Archive
          </span>
        )}
        {canDelete && (
          <form action={toFormAction(deleteSeason)}
            onSubmit={(e) => { if (!confirm(`Delete "${season.name}"? No plans or activities exist in this season yet.`)) e.preventDefault(); }}>
            <input type="hidden" name="id" value={season.id} />
            <button type="submit" className="text-xs font-mono uppercase tracking-wider text-crimson hover:text-crimson-dark">
              Delete
            </button>
          </form>
        )}
      </div>

      <ArchiveConfirmModal open={archiveOpen} onClose={() => setArchiveOpen(false)} season={season} />
    </div>
  );
}

function ArchiveConfirmModal({ open, onClose, season }: { open: boolean; onClose: () => void; season: SeasonRow }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = async () => {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set('id', season.id);
    const res = await archiveSeason(fd);
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Failed.');
  };

  return (
    <Modal open={open} onClose={onClose} title={`Archive "${season.name}"?`} description="Archiving locks all data in this season as read-only. You can still view it; you can't edit.">
      <div className="flex flex-col gap-4">
        <div className="bg-sand-50 border border-sand-100 rounded-xl p-4 text-xs text-ink-dim leading-relaxed">
          <div className="font-medium text-ink mb-2">This season contains:</div>
          <ul className="space-y-1">
            <li>&bull; {season.plan_count} goal plan{season.plan_count === 1 ? '' : 's'}</li>
            <li>&bull; {season.activity_count} activit{season.activity_count === 1 ? 'y' : 'ies'}</li>
            <li>&bull; {season.enrollment_count} enrolled student{season.enrollment_count === 1 ? '' : 's'}</li>
          </ul>
        </div>

        <div className="bg-crimson/5 border border-crimson/20 rounded-xl p-4 text-xs text-ink leading-relaxed">
          <div className="font-medium text-crimson mb-2">After archiving:</div>
          <ul className="space-y-1">
            <li>&bull; No one (including admin) can edit data in this season</li>
            <li>&bull; All users can still view the data for reference</li>
            <li>&bull; To add new plans / activities, first create or activate another season</li>
            <li>&bull; The current-season flag will be cleared; set another season as current afterward</li>
          </ul>
        </div>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="button" onClick={handleArchive} disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Archiving\u2026' : 'Archive season'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function NewSeasonModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setError(null);
    const res = await createSeason(formData);
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Failed.');
  };

  return (
    <Modal open={open} onClose={onClose} title="New season" description="Create a named period with start and end dates.">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Name" required help="e.g. 2025-26 Season, Summer Camp 2026">
          <input type="text" name="name" required placeholder="2026-27 Season" className="input-base" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start date" required>
            <input type="date" name="starts_on" required className="input-base" />
          </FormField>
          <FormField label="End date" required>
            <input type="date" name="ends_on" required className="input-base" />
          </FormField>
        </div>

        <div className="text-xs text-ink-faint italic">
          The new season starts empty. After creating it, click <strong className="text-ink">Activate</strong> to make it the current season, then enroll students via the Students page.
        </div>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Creating\u2026' : 'Create season'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
