'use client';

import { useMemo, useState } from 'react';
import { createGoalTemplate, updateGoalTemplate, deleteGoalTemplate } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import {
  DOMAIN_LABELS, CATEGORY_LABELS, categoriesForDomain,
} from '@/lib/goal-taxonomy';
import type { GoalTemplate, GoalDomain } from '@/lib/supabase/types';

interface Props {
  templates: GoalTemplate[];
  addOnly?: boolean;
}

export function GoalTemplatesClient({ templates, addOnly }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<GoalTemplate | null>(null);
  const [query, setQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState<GoalDomain | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter(t => {
      if (domainFilter !== 'all' && t.domain !== domainFilter) return false;
      if (!q) return true;
      return (t.title + ' ' + (t.description ?? '') + ' ' + CATEGORY_LABELS[t.category]).toLowerCase().includes(q);
    });
  }, [templates, query, domainFilter]);

  if (addOnly) {
    return (
      <>
        <button onClick={() => setAddOpen(true)} className="btn-primary !h-10 !px-4 text-[13px]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add template
        </button>
        <GoalTemplateFormModal open={addOpen} onClose={() => setAddOpen(false)} />
      </>
    );
  }

  const onIceCount = templates.filter(t => t.domain === 'on_ice').length;
  const offIceCount = templates.filter(t => t.domain === 'off_ice').length;

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="flex gap-1 border border-ink-hair rounded-full p-1 bg-paper">
          <DomainPill active={domainFilter === 'all'} onClick={() => setDomainFilter('all')}
            label={`All (${templates.length})`} />
          <DomainPill active={domainFilter === 'on_ice'} onClick={() => setDomainFilter('on_ice')}
            label={`On-Ice (${onIceCount})`} />
          <DomainPill active={domainFilter === 'off_ice'} onClick={() => setDomainFilter('off_ice')}
            label={`Off-Ice (${offIceCount})`} />
        </div>
        <div className="flex-1 min-w-[200px] relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mist pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search templates…" className="input-base !pl-10" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <h3 className="font-serif text-xl text-ink mb-2">{templates.length === 0 ? 'No templates yet' : 'No matches'}</h3>
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            {templates.length === 0 ? 'Create the first goal template. Directors pick from these when building student plans.' : 'Try a different filter or clear your search.'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <button key={t.id} onClick={() => setEditing(t)} className="card-base p-5 text-left h-full flex flex-col group">
              <div className="flex justify-between items-start mb-3 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${
                    t.domain === 'on_ice'
                      ? 'bg-ink text-paper'
                      : 'bg-sage/10 text-sage-dark border border-sage/30'
                  }`}>
                    {DOMAIN_LABELS[t.domain]}
                  </span>
                  <span className="text-[9px] font-mono tracking-wider text-ink-faint">
                    {CATEGORY_LABELS[t.category]}
                  </span>
                </div>
                {t.suggested_deadline_weeks && (
                  <div className="font-mono text-[10px] text-ink-faint flex-shrink-0">{t.suggested_deadline_weeks}w</div>
                )}
              </div>
              <h3 className="font-serif text-lg text-ink leading-tight mb-2 group-hover:text-crimson transition-colors">{t.title}</h3>
              {t.description && <p className="text-sm text-ink-dim leading-relaxed line-clamp-3 flex-1">{t.description}</p>}
            </button>
          ))}
        </div>
      )}

      <GoalTemplateFormModal open={addOpen} onClose={() => setAddOpen(false)} />
      <GoalTemplateFormModal open={editing !== null} onClose={() => setEditing(null)} template={editing ?? undefined} />
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

function GoalTemplateFormModal({ open, onClose, template }: { open: boolean; onClose: () => void; template?: GoalTemplate }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState<GoalDomain>(template?.domain ?? 'on_ice');
  const isEdit = !!template;

  const handleSubmit = async (fd: FormData) => {
    setSaving(true);
    setError(null);
    if (isEdit && template) fd.set('id', template.id);
    const res = await (isEdit ? updateGoalTemplate(fd) : createGoalTemplate(fd));
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Something went wrong.');
  };

  const handleDelete = async () => {
    if (!template || !confirm(`Delete template "${template.title}"?`)) return;
    const fd = new FormData();
    fd.set('id', template.id);
    await deleteGoalTemplate(fd);
    onClose();
  };

  const categories = categoriesForDomain(domain);

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit template' : 'Add a goal template'}>
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Title" required>
          <input type="text" name="title" defaultValue={template?.title ?? ''} required className="input-base" />
        </FormField>
        <FormField label="Description">
          <textarea name="description" defaultValue={template?.description ?? ''} rows={3} className="input-base resize-none" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Domain" required>
            <select name="domain" required value={domain} onChange={e => setDomain(e.target.value as GoalDomain)} className="input-base">
              <option value="on_ice">On-Ice</option>
              <option value="off_ice">Off-Ice</option>
            </select>
          </FormField>
          <FormField label="Category" required>
            <select name="category" required defaultValue={template?.category ?? ''} className="input-base">
              <option value="" disabled>Choose&hellip;</option>
              {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Target">
            <input type="text" name="target_value" defaultValue={template?.target_value ?? ''} placeholder="20" className="input-base" />
          </FormField>
          <FormField label="Unit">
            <input type="text" name="target_unit" defaultValue={template?.target_unit ?? ''} placeholder="goals, lb" className="input-base" />
          </FormField>
          <FormField label="Weeks">
            <input type="number" inputMode="decimal" name="suggested_deadline_weeks" defaultValue={template?.suggested_deadline_weeks ?? ''} className="input-base" />
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
              {saving ? 'Saving\u2026' : isEdit ? 'Save' : 'Add template'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
