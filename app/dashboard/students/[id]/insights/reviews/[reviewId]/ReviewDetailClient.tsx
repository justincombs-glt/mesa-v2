'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateReview, deleteReview, finalizeReview, upsertReviewGoalRating } from '@/app/actions';
import { FormField } from '@/components/ui/FormField';
import type { Review, GoalRating } from '@/lib/supabase/types';
import type { StudentInsights } from '@/lib/student-insights';
import type { ResolvedRating } from './page';

interface Props {
  review: Review;
  ratings: ResolvedRating[];
  snapshot: StudentInsights | null;
  reviewerName: string | null;
  studentId: string;
}

export function ReviewDetailClient({ review, ratings, snapshot, reviewerName, studentId }: Props) {
  const isLocked = !!review.finalized_at;

  return (
    <div className="flex flex-col gap-10">
      <StatusBar review={review} reviewerName={reviewerName} studentId={studentId} />
      <NotesSection review={review} readOnly={isLocked} />
      <GoalRatingsSection ratings={ratings} readOnly={isLocked} />
      {snapshot && <SnapshotSummary snapshot={snapshot} />}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Status bar (finalize / delete)
// ----------------------------------------------------------------------------

function StatusBar({ review, reviewerName, studentId }: { review: Review; reviewerName: string | null; studentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'idle' | 'finalizing' | 'deleting'>('idle');
  const [error, setError] = useState<string | null>(null);

  const isLocked = !!review.finalized_at;

  const handleFinalize = async () => {
    if (!confirm('Finalize this review? Once finalized, the review and its goal ratings can no longer be edited.')) return;
    setBusy('finalizing');
    setError(null);
    const fd = new FormData();
    fd.set('id', review.id);
    const res = await finalizeReview(fd);
    setBusy('idle');
    if (!res.ok) setError(res.error ?? 'Could not finalize.');
    else router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this review? This cannot be undone.')) return;
    setBusy('deleting');
    setError(null);
    const fd = new FormData();
    fd.set('id', review.id);
    const res = await deleteReview(fd);
    setBusy('idle');
    if (res.ok) router.push(`/dashboard/students/${studentId}/insights`);
    else setError(res.error ?? 'Could not delete.');
  };

  return (
    <section className="card-base p-5 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div className="kicker mb-1">Status</div>
        <div className="flex items-center gap-2">
          {isLocked ? (
            <span className="text-[10px] font-mono tracking-[0.15em] uppercase px-2 py-0.5 rounded bg-ink text-paper">
              Finalized
            </span>
          ) : (
            <span className="text-[10px] font-mono tracking-[0.15em] uppercase px-2 py-0.5 rounded bg-sand-100 text-ink">
              Draft
            </span>
          )}
          <span className="text-sm text-ink-dim">
            {isLocked
              ? `Finalized on ${formatDateTime(review.finalized_at ?? '')}`
              : 'Editable until finalized'}
          </span>
          {reviewerName && (
            <span className="text-xs text-ink-faint">· by {reviewerName}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-crimson">{error}</span>}
        {!isLocked && (
          <>
            <button onClick={handleFinalize} disabled={busy !== 'idle'}
              className="btn-primary !h-9 text-xs">
              {busy === 'finalizing' ? 'Finalizing…' : 'Finalize'}
            </button>
            <button onClick={handleDelete} disabled={busy !== 'idle'}
              className="text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson">
              Delete
            </button>
          </>
        )}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Notes (summary, concerns, next steps)
// ----------------------------------------------------------------------------

function NotesSection({ review, readOnly }: { review: Review; readOnly: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (fd: FormData) => {
    fd.set('id', review.id);
    if (review.plan_id) fd.set('plan_id', review.plan_id);
    setSaving(true);
    setError(null);
    const res = await updateReview(fd);
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(res.error ?? 'Could not save notes.');
    }
  };

  if (!editing) {
    const hasNotes = review.summary || review.concerns || review.next_steps;
    return (
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="kicker">Notes</div>
          {!readOnly && (
            <button onClick={() => setEditing(true)} className="btn-secondary !h-9 text-xs">
              {hasNotes ? 'Edit notes' : '+ Add notes'}
            </button>
          )}
        </div>
        {!hasNotes ? (
          <div className="card-base p-6 text-center text-sm text-ink-dim">
            No notes added yet.
          </div>
        ) : (
          <div className="card-base p-5 flex flex-col gap-4">
            {review.summary && (
              <NoteField label="Summary" body={review.summary} />
            )}
            {review.concerns && (
              <NoteField label="Concerns" body={review.concerns} />
            )}
            {review.next_steps && (
              <NoteField label="Next steps" body={review.next_steps} />
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="kicker mb-3">Edit notes</div>
      <form action={handleSubmit} className="card-base p-5 flex flex-col gap-4">
        <FormField label="Summary">
          <textarea name="summary" defaultValue={review.summary ?? ''} rows={3} className="input-base resize-none" />
        </FormField>
        <FormField label="Concerns">
          <textarea name="concerns" defaultValue={review.concerns ?? ''} rows={3} className="input-base resize-none" />
        </FormField>
        <FormField label="Next steps">
          <textarea name="next_steps" defaultValue={review.next_steps ?? ''} rows={3} className="input-base resize-none" />
        </FormField>
        {error && <div className="text-sm text-crimson">{error}</div>}
        <div className="flex justify-end gap-2 pt-3 border-t border-ink-hair">
          <button type="button" onClick={() => setEditing(false)} disabled={saving}
            className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </form>
    </section>
  );
}

function NoteField({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="kicker text-[9px] mb-1">{label}</div>
      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{body}</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Per-goal ratings
// ----------------------------------------------------------------------------

function GoalRatingsSection({ ratings, readOnly }: { ratings: ResolvedRating[]; readOnly: boolean }) {
  if (ratings.length === 0) {
    return (
      <section>
        <div className="kicker mb-3">Goal ratings</div>
        <div className="card-base p-6 text-center text-sm text-ink-dim">
          No goals were active when this review was captured.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="kicker mb-3">Goal ratings · {ratings.length}</div>
      <div className="flex flex-col gap-2">
        {ratings.map((r) => <RatingRow key={r.id} rating={r} readOnly={readOnly} />)}
      </div>
    </section>
  );
}

function RatingRow({ rating, readOnly }: { rating: ResolvedRating; readOnly: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localRating, setLocalRating] = useState<GoalRating | ''>(rating.rating ?? '');
  const [localNote, setLocalNote] = useState(rating.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set('review_id', rating.review_id);
    fd.set('goal_id', rating.goal_id);
    fd.set('rating', localRating);
    fd.set('note', localNote);
    const res = await upsertReviewGoalRating(fd);
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(res.error ?? 'Could not save rating.');
    }
  };

  return (
    <div className="card-base p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink">{rating.goal_title}</div>
          {rating.plan_title && (
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-0.5">
              {rating.plan_title}
            </div>
          )}
          {rating.auto_pct !== null && (
            <div className="text-xs text-ink-dim mt-1 font-mono">
              Auto-computed at review time: {rating.auto_pct}%
            </div>
          )}
          {!editing && rating.note && (
            <div className="text-sm text-ink-dim mt-2 italic whitespace-pre-wrap">{rating.note}</div>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-3">
          {!editing && rating.rating && <RatingBadge rating={rating.rating} />}
          {!readOnly && !editing && (
            <button onClick={() => setEditing(true)}
              className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-ink">
              {rating.rating ? 'Edit' : '+ Rate'}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 pt-3 border-t border-ink-hair flex flex-col gap-3">
          <FormField label="Rating">
            <select value={localRating} onChange={(e) => setLocalRating(e.target.value as GoalRating | '')}
              className="input-base">
              <option value="">— no rating —</option>
              <option value="on_track">On track</option>
              <option value="behind">Behind</option>
              <option value="met">Met</option>
              <option value="not_met">Not met</option>
            </select>
          </FormField>
          <FormField label="Note (optional)">
            <textarea value={localNote} onChange={(e) => setLocalNote(e.target.value)} rows={2}
              className="input-base resize-none" />
          </FormField>
          {error && <div className="text-xs text-crimson">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setLocalRating(rating.rating ?? ''); setLocalNote(rating.note ?? ''); }}
              disabled={saving} className="btn-secondary !h-8 text-xs">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary !h-8 text-xs">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RatingBadge({ rating }: { rating: GoalRating }) {
  const color = rating === 'on_track' ? 'bg-sage text-paper'
    : rating === 'met' ? 'bg-sage-dark text-paper'
    : rating === 'behind' ? 'bg-sand-200 text-ink'
    : 'bg-crimson text-paper';
  const label = rating === 'on_track' ? 'On track'
    : rating === 'met' ? 'Met'
    : rating === 'behind' ? 'Behind'
    : 'Not met';
  return (
    <span className={`text-[10px] font-mono tracking-[0.15em] uppercase px-2 py-0.5 rounded ${color}`}>
      {label}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Snapshot summary (read-only display of frozen StudentInsights)
// ----------------------------------------------------------------------------

function SnapshotSummary({ snapshot }: { snapshot: StudentInsights }) {
  const totalGoals = snapshot.plans.reduce((acc, pg) => acc + pg.goals.length, 0);
  const goalsAchieved = snapshot.plans.reduce(
    (acc, pg) => acc + pg.goals.filter((g) => g.status === 'achieved').length, 0,
  );

  return (
    <section>
      <div className="kicker mb-3">Snapshot at time of review</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SnapCard label="Season" value={snapshot.seasonName ?? 'All time'}
          sub={snapshot.attendance.overall_total > 0
            ? `${snapshot.attendance.overall_present}/${snapshot.attendance.overall_total} attended`
            : 'No tracked activities'} />
        <SnapCard label="Attendance"
          value={snapshot.attendance.overall_pct !== null ? `${snapshot.attendance.overall_pct}%` : '—'}
          sub={snapshot.attendance.overall_pct !== null ? 'Captured' : 'No data'} />
        <SnapCard label="Goals" value={`${goalsAchieved}/${totalGoals}`}
          sub={`${goalsAchieved} achieved`} />
        <SnapCard label="Workouts" value={String(snapshot.workout.total_workouts_attended)}
          sub={snapshot.workout.average_rpe !== null ? `Avg RPE ${snapshot.workout.average_rpe}` : 'No RPE'} />
      </div>

      {snapshot.testTrends.length > 0 && (
        <div className="card-base overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono tracking-wider uppercase text-ink-faint border-b border-ink-hair">
                <th className="text-left px-4 py-2.5 font-medium">Test</th>
                <th className="text-right px-2 py-2.5 font-medium">Baseline</th>
                <th className="text-right px-2 py-2.5 font-medium">Latest</th>
                <th className="text-right px-2 py-2.5 font-medium">Δ</th>
                <th className="text-right px-2 py-2.5 font-medium">N</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.testTrends.map((t, idx) => (
                <tr key={t.test_id} className={idx > 0 ? 'border-t border-ink-hair' : ''}>
                  <td className="px-4 py-2.5">
                    <div className="text-ink">{t.test_title}</div>
                    {t.test_unit && (
                      <div className="text-[9px] font-mono uppercase tracking-wider text-ink-faint mt-0.5">{t.test_unit}</div>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-ink">{t.baseline ?? '—'}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-ink">{t.latest ?? '—'}</td>
                  <td className={`px-2 py-2.5 text-right font-mono ${
                    t.pct_change_from_baseline === null ? 'text-ink-faint' :
                    t.pct_change_from_baseline > 0 ? 'text-sage-dark' :
                    t.pct_change_from_baseline < 0 ? 'text-crimson' :
                    'text-ink-faint'
                  }`}>
                    {t.pct_change_from_baseline === null ? '—' :
                     `${t.pct_change_from_baseline > 0 ? '+' : ''}${t.pct_change_from_baseline}%`}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-ink-faint text-xs">
                    {t.results.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SnapCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card-base p-4">
      <div className="kicker text-[9px] mb-1.5">{label}</div>
      <div className="font-serif text-2xl text-ink leading-tight">{value}</div>
      <div className="text-[10px] font-mono text-ink-faint mt-1">{sub}</div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
