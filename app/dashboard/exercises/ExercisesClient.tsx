'use client';

import { useMemo, useState } from 'react';
import { createExercise, updateExercise, deleteExercise } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Exercise } from '@/lib/supabase/types';

const CATEGORIES = ['strength', 'conditioning', 'mobility', 'plyometrics', 'skill', 'core', 'recovery'];

interface Props {
  exercises: Exercise[];
  addOnly?: boolean;
}

export function ExercisesClient({ exercises, addOnly }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(e => {
      if (catFilter !== 'all' && e.category !== catFilter) return false;
      if (!q) return true;
      return (e.title + ' ' + (e.description ?? '')).toLowerCase().includes(q);
    });
  }, [exercises, query, catFilter]);

  if (addOnly) {
    return (
      <>
        <button onClick={() => setAddOpen(true)} className="btn-primary !h-10 !px-4 text-[13px]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add exercise
        </button>
        <ExerciseFormModal open={addOpen} onClose={() => setAddOpen(false)} />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mist pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search exercises…" className="input-base !pl-10" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input-base !w-auto capitalize">
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <h3 className="font-serif text-xl text-ink mb-2">{exercises.length === 0 ? 'No exercises yet' : 'No matches'}</h3>
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            {exercises.length === 0 ? 'Add exercises to build out the trainer library. Start with whatever the academy typically programs.' : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(e => (
            <button key={e.id} onClick={() => setEditing(e)} className="card-base p-5 text-left h-full flex flex-col group">
              <div className="flex justify-between items-start mb-3">
                <div className="kicker capitalize">{e.category}</div>
                {e.default_sets && e.default_reps && (
                  <div className="font-mono text-[10px] text-ink-faint">{e.default_sets} × {e.default_reps}</div>
                )}
              </div>
              <h3 className="font-serif text-lg text-ink leading-tight mb-2 group-hover:text-crimson transition-colors">{e.title}</h3>
              {e.description && <p className="text-sm text-ink-dim leading-relaxed line-clamp-3 flex-1">{e.description}</p>}
            </button>
          ))}
        </div>
      )}

      <ExerciseFormModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ExerciseFormModal open={editing !== null} onClose={() => setEditing(null)} exercise={editing ?? undefined} />
    </>
  );
}

function ExerciseFormModal({ open, onClose, exercise }: { open: boolean; onClose: () => void; exercise?: Exercise }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!exercise;

  const handleSubmit = async (fd: FormData) => {
    setSaving(true);
    setError(null);
    if (isEdit && exercise) fd.set('id', exercise.id);
    const res = await (isEdit ? updateExercise(fd) : createExercise(fd));
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Something went wrong.');
  };

  const handleDelete = async () => {
    if (!exercise || !confirm(`Delete "${exercise.title}"?`)) return;
    const fd = new FormData();
    fd.set('id', exercise.id);
    await deleteExercise(fd);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit exercise' : 'Add an exercise'}>
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Title" required>
          <input type="text" name="title" defaultValue={exercise?.title ?? ''} required placeholder="e.g. Back Squat" className="input-base" />
        </FormField>
        <FormField label="Category" required>
          <select name="category" defaultValue={exercise?.category ?? ''} required className="input-base capitalize">
            <option value="" disabled>Choose&hellip;</option>
            {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </FormField>
        <FormField label="Description">
          <textarea name="description" defaultValue={exercise?.description ?? ''} rows={2} className="input-base resize-none" />
        </FormField>
        <FormField label="Instructions" help="How to perform the exercise — form cues, common mistakes.">
          <textarea name="instructions" defaultValue={exercise?.instructions ?? ''} rows={4} className="input-base resize-none" />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Default sets">
            <input type="number" name="default_sets" defaultValue={exercise?.default_sets ?? ''} min="1" max="20" className="input-base" />
          </FormField>
          <FormField label="Default reps">
            <input type="number" name="default_reps" defaultValue={exercise?.default_reps ?? ''} min="1" max="100" className="input-base" />
          </FormField>
          <FormField label="Duration (sec)" help="For timed exercises">
            <input type="number" name="default_duration_seconds" defaultValue={exercise?.default_duration_seconds ?? ''} min="1" className="input-base" />
          </FormField>
        </div>
        <FormField label="Equipment" help="Comma-separated">
          <input type="text" name="equipment" defaultValue={(exercise?.equipment ?? []).join(', ')} placeholder="barbell, bench" className="input-base" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-between items-center gap-2 mt-2 pt-4 border-t border-ink-hair">
          {isEdit && (
            <button type="button" onClick={handleDelete} className="text-xs text-crimson hover:text-crimson-dark font-mono uppercase tracking-wider">
              Delete
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
              {saving ? 'Saving\u2026' : isEdit ? 'Save' : 'Add exercise'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
