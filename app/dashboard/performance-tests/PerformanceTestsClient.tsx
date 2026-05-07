'use client';

import { useMemo, useState } from 'react';
import { createPerformanceTest, updatePerformanceTest, deletePerformanceTest } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { DOMAIN_LABELS } from '@/lib/goal-taxonomy';
import type { PerformanceTest, GoalDomain } from '@/lib/supabase/types';

interface Props {
  tests: PerformanceTest[];
  addOnly?: boolean;
}

export function PerformanceTestsClient({ tests, addOnly }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PerformanceTest | null>(null);
  const [domainFilter, setDomainFilter] = useState<GoalDomain | 'all'>('all');

  const filtered = useMemo(() => {
    return tests.filter(t => domainFilter === 'all' || t.domain === domainFilter);
  }, [tests, domainFilter]);

  if (addOnly) {
    return (
      <>
        <button onClick={() => setAddOpen(true)} className="btn-primary !h-10 !px-4 text-[13px]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add test
        </button>
        <TestFormModal open={addOpen} onClose={() => setAddOpen(false)} />
      </>
    );
  }

  const onIceCount = tests.filter(t => t.domain === 'on_ice').length;
  const offIceCount = tests.filter(t => t.domain === 'off_ice').length;

  return (
    <>
      <div className="flex gap-1 border border-ink-hair rounded-full p-1 bg-paper self-start mb-6">
        <DomainPill active={domainFilter === 'all'} onClick={() => setDomainFilter('all')}
          label={`All (${tests.length})`} />
        <DomainPill active={domainFilter === 'on_ice'} onClick={() => setDomainFilter('on_ice')}
          label={`On-Ice (${onIceCount})`} />
        <DomainPill active={domainFilter === 'off_ice'} onClick={() => setDomainFilter('off_ice')}
          label={`Off-Ice (${offIceCount})`} />
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <h3 className="font-serif text-xl text-ink mb-2">{tests.length === 0 ? 'No performance tests yet' : 'No matches'}</h3>
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            {tests.length === 0
              ? 'Define your first performance test. Examples: 40-yard dash (seconds, lower is better), 1RM squat (lb, higher is better), Mile time (seconds, lower is better).'
              : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {filtered.map((t, idx) => (
            <button key={t.id} onClick={() => setEditing(t)}
              className={`w-full text-left flex items-center justify-between gap-4 px-5 py-4 group ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${
                    t.domain === 'on_ice'
                      ? 'bg-ink text-paper'
                      : 'bg-sage/10 text-sage-dark border border-sage/30'
                  }`}>
                    {DOMAIN_LABELS[t.domain]}
                  </span>
                  <span className="font-medium text-ink group-hover:text-crimson transition-colors">{t.title}</span>
                </div>
                {t.description && <p className="text-xs text-ink-dim leading-relaxed">{t.description}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                {t.unit && <div className="text-xs text-ink font-mono">{t.unit}</div>}
                <div className="text-[10px] text-ink-faint mt-0.5">
                  {t.direction === 'higher_is_better' ? '↑ higher better' : '↓ lower better'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <TestFormModal open={addOpen} onClose={() => setAddOpen(false)} />
      <TestFormModal open={editing !== null} onClose={() => setEditing(null)} test={editing ?? undefined} />
    </>
  );
}

function DomainPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`px-3 h-8 rounded-full text-xs font-medium transition-colors ${
        active ? 'bg-ink text-paper' : 'text-ink-faint hover:text-ink'
      }`}
    >{label}</button>
  );
}

function TestFormModal({ open, onClose, test }: { open: boolean; onClose: () => void; test?: PerformanceTest }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!test;

  const handleSubmit = async (fd: FormData) => {
    setSaving(true);
    setError(null);
    if (isEdit && test) fd.set('id', test.id);
    const res = await (isEdit ? updatePerformanceTest(fd) : createPerformanceTest(fd));
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Something went wrong.');
  };

  const handleDelete = async () => {
    if (!test || !confirm(`Delete "${test.title}"? Any goal plans using this test will lose their reference.`)) return;
    const fd = new FormData();
    fd.set('id', test.id);
    await deletePerformanceTest(fd);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit test' : 'Add a performance test'}>
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Title" required>
          <input type="text" name="title" defaultValue={test?.title ?? ''} required placeholder="e.g. 40-yard dash" className="input-base" />
        </FormField>
        <FormField label="Domain" required>
          <select name="domain" defaultValue={test?.domain ?? 'off_ice'} required className="input-base">
            <option value="on_ice">On-Ice</option>
            <option value="off_ice">Off-Ice</option>
          </select>
        </FormField>
        <FormField label="Description" help="What does this test measure?">
          <textarea name="description" defaultValue={test?.description ?? ''} rows={2} className="input-base resize-none" />
        </FormField>
        <FormField label="Protocol" help="How to administer the test — equipment, procedure, timing.">
          <textarea name="instructions" defaultValue={test?.instructions ?? ''} rows={4} className="input-base resize-none" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Unit" required>
            <input type="text" name="unit" defaultValue={test?.unit ?? ''} placeholder="sec, lb, reps, in" required className="input-base" />
          </FormField>
          <FormField label="Direction" required help="What does progress look like?">
            <select name="direction" defaultValue={test?.direction ?? 'higher_is_better'} required className="input-base">
              <option value="higher_is_better">Higher is better</option>
              <option value="lower_is_better">Lower is better</option>
            </select>
          </FormField>
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
            <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
              {saving ? 'Saving\u2026' : isEdit ? 'Save' : 'Add test'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
