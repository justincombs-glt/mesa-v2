'use client';

import { useMemo, useState } from 'react';
import { createDrill, updateDrill, deleteDrill } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Drill } from '@/lib/supabase/types';

const CATEGORIES = [
  'skating', 'passing', 'shooting', 'stickhandling',
  'defense', 'goalie', 'small_area', 'conditioning', 'warmup',
];

interface Props {
  drills: Drill[];
  addOnly?: boolean;
}

export function DrillsClient({ drills, addOnly }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Drill | null>(null);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drills.filter(d => {
      if (catFilter !== 'all' && d.category !== catFilter) return false;
      if (!q) return true;
      return (d.title + ' ' + (d.description ?? '')).toLowerCase().includes(q);
    });
  }, [drills, query, catFilter]);

  if (addOnly) {
    return (
      <>
        <button onClick={() => setAddOpen(true)} className="btn-primary !h-10 !px-4 text-[13px]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add drill
        </button>
        <DrillFormModal open={addOpen} onClose={() => setAddOpen(false)} />
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
            placeholder="Search drills…" className="input-base !pl-10" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input-base !w-auto capitalize">
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c.replace('_', ' ')}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <h3 className="font-serif text-xl text-ink mb-2">{drills.length === 0 ? 'No drills yet' : 'No matches'}</h3>
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            {drills.length === 0 ? 'Add your first drill to build the academy library.' : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => (
            <button key={d.id} onClick={() => setEditing(d)} className="card-base p-5 text-left h-full flex flex-col group">
              <div className="flex justify-between items-start mb-3">
                <div className="kicker capitalize">{d.category.replace('_', ' ')}</div>
                {d.duration_minutes && <div className="font-mono text-[10px] text-ink-faint">{d.duration_minutes} min</div>}
              </div>
              <h3 className="font-serif text-lg text-ink leading-tight mb-2 group-hover:text-crimson transition-colors">{d.title}</h3>
              {d.description && <p className="text-sm text-ink-dim leading-relaxed line-clamp-3 flex-1">{d.description}</p>}
            </button>
          ))}
        </div>
      )}

      <DrillFormModal open={addOpen} onClose={() => setAddOpen(false)} />
      <DrillFormModal open={editing !== null} onClose={() => setEditing(null)} drill={editing ?? undefined} />
    </>
  );
}

function DrillFormModal({ open, onClose, drill }: { open: boolean; onClose: () => void; drill?: Drill }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!drill;

  const handleSubmit = async (fd: FormData) => {
    setSaving(true);
    setError(null);
    if (isEdit && drill) fd.set('id', drill.id);
    const res = await (isEdit ? updateDrill(fd) : createDrill(fd));
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Something went wrong.');
  };

  const handleDelete = async () => {
    if (!drill || !confirm(`Delete "${drill.title}"?`)) return;
    const fd = new FormData();
    fd.set('id', drill.id);
    await deleteDrill(fd);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit drill' : 'Add a drill'}>
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Title" required>
          <input type="text" name="title" defaultValue={drill?.title ?? ''} required className="input-base" />
        </FormField>
        <FormField label="Category" required>
          <select name="category" defaultValue={drill?.category ?? ''} required className="input-base capitalize">
            <option value="" disabled>Choose&hellip;</option>
            {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c.replace('_', ' ')}</option>)}
          </select>
        </FormField>
        <FormField label="Description">
          <textarea name="description" defaultValue={drill?.description ?? ''} rows={2} className="input-base resize-none" />
        </FormField>
        <FormField label="Instructions">
          <textarea name="instructions" defaultValue={drill?.instructions ?? ''} rows={4} className="input-base resize-none" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Duration (min)">
            <input type="number" name="duration_minutes" defaultValue={drill?.duration_minutes ?? ''} min="1" max="90" className="input-base" />
          </FormField>
          <FormField label="Age groups" help="Comma-separated">
            <input type="text" name="age_groups" defaultValue={(drill?.age_groups ?? []).join(', ')} placeholder="U12, U14" className="input-base" />
          </FormField>
        </div>
        <FormField label="Equipment" help="Comma-separated">
          <input type="text" name="equipment" defaultValue={(drill?.equipment ?? []).join(', ')} placeholder="pucks, cones" className="input-base" />
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
              {saving ? 'Saving\u2026' : isEdit ? 'Save' : 'Add drill'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
