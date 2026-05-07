'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateWorkoutPlan, deleteWorkoutPlan,
  addWorkoutPlanItem, updateWorkoutPlanItem, deleteWorkoutPlanItem,
  reorderWorkoutPlanItems,
} from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { WorkoutPlan, Exercise } from '@/lib/supabase/types';
import type { ResolvedPlanItem } from './page';

type ExerciseLite = Pick<Exercise, 'id' | 'title' | 'category' | 'active'>;

interface Props {
  plan: WorkoutPlan;
  items: ResolvedPlanItem[];
  exercises: ExerciseLite[];
}

export function WorkoutPlanDetailClient({ plan, items, exercises }: Props) {
  return (
    <div className="flex flex-col gap-10">
      <MetaSection plan={plan} />
      <ItemsSection planId={plan.id} items={items} exercises={exercises} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Meta edit
// ----------------------------------------------------------------------------

function MetaSection({ plan }: { plan: WorkoutPlan }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (fd: FormData) => {
    fd.set('id', plan.id);
    setSaving('saving');
    setError(null);
    const res = await updateWorkoutPlan(fd);
    if (res.ok) {
      setSaving('saved');
      setTimeout(() => { setSaving('idle'); setEditing(false); }, 1000);
    } else {
      setSaving('error');
      setError(res.error ?? 'Failed.');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this plan? All items will be lost.')) return;
    const fd = new FormData();
    fd.set('id', plan.id);
    await deleteWorkoutPlan(fd);
    router.push('/dashboard/workout-plans');
  };

  if (!editing) {
    return (
      <section className="flex items-center justify-end gap-2 pb-2 -mt-4">
        <button onClick={() => setEditing(true)} className="btn-secondary !h-9 text-xs">
          Edit plan
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="kicker mb-4">Edit plan</div>
      <form action={handleSave} className="card-base p-6 flex flex-col gap-4">
        <FormField label="Title" required>
          <input type="text" name="title" defaultValue={plan.title} required className="input-base" />
        </FormField>
        <FormField label="Focus">
          <input type="text" name="focus" defaultValue={plan.focus ?? ''} className="input-base" />
        </FormField>
        <FormField label="Duration (min)">
          <input type="number" inputMode="decimal" name="duration_minutes" defaultValue={plan.duration_minutes ?? ''} min="0" className="input-base" />
        </FormField>
        <FormField label="Description">
          <textarea name="description" defaultValue={plan.description ?? ''} rows={2} className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-between items-center pt-4 border-t border-ink-hair">
          <button type="button" onClick={handleDelete}
            className="text-xs text-crimson hover:text-crimson-dark font-mono uppercase tracking-wider">
            Delete plan
          </button>
          <div className="flex items-center gap-3">
            {saving === 'saved' && <span className="text-sm text-sage-dark">✓ Saved</span>}
            <button type="button" onClick={() => setEditing(false)} disabled={saving === 'saving'}
              className="btn-secondary !h-10 text-[13px]">Cancel</button>
            <button type="submit" disabled={saving === 'saving'} className="btn-primary !h-10 text-[13px]">
              {saving === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Items editor
// ----------------------------------------------------------------------------

function ItemsSection({ planId, items, exercises }: {
  planId: string; items: ResolvedPlanItem[]; exercises: ExerciseLite[];
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="kicker">Exercises · {items.length}</div>
        <button onClick={() => setAddOpen(true)}
          disabled={exercises.length === 0}
          className="btn-secondary !h-9 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          title={exercises.length === 0 ? 'No exercises defined yet' : ''}>
          + Add exercise
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            Plan is empty. Click <strong className="text-ink">+ Add exercise</strong> to start building.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item, idx) => (
            <ItemCard key={item.id} item={item} planId={planId}
              isFirst={idx === 0} isLast={idx === items.length - 1}
              allItemIds={items.map((i) => i.id)} />
          ))}
        </div>
      )}

      <AddItemModal open={addOpen} onClose={() => setAddOpen(false)}
        planId={planId} exercises={exercises} />
    </section>
  );
}

function ItemCard({ item, planId, isFirst, isLast, allItemIds }: {
  item: ResolvedPlanItem; planId: string; isFirst: boolean; isLast: boolean; allItemIds: string[];
}) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleMove = async (dir: 'up' | 'down') => {
    const idx = allItemIds.indexOf(item.id);
    if (idx < 0) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= allItemIds.length) return;
    const newOrder = [...allItemIds];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    setBusy(true);
    const fd = new FormData();
    fd.set('plan_id', planId);
    fd.set('ordered_ids', JSON.stringify(newOrder));
    await reorderWorkoutPlanItems(fd);
    setBusy(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm(`Remove ${item.exercise_title} from this plan?`)) return;
    const fd = new FormData();
    fd.set('id', item.id);
    fd.set('plan_id', planId);
    await deleteWorkoutPlanItem(fd);
    router.refresh();
  };

  if (editing) {
    return (
      <EditItemForm item={item} planId={planId}
        onDone={() => { setEditing(false); router.refresh(); }} />
    );
  }

  const targets: string[] = [];
  if (item.default_sets) targets.push(`${item.default_sets} sets`);
  if (item.default_reps) targets.push(`${item.default_reps} reps`);
  if (item.default_weight_lbs) targets.push(`${item.default_weight_lbs} lb`);
  if (item.default_duration_seconds) targets.push(`${item.default_duration_seconds}s`);
  if (item.default_rest_seconds) targets.push(`${item.default_rest_seconds}s rest`);

  return (
    <div className="card-base p-4 flex items-center gap-4">
      <div className="flex-shrink-0 flex flex-col gap-1">
        <button onClick={() => handleMove('up')} disabled={isFirst || busy}
          className="text-ink-faint hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button onClick={() => handleMove('down')} disabled={isLast || busy}
          className="text-ink-faint hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      <div className="flex-shrink-0 font-serif text-xl text-crimson w-8 text-right">{item.sequence + 1}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink">{item.exercise_title}</div>
        {item.exercise_category && (
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-0.5">{item.exercise_category}</div>
        )}
        {targets.length > 0 && (
          <div className="text-xs text-ink-dim mt-1 font-mono">{targets.join(' · ')}</div>
        )}
        {item.coach_notes && (
          <div className="text-xs text-ink-faint mt-1 italic">{item.coach_notes}</div>
        )}
      </div>
      <div className="flex-shrink-0 flex gap-2">
        <button onClick={() => setEditing(true)} className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-ink">
          Edit
        </button>
        <button onClick={handleDelete} className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson">
          Remove
        </button>
      </div>
    </div>
  );
}

function EditItemForm({ item, planId, onDone }: {
  item: ResolvedPlanItem; planId: string; onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (fd: FormData) => {
    fd.set('id', item.id);
    fd.set('plan_id', planId);
    setSaving(true);
    setError(null);
    const res = await updateWorkoutPlanItem(fd);
    setSaving(false);
    if (res.ok) onDone();
    else setError(res.error ?? 'Failed.');
  };

  return (
    <div className="card-base p-4 bg-sand-50">
      <form action={handleSubmit} className="flex flex-col gap-3">
        <div className="text-sm font-medium text-ink mb-1">{item.exercise_title}</div>
        <div className="grid grid-cols-5 gap-2">
          <FormField label="Sets">
            <input type="number" inputMode="decimal" name="default_sets" defaultValue={item.default_sets ?? ''} min="0" className="input-base !h-8 text-xs font-mono" />
          </FormField>
          <FormField label="Reps">
            <input type="number" inputMode="decimal" name="default_reps" defaultValue={item.default_reps ?? ''} min="0" className="input-base !h-8 text-xs font-mono" />
          </FormField>
          <FormField label="Weight (lb)">
            <input type="number" inputMode="decimal" step="0.5" name="default_weight_lbs" defaultValue={item.default_weight_lbs ?? ''} min="0" className="input-base !h-8 text-xs font-mono" />
          </FormField>
          <FormField label="Duration (s)">
            <input type="number" inputMode="decimal" name="default_duration_seconds" defaultValue={item.default_duration_seconds ?? ''} min="0" className="input-base !h-8 text-xs font-mono" />
          </FormField>
          <FormField label="Rest (s)">
            <input type="number" inputMode="decimal" name="default_rest_seconds" defaultValue={item.default_rest_seconds ?? ''} min="0" className="input-base !h-8 text-xs font-mono" />
          </FormField>
        </div>
        <FormField label="Coach notes">
          <textarea name="coach_notes" defaultValue={item.coach_notes ?? ''} rows={2} className="input-base resize-none text-xs" />
        </FormField>
        {error && <div className="text-xs text-crimson">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onDone} disabled={saving} className="btn-secondary !h-8 text-xs">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-8 text-xs">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AddItemModal({ open, onClose, planId, exercises }: {
  open: boolean; onClose: () => void; planId: string; exercises: ExerciseLite[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (fd: FormData) => {
    fd.set('plan_id', planId);
    setSaving(true);
    setError(null);
    const res = await addWorkoutPlanItem(fd);
    setSaving(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      setError(res.error ?? 'Failed.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add exercise to plan"
      description="Pick an exercise and set targets (all optional except the exercise itself).">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Exercise" required>
          <select name="exercise_id" required defaultValue="" className="input-base">
            <option value="" disabled>Select an exercise…</option>
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>{e.title}{e.category ? ` · ${e.category}` : ''}</option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-5 gap-2">
          <FormField label="Sets">
            <input type="number" inputMode="decimal" name="default_sets" min="0" className="input-base !h-9 text-xs font-mono" />
          </FormField>
          <FormField label="Reps">
            <input type="number" inputMode="decimal" name="default_reps" min="0" className="input-base !h-9 text-xs font-mono" />
          </FormField>
          <FormField label="Weight (lb)">
            <input type="number" inputMode="decimal" step="0.5" name="default_weight_lbs" min="0" className="input-base !h-9 text-xs font-mono" />
          </FormField>
          <FormField label="Duration (s)">
            <input type="number" inputMode="decimal" name="default_duration_seconds" min="0" className="input-base !h-9 text-xs font-mono" />
          </FormField>
          <FormField label="Rest (s)">
            <input type="number" inputMode="decimal" name="default_rest_seconds" min="0" className="input-base !h-9 text-xs font-mono" />
          </FormField>
        </div>

        <FormField label="Coach notes">
          <textarea name="coach_notes" rows={2} className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Adding…' : 'Add exercise'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
