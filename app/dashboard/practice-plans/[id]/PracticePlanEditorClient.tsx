'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePracticePlan, deletePracticePlan, createDrill } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { PracticePlan, Drill } from '@/lib/supabase/types';
import type { ResolvedItem } from './page';

type AvailableDrill = Pick<Drill, 'id' | 'title' | 'category' | 'duration_minutes'>;

// Internal item shape used by the editor
interface EditorItem {
  key: string; // local-only key for stable React keys during reorder
  item_type: 'drill' | 'skill';
  drill?: AvailableDrill;
  drill_id?: string | null;
  skill_title?: string | null;
  duration_override?: number | null;
  coach_notes?: string | null;
}

interface Props {
  plan: PracticePlan;
  initialItems: ResolvedItem[];
  availableDrills: AvailableDrill[];
}

let nextKeyId = 0;
const newKey = () => {
  nextKeyId += 1;
  return `item-${Date.now()}-${nextKeyId}`;
};

function fromResolved(items: ResolvedItem[]): EditorItem[] {
  return items.map((r) => ({
    key: newKey(),
    item_type: r.item_type,
    drill: r.drill,
    drill_id: r.drill?.id ?? null,
    skill_title: r.skill_title ?? null,
    duration_override: r.duration_override,
    coach_notes: r.coach_notes,
  }));
}

export function PracticePlanEditorClient({ plan, initialItems, availableDrills }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<EditorItem[]>(fromResolved(initialItems));
  const [title, setTitle] = useState(plan.title);
  const [description, setDescription] = useState(plan.description ?? '');
  const [focus, setFocus] = useState(plan.focus ?? '');
  const [duration, setDuration] = useState(plan.duration_minutes?.toString() ?? '');
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [editingNotesIdx, setEditingNotesIdx] = useState<number | null>(null);

  const totalMinutes = items.reduce((sum, it) => {
    const minutes = it.duration_override ?? it.drill?.duration_minutes ?? 0;
    return sum + minutes;
  }, 0);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setItems(next);
  };

  const moveDown = (idx: number) => {
    if (idx === items.length - 1) return;
    const next = [...items];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setItems(next);
  };

  const removeAt = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const addDrill = (drill: AvailableDrill) => {
    setItems([...items, {
      key: newKey(),
      item_type: 'drill',
      drill,
      drill_id: drill.id,
      duration_override: null,
      coach_notes: null,
    }]);
    setPickerOpen(false);
  };

  const addSkill = (title: string, duration: number | null) => {
    if (!title.trim()) return;
    setItems([...items, {
      key: newKey(),
      item_type: 'skill',
      skill_title: title.trim(),
      duration_override: duration,
      coach_notes: null,
    }]);
    setSkillOpen(false);
  };

  const updateNotes = (idx: number, notes: string) => {
    const next = [...items];
    next[idx] = { ...next[idx], coach_notes: notes };
    setItems(next);
  };

  const updateDuration = (idx: number, durStr: string) => {
    const next = [...items];
    const dur = durStr ? parseInt(durStr, 10) : null;
    next[idx] = { ...next[idx], duration_override: dur };
    setItems(next);
  };

  const handleSave = async () => {
    setSaving('saving');
    setError(null);
    const fd = new FormData();
    fd.set('id', plan.id);
    fd.set('title', title);
    fd.set('description', description);
    fd.set('focus', focus);
    fd.set('duration_minutes', duration);
    const itemsPayload = items.map((it, idx) => ({
      item_type: it.item_type,
      drill_id: it.item_type === 'drill' ? (it.drill_id ?? null) : null,
      skill_title: it.item_type === 'skill' ? (it.skill_title ?? null) : null,
      duration_override: it.duration_override ?? null,
      coach_notes: it.coach_notes ?? null,
    }));
    fd.set('items', JSON.stringify(itemsPayload));
    const res = await updatePracticePlan(fd);
    if (res.ok) {
      setSaving('saved');
      setTimeout(() => setSaving('idle'), 2000);
    } else {
      setSaving('error');
      setError(res.error ?? 'Could not save.');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete plan "${plan.title}"? This cannot be undone.`)) return;
    const fd = new FormData();
    fd.set('id', plan.id);
    await deletePracticePlan(fd);
    router.push('/dashboard/practice-plans');
  };

  return (
    <div className="grid md:grid-cols-5 gap-8">
      {/* Left: plan metadata */}
      <div className="md:col-span-2">
        <div className="kicker mb-4">Plan details</div>
        <div className="card-base p-6 flex flex-col gap-4">
          <FormField label="Title" required>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="input-base" />
          </FormField>
          <FormField label="Focus">
            <input type="text" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="One-line emphasis" className="input-base" />
          </FormField>
          <FormField label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input-base resize-none" />
          </FormField>
          <FormField label="Target duration (min)" help={`Items currently total ${totalMinutes} min`}>
            <input type="number" inputMode="decimal" value={duration} onChange={(e) => setDuration(e.target.value)} min="15" max="180" className="input-base" />
          </FormField>

          {error && <div className="text-sm text-crimson">{error}</div>}

          <div className="flex justify-between items-center gap-2 pt-4 border-t border-ink-hair">
            <button type="button" onClick={handleDelete} className="text-xs text-crimson hover:text-crimson-dark font-mono uppercase tracking-wider">
              Delete plan
            </button>
            <div className="flex items-center gap-3">
              {saving === 'saved' && <span className="text-sm text-sage-dark">✓ Saved</span>}
              <button type="button" onClick={handleSave} disabled={saving === 'saving'} className="btn-primary !h-10 text-[13px]">
                {saving === 'saving' ? 'Saving\u2026' : 'Save plan'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: items list */}
      <div className="md:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <div className="kicker">Items · {items.length}</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPickerOpen(true)} className="btn-secondary !h-9 text-xs">
              + Drill
            </button>
            <button type="button" onClick={() => setSkillOpen(true)} className="btn-secondary !h-9 text-xs">
              + Skill
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="card-base p-8 text-center">
            <p className="text-sm text-ink-dim">
              Empty plan. Add drills from the library or free-text skills.
            </p>
          </div>
        ) : (
          <ol className="card-base overflow-hidden">
            {items.map((item, idx) => (
              <li key={item.key} className={`flex items-start gap-3 px-4 py-3.5 ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
                <span className="font-mono text-sm text-ink-faint w-5 text-right flex-shrink-0 mt-0.5">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${
                      item.item_type === 'drill'
                        ? 'bg-ink text-paper'
                        : 'bg-sand-100 text-ink border border-sand-200'
                    }`}>
                      {item.item_type}
                    </span>
                    <span className="text-sm text-ink font-medium">
                      {item.item_type === 'drill' ? (item.drill?.title ?? '(missing drill)') : item.skill_title}
                    </span>
                    {item.item_type === 'drill' && item.drill?.category && (
                      <span className="text-[10px] text-ink-faint capitalize">{item.drill.category.replace('_', ' ')}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap mt-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-ink-faint">
                      Duration:
                      <input
                        type="number" inputMode="decimal"
                        value={item.duration_override ?? ''}
                        onChange={(e) => updateDuration(idx, e.target.value)}
                        placeholder={item.drill?.duration_minutes?.toString() ?? '—'}
                        min="1" max="90"
                        className="input-base !h-7 !w-16 !px-2 text-xs"
                      />
                      <span>min</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditingNotesIdx(editingNotesIdx === idx ? null : idx)}
                      className="text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson"
                    >
                      {item.coach_notes ? 'Edit notes' : '+ Notes'}
                    </button>
                  </div>

                  {editingNotesIdx === idx && (
                    <textarea
                      value={item.coach_notes ?? ''}
                      onChange={(e) => updateNotes(idx, e.target.value)}
                      placeholder="Coach notes for this item…"
                      rows={2}
                      className="input-base resize-none mt-2 text-xs"
                    />
                  )}

                  {editingNotesIdx !== idx && item.coach_notes && (
                    <div className="text-[11px] text-ink-dim italic mt-1.5 leading-relaxed">{item.coach_notes}</div>
                  )}
                </div>

                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="w-7 h-6 rounded border border-ink-hair bg-paper hover:bg-ivory disabled:opacity-30 disabled:cursor-not-allowed text-[10px]"
                    title="Move up"
                  >↑</button>
                  <button
                    type="button"
                    onClick={() => moveDown(idx)}
                    disabled={idx === items.length - 1}
                    className="w-7 h-6 rounded border border-ink-hair bg-paper hover:bg-ivory disabled:opacity-30 disabled:cursor-not-allowed text-[10px]"
                    title="Move down"
                  >↓</button>
                  <button
                    type="button"
                    onClick={() => removeAt(idx)}
                    className="w-7 h-6 rounded border border-ink-hair bg-paper hover:bg-crimson/10 hover:border-crimson text-[10px] text-ink-faint hover:text-crimson"
                    title="Remove"
                  >×</button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="text-[11px] text-ink-faint italic mt-3 px-2">
          Changes auto-save when you click <strong className="text-ink">Save plan</strong> on the left.
        </div>
      </div>

      <DrillPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} drills={availableDrills} onPick={addDrill} />
      <SkillModal open={skillOpen} onClose={() => setSkillOpen(false)} onAdd={addSkill} />
    </div>
  );
}

function DrillPickerModal({ open, onClose, drills, onPick }: { open: boolean; onClose: () => void; drills: AvailableDrill[]; onPick: (d: AvailableDrill) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'pick' | 'create'>('pick');

  const filtered = drills.filter((d) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (d.title + ' ' + d.category).toLowerCase().includes(q);
  });

  const handleClose = () => {
    onClose();
    // Reset state after close animation
    setTimeout(() => { setMode('pick'); setQuery(''); }, 200);
  };

  const handleCreated = (newDrill: AvailableDrill) => {
    // Add to plan
    onPick(newDrill);
    // Refresh server-side availableDrills list so it shows up if picker opens again
    router.refresh();
    // Close modal (onPick also closes but the timing of router.refresh means we explicitly do this too)
    setMode('pick');
  };

  if (mode === 'create') {
    return (
      <Modal open={open} onClose={handleClose} title="New drill" description="Adds to your drill library AND to this plan as the next item." maxWidth="540px">
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setMode('pick')}
            className="text-xs font-mono uppercase tracking-wider text-ink-faint hover:text-ink flex items-center gap-1.5"
          >
            ← Back to picker
          </button>
        </div>
        <CreateDrillForm onCreated={handleCreated} onCancel={handleClose} />
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add a drill" description="Pick from your drill library, or create a new one." maxWidth="540px">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drills…"
            className="input-base flex-1"
          />
          <button
            type="button"
            onClick={() => setMode('create')}
            className="btn-secondary !h-10 !px-3 text-[13px] whitespace-nowrap"
          >
            + New
          </button>
        </div>

        {drills.length === 0 ? (
          <div className="card-base p-6 text-center">
            <p className="text-sm text-ink-dim mb-4">
              No drills in the library yet.
            </p>
            <button
              type="button"
              onClick={() => setMode('create')}
              className="btn-primary !h-10 text-[13px]"
            >
              Create your first drill
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-base p-4 text-center">
            <p className="text-sm text-ink-dim mb-3">No matches.</p>
            <button
              type="button"
              onClick={() => setMode('create')}
              className="text-xs font-mono uppercase tracking-wider text-crimson hover:text-crimson-dark"
            >
              + Create a new drill
            </button>
          </div>
        ) : (
          <div className="card-base overflow-hidden max-h-[50vh] overflow-y-auto">
            {filtered.map((d, idx) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onPick(d)}
                className={`w-full text-left flex items-center justify-between gap-3 px-4 py-3 hover:bg-ivory ${idx > 0 ? 'border-t border-ink-hair' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">{d.title}</div>
                  <div className="text-xs text-ink-faint capitalize mt-0.5">{d.category.replace('_', ' ')}</div>
                </div>
                {d.duration_minutes && (
                  <span className="text-xs font-mono text-ink-faint flex-shrink-0">{d.duration_minutes} min</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function CreateDrillForm({ onCreated, onCancel }: { onCreated: (drill: AvailableDrill) => void; onCancel: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CATEGORIES = ['skating', 'passing', 'shooting', 'stickhandling', 'defense', 'goalie', 'small_area', 'conditioning', 'warmup'];

  const handleSubmit = async (fd: FormData) => {
    setSaving(true);
    setError(null);

    const title = String(fd.get('title') ?? '').trim();
    const category = String(fd.get('category') ?? '').trim();
    const duration_str = String(fd.get('duration_minutes') ?? '').trim();
    const duration_minutes = duration_str ? parseInt(duration_str, 10) : null;

    const res = await createDrill(fd);
    setSaving(false);

    if (res.ok && res.id) {
      // Hand the caller the new drill as AvailableDrill shape
      onCreated({
        id: res.id,
        title,
        category,
        duration_minutes,
      });
    } else {
      setError(res.error ?? 'Could not create drill.');
    }
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Title" required>
        <input type="text" name="title" required placeholder="e.g. Crossovers" className="input-base" autoFocus />
      </FormField>

      <FormField label="Category" required>
        <select name="category" required defaultValue="" className="input-base capitalize">
          <option value="" disabled>Choose&hellip;</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">{c.replace('_', ' ')}</option>
          ))}
        </select>
      </FormField>

      <FormField label="Description">
        <textarea name="description" rows={2} className="input-base resize-none" />
      </FormField>

      <FormField label="Instructions">
        <textarea name="instructions" rows={3} className="input-base resize-none" />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Duration (min)">
          <input type="number" inputMode="decimal" name="duration_minutes" min="1" max="90" placeholder="15" className="input-base" />
        </FormField>
        <FormField label="Age groups" help="Comma-separated">
          <input type="text" name="age_groups" placeholder="U12, U14" className="input-base" />
        </FormField>
      </div>

      <FormField label="Equipment" help="Comma-separated">
        <input type="text" name="equipment" placeholder="pucks, cones" className="input-base" />
      </FormField>

      {error && <div className="text-sm text-crimson">{error}</div>}

      <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
        <button type="button" onClick={onCancel} className="btn-secondary !h-10 text-[13px]">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
          {saving ? 'Creating\u2026' : 'Create & add to plan'}
        </button>
      </div>
    </form>
  );
}

function SkillModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (title: string, duration: number | null) => void }) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd(title, duration ? parseInt(duration, 10) : null);
    setTitle('');
    setDuration('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a skill" description='A free-text item with no formal drill attached. e.g. "Power skating", "Edge work."'>
      <div className="flex flex-col gap-4">
        <FormField label="Skill name" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Edge work"
            className="input-base"
            autoFocus
          />
        </FormField>
        <FormField label="Duration (min)">
          <input type="number" inputMode="decimal" value={duration} onChange={(e) => setDuration(e.target.value)} min="1" max="90" className="input-base" />
        </FormField>

        <div className="flex justify-end gap-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="button" onClick={handleAdd} disabled={!title.trim()} className="btn-primary !h-10 text-[13px]">
            Add skill
          </button>
        </div>
      </div>
    </Modal>
  );
}
