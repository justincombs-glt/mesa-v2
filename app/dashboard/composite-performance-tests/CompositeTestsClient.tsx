'use client';

import { useState } from 'react';
import { createCompositeTest, updateCompositeTest, deleteCompositeTest } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { DOMAIN_LABELS } from '@/lib/goal-taxonomy';
import type { PerformanceTest } from '@/lib/supabase/types';
import type { CompositeWithItems } from './page';

type AvailableTest = Pick<PerformanceTest, 'id' | 'title' | 'domain' | 'unit' | 'direction'>;

interface Props {
  composites: CompositeWithItems[];
  availableTests: AvailableTest[];
  addOnly?: boolean;
}

export function CompositeTestsClient({ composites, availableTests, addOnly }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CompositeWithItems | null>(null);

  if (addOnly) {
    return (
      <>
        <button
          onClick={() => setAddOpen(true)}
          disabled={availableTests.length === 0}
          className="btn-primary !h-10 !px-4 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
          title={availableTests.length === 0 ? 'Create individual performance tests first' : ''}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add composite
        </button>
        <CPTFormModal open={addOpen} onClose={() => setAddOpen(false)} availableTests={availableTests} />
      </>
    );
  }

  if (availableTests.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No individual tests defined yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto mb-6">
          You need individual performance tests first before bundling them into composites.
          Head to <a href="/dashboard/performance-tests" className="text-crimson font-medium">Performance Tests</a> and add some (e.g., 40-yard dash, 1RM squat, vertical jump).
        </p>
      </div>
    );
  }

  if (composites.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No composites yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          Create your first composite performance test. A CPT is a named bundle of individual tests run as a standard session — like a &ldquo;Fall Baseline&rdquo; or &ldquo;Pro Day&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        {composites.map((c) => (
          <button key={c.id} onClick={() => setEditing(c)} className="card-base p-5 text-left h-full flex flex-col group">
            <div className="flex justify-between items-start mb-3 gap-2">
              <h3 className="font-serif text-lg text-ink leading-tight group-hover:text-crimson transition-colors">{c.title}</h3>
              <span className="font-mono text-[10px] text-ink-faint flex-shrink-0">
                {c.items.length} test{c.items.length === 1 ? '' : 's'}
              </span>
            </div>
            {c.description && (
              <p className="text-sm text-ink-dim leading-relaxed line-clamp-2 mb-3">{c.description}</p>
            )}
            <ol className="flex flex-col gap-1.5 mt-auto pt-3 border-t border-ink-hair text-xs">
              {c.items.slice(0, 6).map((it, idx) => (
                <li key={it.id} className="flex items-center gap-2">
                  <span className="font-mono text-ink-faint w-4 text-right">{idx + 1}</span>
                  <span className="text-ink truncate">{it.test.title}</span>
                  {it.test.unit && <span className="text-ink-faint">{it.test.unit}</span>}
                </li>
              ))}
              {c.items.length > 6 && (
                <li className="text-ink-faint italic pl-6">+{c.items.length - 6} more</li>
              )}
            </ol>
          </button>
        ))}
      </div>

      <CPTFormModal open={addOpen} onClose={() => setAddOpen(false)} availableTests={availableTests} />
      <CPTFormModal open={editing !== null} onClose={() => setEditing(null)} availableTests={availableTests} composite={editing ?? undefined} />
    </>
  );
}

function CPTFormModal({
  open, onClose, availableTests, composite,
}: {
  open: boolean;
  onClose: () => void;
  availableTests: AvailableTest[];
  composite?: CompositeWithItems;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected test IDs in sequence order
  const [selectedIds, setSelectedIds] = useState<string[]>(
    composite ? composite.items.sort((a, b) => a.sequence - b.sequence).map((i) => i.test.id) : []
  );

  const isEdit = !!composite;

  const availableUnselected = availableTests.filter((t) => !selectedIds.includes(t.id));

  const addTest = (testId: string) => {
    if (!selectedIds.includes(testId)) {
      setSelectedIds([...selectedIds, testId]);
    }
  };

  const removeAt = (index: number) => {
    setSelectedIds(selectedIds.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...selectedIds];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setSelectedIds(next);
  };

  const moveDown = (index: number) => {
    if (index === selectedIds.length - 1) return;
    const next = [...selectedIds];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setSelectedIds(next);
  };

  const handleSubmit = async (fd: FormData) => {
    setSaving(true);
    setError(null);
    if (isEdit && composite) fd.set('id', composite.id);
    const items = selectedIds.map((test_id, idx) => ({ test_id, sequence: idx }));
    fd.set('items', JSON.stringify(items));

    const res = await (isEdit ? updateCompositeTest(fd) : createCompositeTest(fd));
    setSaving(false);
    if (res.ok) {
      onClose();
      // Reset local state for next open
      setSelectedIds(composite ? composite.items.map((i) => i.test.id) : []);
    } else {
      setError(res.error ?? 'Something went wrong.');
    }
  };

  const handleDelete = async () => {
    if (!composite) return;
    if (!confirm(`Delete composite "${composite.title}"? Individual sub-tests are kept; only the bundle is removed.`)) return;
    const fd = new FormData();
    fd.set('id', composite.id);
    await deleteCompositeTest(fd);
    onClose();
  };

  const testMap = new Map(availableTests.map((t) => [t.id, t]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit composite' : 'New composite performance test'}
      description="Bundle individual tests together. Order matters — sub-tests display in sequence during recording."
      maxWidth="640px"
    >
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Title" required>
          <input type="text" name="title" defaultValue={composite?.title ?? ''} required placeholder="e.g. Fall Baseline, Pro Day, Mid-Season" className="input-base" />
        </FormField>

        <FormField label="Description" help="What's this CPT for? When is it run?">
          <textarea name="description" defaultValue={composite?.description ?? ''} rows={2} className="input-base resize-none" />
        </FormField>

        <div>
          <div className="text-xs font-medium text-ink mb-1.5">Tests in this composite</div>
          <div className="text-[11px] text-ink-faint mb-3">
            Add individual tests from the library. Drag or use up/down arrows to reorder.
          </div>

          {selectedIds.length === 0 ? (
            <div className="card-base p-5 text-center text-sm text-ink-dim mb-3">
              No tests added yet. Pick from the list below.
            </div>
          ) : (
            <ol className="card-base overflow-hidden mb-3">
              {selectedIds.map((testId, idx) => {
                const test = testMap.get(testId);
                if (!test) return null;
                return (
                  <li key={testId} className={`flex items-center gap-3 px-4 py-2.5 ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
                    <span className="font-mono text-sm text-ink-faint w-5 text-right flex-shrink-0">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${
                          test.domain === 'on_ice' ? 'bg-ink text-paper' : 'bg-sage/10 text-sage-dark border border-sage/30'
                        }`}>
                          {DOMAIN_LABELS[test.domain]}
                        </span>
                        <span className="text-sm text-ink font-medium truncate">{test.title}</span>
                      </div>
                      {test.unit && <div className="text-[10px] text-ink-faint mt-0.5">Unit: {test.unit} &middot; {test.direction === 'higher_is_better' ? '↑ higher better' : '↓ lower better'}</div>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        className="w-7 h-7 rounded border border-ink-hair bg-paper hover:bg-ivory disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                        title="Move up"
                      >↑</button>
                      <button
                        type="button"
                        onClick={() => moveDown(idx)}
                        disabled={idx === selectedIds.length - 1}
                        className="w-7 h-7 rounded border border-ink-hair bg-paper hover:bg-ivory disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                        title="Move down"
                      >↓</button>
                      <button
                        type="button"
                        onClick={() => removeAt(idx)}
                        className="w-7 h-7 rounded border border-ink-hair bg-paper hover:bg-crimson/10 hover:border-crimson text-xs text-ink-faint hover:text-crimson"
                        title="Remove"
                      >×</button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {availableUnselected.length > 0 && (
            <div>
              <label className="text-[11px] text-ink-faint block mb-1.5">Add test:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addTest(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="input-base"
              >
                <option value="" disabled>Pick a test to add&hellip;</option>
                <optgroup label={DOMAIN_LABELS.on_ice}>
                  {availableUnselected.filter((t) => t.domain === 'on_ice').map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </optgroup>
                <optgroup label={DOMAIN_LABELS.off_ice}>
                  {availableUnselected.filter((t) => t.domain === 'off_ice').map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {availableUnselected.length === 0 && selectedIds.length > 0 && (
            <div className="text-xs text-ink-faint italic">All available tests are already in this composite.</div>
          )}
        </div>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-between items-center gap-2 mt-2 pt-4 border-t border-ink-hair">
          {isEdit && (
            <button type="button" onClick={handleDelete} className="text-xs text-crimson hover:text-crimson-dark font-mono uppercase tracking-wider">
              Delete
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
            <button
              type="submit"
              disabled={saving || selectedIds.length === 0}
              className="btn-primary !h-10 text-[13px]"
            >
              {saving ? 'Saving\u2026' : isEdit ? 'Save' : 'Create composite'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
