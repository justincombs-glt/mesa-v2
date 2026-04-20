'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createGoalPlan } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Student, GoalPlanStatus } from '@/lib/supabase/types';
import type { PlanRow } from './page';

type StudentLite = Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'active'>;

interface Props {
  plans: PlanRow[];
  students: StudentLite[];
  addOnly?: boolean;
}

const STATUSES: GoalPlanStatus[] = ['draft', 'active', 'completed', 'archived'];

export function GoalManagementClient({ plans, students, addOnly }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<GoalPlanStatus | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (p.title + ' ' + p.student_name).toLowerCase().includes(q);
    });
  }, [plans, query, statusFilter]);

  if (addOnly) {
    return (
      <>
        <button
          onClick={() => setAddOpen(true)}
          disabled={students.length === 0}
          className="btn-primary !h-10 !px-4 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
          title={students.length === 0 ? 'Enroll students first' : ''}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New plan
        </button>
        <NewPlanModal open={addOpen} onClose={() => setAddOpen(false)} students={students} />
      </>
    );
  }

  if (students.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No students enrolled</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          You need at least one student before creating a goal plan. Head to <Link href="/dashboard/students" className="text-crimson font-medium">Students</Link> and enroll someone first.
        </p>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No goal plans yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          Create your first goal plan. A plan bundles 1–3 goals, optional performance test tracking, and review history for a single student.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mist pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plans by title or student…" className="input-base !pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as GoalPlanStatus | 'all')}
          className="input-base !w-auto capitalize">
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-8 text-center text-sm text-ink-dim">No matches.</div>
      ) : (
        <div className="card-base overflow-hidden">
          {filtered.map((p, idx) => (
            <Link key={p.id} href={`/dashboard/goal-management/${p.id}`}
              className={`flex items-center gap-4 px-5 py-4 group ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-medium text-ink group-hover:text-crimson transition-colors truncate">{p.title}</span>
                  <StatusPill status={p.status} />
                </div>
                <div className="flex gap-2 text-xs text-ink-faint items-center">
                  {p.student_jersey && <span className="text-crimson font-medium">#{p.student_jersey}</span>}
                  <span>{p.student_name}</span>
                  {p.starts_on && p.ends_on && (
                    <span className="text-ink-faint">· {formatShort(p.starts_on)} → {formatShort(p.ends_on)}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-6 flex-shrink-0 text-right">
                <div>
                  <div className="font-mono text-sm text-ink">{p.goal_count}</div>
                  <div className="kicker text-[9px] mt-0.5">Goals</div>
                </div>
                <div>
                  <div className="font-mono text-sm text-ink">{p.test_count}</div>
                  <div className="kicker text-[9px] mt-0.5">Tests</div>
                </div>
                <div>
                  <div className="font-mono text-sm text-ink">{p.review_count}</div>
                  <div className="kicker text-[9px] mt-0.5">Reviews</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <NewPlanModal open={addOpen} onClose={() => setAddOpen(false)} students={students} />
    </>
  );
}

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

function formatShort(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function NewPlanModal({ open, onClose, students }: { open: boolean; onClose: () => void; students: StudentLite[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setError(null);
    const res = await createGoalPlan(formData);
    setSaving(false);
    if (res.ok && res.id) {
      router.push(`/dashboard/goal-management/${res.id}`);
    } else {
      setError(res.error ?? 'Something went wrong.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New goal plan" description="Set up the basics. You'll add goals, attach performance tests, and create reviews on the detail page.">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Student" required>
          <select name="student_id" required defaultValue="" className="input-base">
            <option value="" disabled>Choose a student&hellip;</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.jersey_number ? `#${s.jersey_number} · ` : ''}{s.full_name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Plan title" required>
          <input type="text" name="title" required placeholder="e.g. Fall 2025 Season Plan" className="input-base" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start date">
            <input type="date" name="starts_on" className="input-base" />
          </FormField>
          <FormField label="End date">
            <input type="date" name="ends_on" className="input-base" />
          </FormField>
        </div>

        <FormField label="Agreement notes" help="Optional. Record of discussion with student/family.">
          <textarea name="agreement_notes" rows={3} className="input-base resize-none" placeholder='e.g. "Discussed with Sarah & Bill on 8/20. Both agreed on skating focus this season."' />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Creating\u2026' : 'Create plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
