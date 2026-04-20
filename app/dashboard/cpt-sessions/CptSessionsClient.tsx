'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createCptSession } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { CompositePerformanceTest } from '@/lib/supabase/types';
import type { CptSessionRow } from './page';

type CompositeLite = Pick<CompositePerformanceTest, 'id' | 'title' | 'description' | 'active'>;

interface Props {
  sessions: CptSessionRow[];
  composites: CompositeLite[];
  seasonId: string | null;
  seasonArchived: boolean;
  addOnly?: boolean;
}

export function CptSessionsClient({ sessions, composites, seasonId, seasonArchived, addOnly }: Props) {
  const [open, setOpen] = useState(false);

  if (addOnly) {
    const disabled = seasonArchived || !seasonId || composites.length === 0;
    const reason = seasonArchived
      ? 'This season is archived — read-only'
      : !seasonId
      ? 'No active season'
      : composites.length === 0
      ? 'No composite tests defined — ask admin to create one'
      : '';
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="btn-primary !h-10 !px-4 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
          title={reason}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New session
        </button>
        <NewSessionModal
          open={open} onClose={() => setOpen(false)}
          composites={composites} seasonId={seasonId}
        />
      </>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No CPT sessions recorded yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          Start a new session above. Pick a composite, set the date, and mark it as the season baseline if this is the first round of testing.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card-base overflow-hidden">
        {sessions.map((s, idx) => <SessionRow key={s.id} session={s} first={idx === 0} />)}
      </div>
      <NewSessionModal
        open={open} onClose={() => setOpen(false)}
        composites={composites} seasonId={seasonId}
      />
    </>
  );
}

function SessionRow({ session, first }: { session: CptSessionRow; first: boolean }) {
  return (
    <Link href={`/dashboard/cpt-sessions/${session.id}`}
      className={`flex items-center gap-4 px-5 py-4 group ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="flex-shrink-0 w-20 text-right">
        <div className="font-serif text-sm text-ink">{formatDate(session.session_date)}</div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          {session.is_baseline && (
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-sage text-paper">
              Baseline
            </span>
          )}
          <span className="font-medium text-ink group-hover:text-crimson transition-colors">
            {session.composite_title}
          </span>
        </div>
        {session.conditions_notes && (
          <div className="text-xs text-ink-faint truncate">{session.conditions_notes}</div>
        )}
      </div>

      <div className="flex-shrink-0 text-right">
        <div className="font-mono text-sm text-ink">{session.results_count}</div>
        <div className="kicker text-[9px] mt-0.5">Results</div>
      </div>
    </Link>
  );
}

function NewSessionModal({ open, onClose, composites, seasonId }: {
  open: boolean; onClose: () => void; composites: CompositeLite[]; seasonId: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setError(null);
    if (seasonId) formData.set('season_id', seasonId);
    const res = await createCptSession(formData);
    setSaving(false);
    if (res.ok && res.id) {
      router.push(`/dashboard/cpt-sessions/${res.id}`);
    } else {
      setError(res.error ?? 'Failed.');
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal open={open} onClose={onClose} title="Start a CPT session"
      description="Pick a composite test and date. Record individual results on the next screen.">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Composite test" required>
          <select name="composite_id" required defaultValue="" className="input-base">
            <option value="" disabled>Select a composite test…</option>
            {composites.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Session date" required>
          <input type="date" name="session_date" defaultValue={today} required className="input-base" />
        </FormField>

        <FormField label="Conditions / notes">
          <textarea name="conditions_notes" rows={2}
            placeholder="Indoor, dry, warmup completed…"
            className="input-base resize-none" />
        </FormField>

        <label className="flex items-start gap-3 p-3 bg-sand-50 rounded border border-ink-hair cursor-pointer">
          <input type="checkbox" name="is_baseline" className="mt-0.5" />
          <div>
            <div className="text-sm font-medium text-ink">Mark as season baseline</div>
            <div className="text-xs text-ink-faint mt-0.5">
              Only one session per composite per season can be the baseline. Future sessions will show % change relative to it.
            </div>
          </div>
        </label>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Creating\u2026' : 'Start session'}
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
