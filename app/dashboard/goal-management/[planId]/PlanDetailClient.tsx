'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateGoalPlan, deleteGoalPlan,
  createGoalInPlan, updateGoalInPlan, deleteGoalFromPlan,
  attachCompositeToPlan, detachCompositeFromPlan,
  createReview, updateReview, completeReview, deleteReview,
} from '@/app/actions';
import { toFormAction } from '@/lib/form-helpers';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import {
  DOMAIN_LABELS, CATEGORY_LABELS, categoriesForDomain,
} from '@/lib/goal-taxonomy';
import type {
  GoalPlan, GoalPlanGoal, Review, CompositePerformanceTest, GoalTemplate,
  GoalDomain, GoalCategory, GoalPlanStatus, PerformanceTest,
} from '@/lib/supabase/types';
import type { AttachedComposite } from './page';

const STATUSES: GoalPlanStatus[] = ['draft', 'active', 'completed', 'archived'];

interface Props {
  plan: GoalPlan;
  goals: GoalPlanGoal[];
  attachedComposites: AttachedComposite[];
  availableComposites: CompositePerformanceTest[];
  reviews: Review[];
  templates: GoalTemplate[];
  tests: PerformanceTest[];
  readOnly: boolean;
}

export function PlanDetailClient(props: Props) {
  const { plan, goals, attachedComposites, availableComposites, reviews, templates, tests, readOnly } = props;

  return (
    <div className="flex flex-col gap-10">
      <PlanMetaSection plan={plan} readOnly={readOnly} />
      <GoalsSection plan={plan} goals={goals} templates={templates} tests={tests} readOnly={readOnly} />
      <CompositesSection plan={plan} attachedComposites={attachedComposites} availableComposites={availableComposites} readOnly={readOnly} />
      <ReviewsSection plan={plan} reviews={reviews} readOnly={readOnly} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Plan metadata
// ----------------------------------------------------------------------------

function PlanMetaSection({ plan, readOnly }: { plan: GoalPlan; readOnly: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (fd: FormData) => {
    fd.set('id', plan.id);
    setSaving('saving');
    setError(null);
    const res = await updateGoalPlan(fd);
    if (res.ok) {
      setSaving('saved');
      setTimeout(() => { setSaving('idle'); setEditing(false); }, 1200);
    } else {
      setSaving('error');
      setError(res.error ?? 'Failed to save.');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this goal plan? All goals, composites, and reviews will be lost.')) return;
    const fd = new FormData();
    fd.set('id', plan.id);
    await deleteGoalPlan(fd);
    router.push('/dashboard/goal-management');
  };

  if (!editing) {
    return (
      <section className="flex items-start justify-between gap-4 pb-6 border-b border-ink-hair">
        <div className="flex items-center gap-3 flex-wrap">
          <StatusPill status={plan.status} />
          {plan.starts_on && plan.ends_on && (
            <span className="text-xs text-ink-faint font-mono">
              {formatDate(plan.starts_on)} – {formatDate(plan.ends_on)}
            </span>
          )}
        </div>
        {!readOnly && (
          <button onClick={() => setEditing(true)} className="btn-secondary !h-9 text-xs">
            Edit plan
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="pb-6 border-b border-ink-hair">
      <div className="kicker mb-4">Edit plan</div>
      <form action={handleSubmit} className="card-base p-6 flex flex-col gap-4">
        <FormField label="Title" required>
          <input type="text" name="title" defaultValue={plan.title} required className="input-base" />
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Status" required>
            <select name="status" defaultValue={plan.status} required className="input-base capitalize">
              {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </FormField>
          <FormField label="Start date">
            <input type="date" name="starts_on" defaultValue={plan.starts_on ?? ''} className="input-base" />
          </FormField>
          <FormField label="End date">
            <input type="date" name="ends_on" defaultValue={plan.ends_on ?? ''} className="input-base" />
          </FormField>
        </div>

        <FormField label="Agreement notes" help="Your record of the discussion with student/family.">
          <textarea name="agreement_notes" defaultValue={plan.agreement_notes ?? ''} rows={4} className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-between items-center pt-4 border-t border-ink-hair">
          <button type="button" onClick={handleDelete} className="text-xs text-crimson hover:text-crimson-dark font-mono uppercase tracking-wider">
            Delete plan
          </button>
          <div className="flex items-center gap-3">
            {saving === 'saved' && <span className="text-sm text-sage-dark">✓ Saved</span>}
            <button type="button" onClick={() => setEditing(false)} disabled={saving === 'saving'} className="btn-secondary !h-10 text-[13px]">
              Cancel
            </button>
            <button type="submit" disabled={saving === 'saving'} className="btn-primary !h-10 text-[13px]">
              {saving === 'saving' ? 'Saving\u2026' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Goals section
// ----------------------------------------------------------------------------

function GoalsSection({ plan, goals, templates, tests, readOnly }: { plan: GoalPlan; goals: GoalPlanGoal[]; templates: GoalTemplate[]; tests: PerformanceTest[]; readOnly: boolean }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalPlanGoal | null>(null);

  const canAddMore = goals.length < 3;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="kicker">Goals · {goals.length} of 3</div>
        {!readOnly && (
          <button
            onClick={() => setAddOpen(true)}
            disabled={!canAddMore}
            className="btn-secondary !h-9 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canAddMore ? 'Maximum 3 goals per plan' : ''}
          >
            + Add goal
          </button>
        )}
      </div>

      {goals.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            No goals yet. A plan can hold 1–3 goals. Start by adding one — either free-form or from a template.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {goals.map((g) => (
            <button key={g.id} onClick={() => !readOnly && setEditingGoal(g)}
              disabled={readOnly}
              className={`card-base p-4 text-left group ${readOnly ? 'cursor-default' : ''}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {g.domain && (
                      <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${
                        g.domain === 'on_ice' ? 'bg-ink text-paper' : 'bg-sage/10 text-sage-dark border border-sage/30'
                      }`}>
                        {DOMAIN_LABELS[g.domain]}
                      </span>
                    )}
                    {g.category && (
                      <span className="text-[9px] font-mono tracking-wider text-ink-faint">
                        {CATEGORY_LABELS[g.category]}
                      </span>
                    )}
                    <GoalStatusPill status={g.status} />
                  </div>
                  <h3 className={`font-serif text-lg text-ink leading-tight ${readOnly ? '' : 'group-hover:text-crimson transition-colors'}`}>
                    {g.title}
                  </h3>
                </div>
                <div className="flex-shrink-0 text-right">
                  {(g.target_value || g.target_unit) && (
                    <div className="text-sm text-ink font-mono">
                      {g.current_value && <span className="text-ink-faint">{g.current_value} → </span>}
                      {g.target_value} {g.target_unit}
                    </div>
                  )}
                </div>
              </div>

              {g.description && (
                <p className="text-xs text-ink-dim leading-relaxed mb-3">{g.description}</p>
              )}

              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 h-1.5 bg-ink-hair rounded-full overflow-hidden">
                  <div className={`h-full ${
                    g.status === 'achieved' ? 'bg-sage' :
                    g.status === 'abandoned' ? 'bg-ink-mist' : 'bg-crimson'
                  }`} style={{ width: `${g.progress_pct}%` }} />
                </div>
                <span className="text-xs font-mono text-ink-faint w-10 text-right">{g.progress_pct}%</span>
              </div>
              {g.due_date && (
                <div className="text-[11px] text-ink-faint mt-2">Due {formatDate(g.due_date)}</div>
              )}
            </button>
          ))}
        </div>
      )}

      <AddGoalModal open={addOpen} onClose={() => setAddOpen(false)} plan={plan} templates={templates} tests={tests} nextSequence={goals.length + 1} />
      <EditGoalModal open={editingGoal !== null} onClose={() => setEditingGoal(null)} goal={editingGoal} planId={plan.id} tests={tests} />
    </section>
  );
}

function GoalStatusPill({ status }: { status: string }) {
  const style = status === 'achieved'
    ? 'bg-sage text-paper'
    : status === 'abandoned'
    ? 'bg-ink-mist text-paper'
    : 'bg-crimson/10 text-crimson border border-crimson/20';
  return (
    <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${style}`}>
      {status}
    </span>
  );
}

function AddGoalModal({ open, onClose, plan, templates, tests, nextSequence }: {
  open: boolean; onClose: () => void; plan: GoalPlan; templates: GoalTemplate[]; tests: PerformanceTest[]; nextSequence: number;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [domain, setDomain] = useState<GoalDomain>('on_ice');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [targetValue, setTargetValue] = useState('');
  const [targetUnit, setTargetUnit] = useState('');

  const handleTemplatePick = (id: string) => {
    setSelectedTemplateId(id);
    if (!id) return;
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTitle(t.title);
    setDescription(t.description ?? '');
    setDomain(t.domain);
    setCategory(t.category);
    setTargetValue(t.target_value?.toString() ?? '');
    setTargetUnit(t.target_unit ?? '');
  };

  const handleSubmit = async (fd: FormData) => {
    fd.set('plan_id', plan.id);
    fd.set('sequence', String(nextSequence));
    if (selectedTemplateId) fd.set('template_id', selectedTemplateId);
    setSaving(true);
    setError(null);
    const res = await createGoalInPlan(fd);
    setSaving(false);
    if (res.ok) {
      setTitle(''); setDescription(''); setCategory(''); setTargetValue(''); setTargetUnit(''); setSelectedTemplateId('');
      onClose();
    } else {
      setError(res.error ?? 'Failed.');
    }
  };

  const categories = categoriesForDomain(domain);

  return (
    <Modal open={open} onClose={onClose} title="Add a goal" description="Start from a template or build from scratch." maxWidth="560px">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Start from template" help="Optional. Pre-fills the fields below.">
          <select value={selectedTemplateId} onChange={(e) => handleTemplatePick(e.target.value)} className="input-base">
            <option value="">&mdash; None (build from scratch) &mdash;</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>[{DOMAIN_LABELS[t.domain]}] {t.title}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Title" required>
          <input type="text" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="input-base" />
        </FormField>

        <FormField label="Description">
          <textarea name="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input-base resize-none" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Domain">
            <select name="domain" value={domain} onChange={(e) => { setDomain(e.target.value as GoalDomain); setCategory(''); }} className="input-base">
              <option value="on_ice">On-Ice</option>
              <option value="off_ice">Off-Ice</option>
            </select>
          </FormField>
          <FormField label="Category">
            <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="input-base">
              <option value="">&mdash;</option>
              {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c as GoalCategory]}</option>)}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Target">
            <input type="text" name="target_value" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="20" className="input-base" />
          </FormField>
          <FormField label="Unit">
            <input type="text" name="target_unit" value={targetUnit} onChange={(e) => setTargetUnit(e.target.value)} placeholder="goals" className="input-base" />
          </FormField>
          <FormField label="Due date">
            <input type="date" name="due_date" className="input-base" />
          </FormField>
        </div>

        <div className="border-t border-ink-hair pt-4">
          <div className="kicker mb-2">Auto-track via test (optional)</div>
          <p className="text-xs text-ink-faint mb-3">
            Link this goal to a performance test to compute progress automatically. Leave blank for goals that aren&apos;t numerically measurable.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Linked test">
              <select name="linked_test_id" defaultValue="" className="input-base">
                <option value="">— none —</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}{t.unit ? ` (${t.unit})` : ''}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Numeric target" help="The target value the test should reach.">
              <input type="number" step="0.01" name="target_numeric" placeholder="e.g. 24" className="input-base" />
            </FormField>
          </div>
        </div>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Adding\u2026' : 'Add goal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditGoalModal({ open, onClose, goal, planId, tests }: {
  open: boolean; onClose: () => void; goal: GoalPlanGoal | null; planId: string; tests: PerformanceTest[];
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!goal) return null;

  const handleSubmit = async (fd: FormData) => {
    fd.set('id', goal.id);
    fd.set('plan_id', planId);
    setSaving(true);
    setError(null);
    const res = await updateGoalInPlan(fd);
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Failed.');
  };

  const handleDelete = async () => {
    if (!confirm(`Delete goal "${goal.title}"?`)) return;
    const fd = new FormData();
    fd.set('id', goal.id);
    fd.set('plan_id', planId);
    await deleteGoalFromPlan(fd);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit goal" maxWidth="560px">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Title" required>
          <input type="text" name="title" defaultValue={goal.title} required className="input-base" />
        </FormField>

        <FormField label="Description">
          <textarea name="description" defaultValue={goal.description ?? ''} rows={2} className="input-base resize-none" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Target">
            <input type="text" name="target_value" defaultValue={goal.target_value ?? ''} className="input-base" />
          </FormField>
          <FormField label="Unit">
            <input type="text" name="target_unit" defaultValue={goal.target_unit ?? ''} className="input-base" />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Current">
            <input type="text" name="current_value" defaultValue={goal.current_value ?? ''} className="input-base" />
          </FormField>
          <FormField label="Progress %">
            <input type="number" name="progress_pct" defaultValue={goal.progress_pct} min="0" max="100" className="input-base" />
          </FormField>
          <FormField label="Due date">
            <input type="date" name="due_date" defaultValue={goal.due_date ?? ''} className="input-base" />
          </FormField>
        </div>

        <div className="border-t border-ink-hair pt-4">
          <div className="kicker mb-2">Auto-track via test (optional)</div>
          <p className="text-xs text-ink-faint mb-3">
            Link this goal to a performance test to compute progress automatically. The auto-computed value will override the manual progress % above.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Linked test">
              <select name="linked_test_id" defaultValue={goal.linked_test_id ?? ''} className="input-base">
                <option value="">— none —</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}{t.unit ? ` (${t.unit})` : ''}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Numeric target">
              <input type="number" step="0.01" name="target_numeric" defaultValue={goal.target_numeric ?? ''} className="input-base" />
            </FormField>
          </div>
        </div>

        <FormField label="Status" required>
          <select name="status" defaultValue={goal.status} required className="input-base capitalize">
            <option value="active">Active</option>
            <option value="achieved">Achieved</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-between items-center pt-4 border-t border-ink-hair">
          <button type="button" onClick={handleDelete} className="text-xs text-crimson hover:text-crimson-dark font-mono uppercase tracking-wider">
            Delete
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
              {saving ? 'Saving\u2026' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Composite performance tests section (year-over-year table view)
// ----------------------------------------------------------------------------

function CompositesSection({ plan, attachedComposites, availableComposites, readOnly }: {
  plan: GoalPlan; attachedComposites: AttachedComposite[]; availableComposites: CompositePerformanceTest[]; readOnly: boolean;
}) {
  const [attachOpen, setAttachOpen] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="kicker">Performance tests · {attachedComposites.length} composite{attachedComposites.length === 1 ? '' : 's'}</div>
        {!readOnly && (
          <button onClick={() => setAttachOpen(true)} className="btn-secondary !h-9 text-xs"
            disabled={availableComposites.length === 0}
            title={availableComposites.length === 0 ? 'All composites attached, or none defined' : ''}>
            + Attach composite
          </button>
        )}
      </div>

      {attachedComposites.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            No composite tests attached to this plan. Attach a composite (like &ldquo;Fall Baseline&rdquo;) to track progress across its sub-tests. Sessions recorded during this season appear as columns against the baseline.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {attachedComposites.map((ac) => (
            <CompositeTable key={ac.link.id} attached={ac} planId={plan.id} readOnly={readOnly} />
          ))}
        </div>
      )}

      <AttachCompositeModal open={attachOpen} onClose={() => setAttachOpen(false)} plan={plan} availableComposites={availableComposites} />
    </section>
  );
}

function CompositeTable({ attached, planId, readOnly }: { attached: AttachedComposite; planId: string; readOnly: boolean }) {
  const { composite, subTests, sessions, baselineSessionId } = attached;

  const baselineSession = sessions.find((s) => s.session.id === baselineSessionId);
  const nonBaselineSessions = sessions.filter((s) => s.session.id !== baselineSessionId);

  // Compute % change for each non-baseline session × test
  function computeChange(testId: string, sessionResults: Map<string, number>): { delta: number | null; pctChange: number | null; improving: boolean | null } {
    if (!baselineSession) return { delta: null, pctChange: null, improving: null };
    const baseVal = baselineSession.results.get(testId);
    const curVal = sessionResults.get(testId);
    if (baseVal === undefined || curVal === undefined) return { delta: null, pctChange: null, improving: null };
    const delta = curVal - baseVal;
    const pctChange = baseVal !== 0 ? (delta / baseVal) * 100 : null;
    const test = subTests.find((st) => st.test.id === testId)?.test;
    if (!test) return { delta, pctChange, improving: null };
    const improving = test.direction === 'higher_is_better' ? delta > 0 : delta < 0;
    return { delta, pctChange, improving: delta === 0 ? null : improving };
  }

  return (
    <div className="card-base overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-ink-hair bg-sand-50">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg text-ink">{composite.title}</h3>
          {composite.description && <p className="text-xs text-ink-dim mt-1">{composite.description}</p>}
        </div>
        {!readOnly && (
          <form action={toFormAction(detachCompositeFromPlan)}>
            <input type="hidden" name="id" value={attached.link.id} />
            <input type="hidden" name="plan_id" value={planId} />
            <button type="submit" className="text-[10px] text-ink-faint hover:text-crimson font-mono uppercase tracking-wider flex-shrink-0">
              Detach
            </button>
          </form>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-dim italic">
          No sessions recorded yet. Results will appear as the trainer administers this composite for {/* student */ 'the student'}.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono tracking-wider uppercase text-ink-faint">
                <th className="text-left px-5 py-3 font-medium">Test</th>
                <th className="text-left px-3 py-3 font-medium">Unit</th>
                {baselineSession && (
                  <th className="text-right px-3 py-3 font-medium bg-sage/5 border-l border-ink-hair">
                    <div>Baseline</div>
                    <div className="text-ink-mist text-[9px] normal-case mt-0.5">{formatDate(baselineSession.session.session_date)}</div>
                  </th>
                )}
                {nonBaselineSessions.map((sv) => (
                  <th key={sv.session.id} className="text-right px-3 py-3 font-medium border-l border-ink-hair">
                    <div>{formatShortDate(sv.session.session_date)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subTests.sort((a, b) => a.sequence - b.sequence).map((st) => (
                <tr key={st.test.id} className="border-t border-ink-hair">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-mono tracking-[0.15em] uppercase px-1 py-0.5 rounded ${
                        st.test.domain === 'on_ice' ? 'bg-ink text-paper' : 'bg-sage/10 text-sage-dark border border-sage/30'
                      }`}>
                        {DOMAIN_LABELS[st.test.domain]}
                      </span>
                      <span className="text-ink font-medium">{st.test.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-faint text-xs">
                    {st.test.unit}
                    <div className="text-[9px] opacity-75 mt-0.5">
                      {st.test.direction === 'higher_is_better' ? '↑ better' : '↓ better'}
                    </div>
                  </td>
                  {baselineSession && (
                    <td className="px-3 py-2.5 text-right font-mono text-ink bg-sage/5 border-l border-ink-hair">
                      {baselineSession.results.get(st.test.id) ?? <span className="text-ink-faint">&mdash;</span>}
                    </td>
                  )}
                  {nonBaselineSessions.map((sv) => {
                    const value = sv.results.get(st.test.id);
                    const change = computeChange(st.test.id, sv.results);
                    return (
                      <td key={sv.session.id} className="px-3 py-2.5 text-right font-mono border-l border-ink-hair">
                        {value !== undefined ? (
                          <>
                            <div className="text-ink">{value}</div>
                            {change.pctChange !== null && (
                              <div className={`text-[10px] mt-0.5 ${
                                change.improving === true ? 'text-sage-dark' :
                                change.improving === false ? 'text-crimson' :
                                'text-ink-faint'
                              }`}>
                                {change.improving === true ? '↑' : change.improving === false ? '↓' : '='} {Math.abs(change.pctChange).toFixed(1)}%
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-ink-faint">&mdash;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AttachCompositeModal({ open, onClose, plan, availableComposites }: {
  open: boolean; onClose: () => void; plan: GoalPlan; availableComposites: CompositePerformanceTest[];
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');

  const handleSubmit = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set('plan_id', plan.id);
    fd.set('composite_id', selectedId);
    const res = await attachCompositeToPlan(fd);
    setSaving(false);
    if (res.ok) {
      setSelectedId('');
      onClose();
    } else {
      setError(res.error ?? 'Failed.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Attach a composite" description="Pick a composite performance test to track on this plan.">
      <div className="flex flex-col gap-4">
        <FormField label="Composite" required>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} required className="input-base">
            <option value="" disabled>Choose a composite&hellip;</option>
            {availableComposites.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </FormField>

        <div className="text-xs text-ink-faint italic">
          Sessions of this composite recorded during the current season will appear as columns. The earliest session is the baseline by default; you can later mark another as baseline explicitly.
        </div>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saving || !selectedId} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Attaching\u2026' : 'Attach composite'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Reviews section
// ----------------------------------------------------------------------------

function ReviewsSection({ plan, reviews, readOnly }: { plan: GoalPlan; reviews: Review[]; readOnly: boolean }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="kicker">Reviews · {reviews.length}</div>
        {!readOnly && (
          <button onClick={() => setAddOpen(true)} className="btn-secondary !h-9 text-xs">
            + New review
          </button>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            No reviews yet. Create a scheduled or ad-hoc review to document progress. Completed reviews lock and become part of the plan&apos;s history.
          </p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {reviews.map((r, idx) => (
            <button key={r.id} onClick={() => setEditingReview(r)}
              className={`w-full text-left flex items-center gap-4 px-5 py-3.5 group ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${
                    r.review_type === 'scheduled' ? 'bg-ink text-paper' : 'bg-sand-100 text-ink border border-sand-200'
                  }`}>
                    {r.review_type.replace('_', '-')}
                  </span>
                  <span className="font-medium text-ink group-hover:text-crimson transition-colors">
                    Review {r.scheduled_date ? formatDate(r.scheduled_date) : formatDate(r.created_at.slice(0, 10))}
                  </span>
                  {r.completed_at ? (
                    <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-sage text-paper">Completed</span>
                  ) : (
                    <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-crimson/10 text-crimson border border-crimson/20">Draft</span>
                  )}
                </div>
                {r.summary && <div className="text-xs text-ink-dim line-clamp-1">{r.summary}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      <NewReviewModal open={addOpen} onClose={() => setAddOpen(false)} plan={plan} />
      <EditReviewModal open={editingReview !== null} onClose={() => setEditingReview(null)} review={editingReview} planId={plan.id} readOnly={readOnly} />
    </section>
  );
}

function NewReviewModal({ open, onClose, plan }: { open: boolean; onClose: () => void; plan: GoalPlan }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (fd: FormData) => {
    fd.set('plan_id', plan.id);
    setSaving(true);
    setError(null);
    const res = await createReview(fd);
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Failed.');
  };

  return (
    <Modal open={open} onClose={onClose} title="New review" description="Start a review for this plan.">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Review type" required>
          <select name="review_type" defaultValue="scheduled" required className="input-base">
            <option value="scheduled">Scheduled</option>
            <option value="ad_hoc">Ad-hoc</option>
          </select>
        </FormField>

        <FormField label="Scheduled date">
          <input type="date" name="scheduled_date" className="input-base" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Creating\u2026' : 'Create review'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditReviewModal({ open, onClose, review, planId, readOnly }: {
  open: boolean; onClose: () => void; review: Review | null; planId: string; readOnly: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!review) return null;

  const isCompleted = review.completed_at !== null;
  const trulyReadOnly = isCompleted || readOnly;

  const handleSubmit = async (fd: FormData) => {
    fd.set('id', review.id);
    fd.set('plan_id', planId);
    setSaving(true);
    setError(null);
    const res = await updateReview(fd);
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Failed.');
  };

  const handleComplete = async () => {
    if (!confirm('Complete this review? Once completed, it locks.')) return;
    const fd = new FormData();
    fd.set('id', review.id);
    fd.set('plan_id', planId);
    await completeReview(fd);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this review?')) return;
    const fd = new FormData();
    fd.set('id', review.id);
    fd.set('plan_id', planId);
    await deleteReview(fd);
    onClose();
  };

  const title = isCompleted
    ? `Review · ${formatDate((review.scheduled_date ?? review.created_at).slice(0, 10))} (locked)`
    : 'Edit review';

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="600px">
      <form action={handleSubmit} className="flex flex-col gap-4">
        {!trulyReadOnly && (
          <FormField label="Scheduled date">
            <input type="date" name="scheduled_date" defaultValue={review.scheduled_date ?? ''} className="input-base" />
          </FormField>
        )}

        <FormField label="Summary">
          <textarea name="summary" defaultValue={review.summary ?? ''} rows={4} readOnly={trulyReadOnly}
            className={`input-base resize-none ${trulyReadOnly ? 'opacity-70 cursor-default' : ''}`} />
        </FormField>

        <FormField label="Concerns">
          <textarea name="concerns" defaultValue={review.concerns ?? ''} rows={3} readOnly={trulyReadOnly}
            className={`input-base resize-none ${trulyReadOnly ? 'opacity-70 cursor-default' : ''}`} />
        </FormField>

        <FormField label="Next steps">
          <textarea name="next_steps" defaultValue={review.next_steps ?? ''} rows={3} readOnly={trulyReadOnly}
            className={`input-base resize-none ${trulyReadOnly ? 'opacity-70 cursor-default' : ''}`} />
        </FormField>

        {isCompleted && (
          <div className="text-xs text-ink-faint italic px-2">
            Completed {formatDate(review.completed_at!.slice(0, 10))}. This review is locked.
          </div>
        )}

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-between items-center pt-4 border-t border-ink-hair">
          {!trulyReadOnly && (
            <button type="button" onClick={handleDelete} className="text-xs text-crimson hover:text-crimson-dark font-mono uppercase tracking-wider">
              Delete
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">
              {trulyReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!trulyReadOnly && (
              <>
                <button type="submit" disabled={saving} className="btn-secondary !h-10 text-[13px]">
                  {saving ? 'Saving\u2026' : 'Save draft'}
                </button>
                <button type="button" onClick={handleComplete} className="btn-primary !h-10 text-[13px]">
                  Complete review
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Shared utilities
// ----------------------------------------------------------------------------

function StatusPill({ status }: { status: GoalPlanStatus }) {
  const style = status === 'active'
    ? 'bg-sage/10 text-sage-dark border border-sage/30'
    : status === 'completed'
    ? 'bg-ink text-paper'
    : status === 'archived'
    ? 'bg-sand-100 text-ink-faint border border-sand-200'
    : 'bg-paper text-ink-faint border border-ink-hair';
  return (
    <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${style}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
