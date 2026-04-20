'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateGoalPlan, deleteGoalPlan,
  createGoalInPlan, updateGoalInPlan, deleteGoalFromPlan,
  attachTestToPlan, detachTestFromPlan,
  createReview, updateReview, completeReview, deleteReview,
} from '@/app/actions';
import { toFormAction } from '@/lib/form-helpers';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import {
  DOMAIN_LABELS, CATEGORY_LABELS, categoriesForDomain,
} from '@/lib/goal-taxonomy';
import type {
  GoalPlan, GoalPlanGoal, Review, PerformanceTest, GoalTemplate,
  GoalDomain, GoalCategory, GoalPlanStatus, ReviewType,
} from '@/lib/supabase/types';
import type { AttachedTest } from './page';

const STATUSES: GoalPlanStatus[] = ['draft', 'active', 'completed', 'archived'];

interface Props {
  plan: GoalPlan;
  goals: GoalPlanGoal[];
  attachedTests: AttachedTest[];
  availableTests: PerformanceTest[];
  reviews: Review[];
  templates: GoalTemplate[];
}

export function PlanDetailClient(props: Props) {
  const { plan, goals, attachedTests, availableTests, reviews, templates } = props;

  return (
    <div className="flex flex-col gap-10">
      <PlanMetaSection plan={plan} />
      <GoalsSection plan={plan} goals={goals} templates={templates} />
      <TestsSection plan={plan} attachedTests={attachedTests} availableTests={availableTests} />
      <ReviewsSection plan={plan} reviews={reviews} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Plan metadata
// ----------------------------------------------------------------------------

function PlanMetaSection({ plan }: { plan: GoalPlan }) {
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
    if (!confirm(`Delete this goal plan? All goals, test links, and reviews will be lost. This cannot be undone.`)) return;
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
        <button onClick={() => setEditing(true)} className="btn-secondary !h-9 text-xs">
          Edit plan
        </button>
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
// Goals section (1-3 per plan)
// ----------------------------------------------------------------------------

function GoalsSection({ plan, goals, templates }: { plan: GoalPlan; goals: GoalPlanGoal[]; templates: GoalTemplate[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalPlanGoal | null>(null);

  const canAddMore = goals.length < 3;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="kicker">Goals · {goals.length} of 3</div>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          disabled={!canAddMore}
          className="btn-secondary !h-9 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          title={!canAddMore ? 'Maximum 3 goals per plan' : ''}
        >
          + Add goal
        </button>
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
            <button key={g.id} onClick={() => setEditingGoal(g)}
              className="card-base p-4 text-left group">
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
                  <h3 className="font-serif text-lg text-ink leading-tight group-hover:text-crimson transition-colors">
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

      <AddGoalModal open={addOpen} onClose={() => setAddOpen(false)} plan={plan} templates={templates} nextSequence={goals.length + 1} />
      <EditGoalModal open={editingGoal !== null} onClose={() => setEditingGoal(null)} goal={editingGoal} planId={plan.id} />
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

function AddGoalModal({ open, onClose, plan, templates, nextSequence }: {
  open: boolean; onClose: () => void; plan: GoalPlan; templates: GoalTemplate[]; nextSequence: number;
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
      // Reset and close
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
            <option value="">— None (build from scratch) —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                [{DOMAIN_LABELS[t.domain]}] {t.title}
              </option>
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
              <option value="">—</option>
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

function EditGoalModal({ open, onClose, goal, planId }: {
  open: boolean; onClose: () => void; goal: GoalPlanGoal | null; planId: string;
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
// Performance tests section
// ----------------------------------------------------------------------------

function TestsSection({ plan, attachedTests, availableTests }: {
  plan: GoalPlan; attachedTests: AttachedTest[]; availableTests: PerformanceTest[];
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="kicker">Performance tests · {attachedTests.length}</div>
        <button onClick={() => setAddOpen(true)} className="btn-secondary !h-9 text-xs"
          disabled={availableTests.length === 0}
          title={availableTests.length === 0 ? 'All tests already attached, or none defined' : ''}>
          + Attach test
        </button>
      </div>

      {attachedTests.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            No performance tests attached to this plan yet. Attach tests you want to track across the plan period — results will show here as they&apos;re recorded.
          </p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {attachedTests.map((at, idx) => (
            <TestRow key={at.link.id} attachedTest={at} planId={plan.id} first={idx === 0} />
          ))}
        </div>
      )}

      <AttachTestModal open={addOpen} onClose={() => setAddOpen(false)} plan={plan} availableTests={availableTests} />
    </section>
  );
}

function TestRow({ attachedTest, planId, first }: { attachedTest: AttachedTest; planId: string; first: boolean }) {
  const { link, test, latest_value, latest_recorded_at } = attachedTest;

  // Trend computation
  let trend: 'improving' | 'declining' | 'flat' | 'unknown' = 'unknown';
  if (latest_value !== null && link.baseline_value !== null) {
    const diff = latest_value - link.baseline_value;
    if (Math.abs(diff) < 0.0001) trend = 'flat';
    else if (test.direction === 'higher_is_better') trend = diff > 0 ? 'improving' : 'declining';
    else trend = diff < 0 ? 'improving' : 'declining';
  }

  const trendStyle = trend === 'improving'
    ? 'text-sage-dark'
    : trend === 'declining'
    ? 'text-crimson'
    : 'text-ink-faint';

  const trendIcon = trend === 'improving' ? '↑' : trend === 'declining' ? '↓' : trend === 'flat' ? '=' : '—';

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${
            test.domain === 'on_ice' ? 'bg-ink text-paper' : 'bg-sage/10 text-sage-dark border border-sage/30'
          }`}>
            {DOMAIN_LABELS[test.domain]}
          </span>
          <span className="font-medium text-ink">{test.title}</span>
        </div>
        <div className="text-[11px] text-ink-faint">
          {test.unit} · {test.direction === 'higher_is_better' ? '↑ higher better' : '↓ lower better'}
        </div>
      </div>

      <div className="flex items-center gap-6 flex-shrink-0">
        <div className="text-right">
          <div className="font-mono text-xs text-ink">
            {link.baseline_value !== null ? `${link.baseline_value}` : '—'}
          </div>
          <div className="kicker text-[9px] mt-0.5">Baseline</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs text-ink">
            {latest_value !== null ? latest_value : '—'}
          </div>
          <div className="kicker text-[9px] mt-0.5">Latest</div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-xs font-medium ${trendStyle}`}>
            {trendIcon} {trend === 'unknown' ? 'no data' : trend}
          </div>
          {latest_recorded_at && (
            <div className="kicker text-[9px] mt-0.5">{formatDate(latest_recorded_at.slice(0, 10))}</div>
          )}
        </div>
        <form action={toFormAction(detachTestFromPlan)}>
          <input type="hidden" name="id" value={link.id} />
          <input type="hidden" name="plan_id" value={planId} />
          <button type="submit" className="text-[10px] text-ink-faint hover:text-crimson font-mono uppercase tracking-wider">
            Detach
          </button>
        </form>
      </div>
    </div>
  );
}

function AttachTestModal({ open, onClose, plan, availableTests }: {
  open: boolean; onClose: () => void; plan: GoalPlan; availableTests: PerformanceTest[];
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState('');

  const selectedTest = availableTests.find((t) => t.id === selectedTestId);

  const handleSubmit = async (fd: FormData) => {
    fd.set('plan_id', plan.id);
    setSaving(true);
    setError(null);
    const res = await attachTestToPlan(fd);
    setSaving(false);
    if (res.ok) {
      setSelectedTestId('');
      onClose();
    } else {
      setError(res.error ?? 'Failed.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Attach a performance test" description="Track this test's results throughout the plan period.">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Test" required>
          <select name="test_id" value={selectedTestId} onChange={(e) => setSelectedTestId(e.target.value)} required className="input-base">
            <option value="" disabled>Choose a test&hellip;</option>
            <optgroup label="On-Ice">
              {availableTests.filter((t) => t.domain === 'on_ice').map((t) => (
                <option key={t.id} value={t.id}>{t.title}{t.unit ? ` (${t.unit})` : ''}</option>
              ))}
            </optgroup>
            <optgroup label="Off-Ice">
              {availableTests.filter((t) => t.domain === 'off_ice').map((t) => (
                <option key={t.id} value={t.id}>{t.title}{t.unit ? ` (${t.unit})` : ''}</option>
              ))}
            </optgroup>
          </select>
        </FormField>

        {selectedTest && (
          <div className="bg-sand-50 border border-sand-100 rounded-xl p-4 text-xs text-ink-dim">
            {selectedTest.description && <p className="mb-1">{selectedTest.description}</p>}
            <p>
              Unit: <span className="text-ink font-mono">{selectedTest.unit}</span> · Direction: <span className="text-ink">{selectedTest.direction === 'higher_is_better' ? 'higher is better' : 'lower is better'}</span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Baseline value" help="Starting point">
            <input type="number" step="any" name="baseline_value" className="input-base" />
          </FormField>
          <FormField label="Target value" help="Goal">
            <input type="number" step="any" name="target_value" className="input-base" />
          </FormField>
          <FormField label="Unit" help="Override">
            <input type="text" name="target_unit" defaultValue={selectedTest?.unit ?? ''} className="input-base" />
          </FormField>
        </div>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving || !selectedTestId} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Attaching\u2026' : 'Attach test'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Reviews section
// ----------------------------------------------------------------------------

function ReviewsSection({ plan, reviews }: { plan: GoalPlan; reviews: Review[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="kicker">Reviews · {reviews.length}</div>
        <button onClick={() => setAddOpen(true)} className="btn-secondary !h-9 text-xs">
          + New review
        </button>
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
                    <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-sage text-paper">
                      Completed
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-crimson/10 text-crimson border border-crimson/20">
                      Draft
                    </span>
                  )}
                </div>
                {r.summary && <div className="text-xs text-ink-dim line-clamp-1">{r.summary}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      <NewReviewModal open={addOpen} onClose={() => setAddOpen(false)} plan={plan} />
      <EditReviewModal open={editingReview !== null} onClose={() => setEditingReview(null)} review={editingReview} planId={plan.id} />
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
    <Modal open={open} onClose={onClose} title="New review" description="Start a review for this plan. You'll write the content and complete it from the review itself.">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Review type" required>
          <select name="review_type" defaultValue="scheduled" required className="input-base">
            <option value="scheduled">Scheduled</option>
            <option value="ad_hoc">Ad-hoc</option>
          </select>
        </FormField>

        <FormField label="Scheduled date" help="For scheduled reviews. Leave blank for ad-hoc.">
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

function EditReviewModal({ open, onClose, review, planId }: {
  open: boolean; onClose: () => void; review: Review | null; planId: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!review) return null;

  const isCompleted = review.completed_at !== null;

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
    if (!confirm('Complete this review? Once completed, it locks and can\'t be edited.')) return;
    const fd = new FormData();
    fd.set('id', review.id);
    fd.set('plan_id', planId);
    await completeReview(fd);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this review? This cannot be undone.')) return;
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
        {!isCompleted && (
          <FormField label="Scheduled date">
            <input type="date" name="scheduled_date" defaultValue={review.scheduled_date ?? ''} className="input-base" />
          </FormField>
        )}

        <FormField label="Summary" help={isCompleted ? '' : "Overall review notes. What's the state of this plan?"}>
          <textarea name="summary" defaultValue={review.summary ?? ''} rows={4} readOnly={isCompleted}
            className={`input-base resize-none ${isCompleted ? 'opacity-70 cursor-default' : ''}`} />
        </FormField>

        <FormField label="Concerns" help={isCompleted ? '' : 'What should the student / family / coach address?'}>
          <textarea name="concerns" defaultValue={review.concerns ?? ''} rows={3} readOnly={isCompleted}
            className={`input-base resize-none ${isCompleted ? 'opacity-70 cursor-default' : ''}`} />
        </FormField>

        <FormField label="Next steps" help={isCompleted ? '' : 'Concrete actions from this review.'}>
          <textarea name="next_steps" defaultValue={review.next_steps ?? ''} rows={3} readOnly={isCompleted}
            className={`input-base resize-none ${isCompleted ? 'opacity-70 cursor-default' : ''}`} />
        </FormField>

        {isCompleted && (
          <div className="text-xs text-ink-faint italic px-2">
            Completed {formatDate(review.completed_at!.slice(0, 10))}. This review is locked.
          </div>
        )}

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-between items-center pt-4 border-t border-ink-hair">
          <button type="button" onClick={handleDelete} className="text-xs text-crimson hover:text-crimson-dark font-mono uppercase tracking-wider">
            Delete
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">
              {isCompleted ? 'Close' : 'Cancel'}
            </button>
            {!isCompleted && (
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
