'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPracticePlan } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { PracticePlanRow } from './page';

interface Props {
  plans: PracticePlanRow[];
  addOnly?: boolean;
}

export function PracticePlansClient({ plans, addOnly }: Props) {
  const [open, setOpen] = useState(false);

  if (addOnly) {
    return (
      <>
        <button onClick={() => setOpen(true)} className="btn-primary !h-10 !px-4 text-[13px]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New plan
        </button>
        <CreatePlanModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No practice plans yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          Build your first practice plan template. Add drills from the library and free-text &ldquo;skills&rdquo; (e.g., power skating, edge work). Coaches reuse these when scheduling actual practices.
        </p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {plans.map((p) => (
        <Link key={p.id} href={`/dashboard/practice-plans/${p.id}`} className="card-base p-5 h-full flex flex-col group">
          <div className="flex justify-between items-start mb-3 gap-2">
            <h3 className="font-serif text-lg text-ink leading-tight group-hover:text-crimson transition-colors">{p.title}</h3>
            {p.duration_minutes && (
              <div className="font-mono text-[10px] text-ink-faint flex-shrink-0">{p.duration_minutes} min</div>
            )}
          </div>
          {p.focus && <div className="kicker text-[9px] mb-2">{p.focus}</div>}
          {p.description && <p className="text-sm text-ink-dim leading-relaxed line-clamp-2 mb-3 flex-1">{p.description}</p>}
          <div className="flex gap-3 text-xs text-ink-faint pt-3 border-t border-ink-hair mt-auto">
            <span><span className="text-ink font-medium">{p.drill_count}</span> drill{p.drill_count === 1 ? '' : 's'}</span>
            <span><span className="text-ink font-medium">{p.skill_count}</span> skill{p.skill_count === 1 ? '' : 's'}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CreatePlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setError(null);
    // Don't pass items at create time — the user adds them on the detail page
    formData.set('items', '[]');
    const res = await createPracticePlan(formData);
    setSaving(false);
    if (res.ok && res.id) {
      router.push(`/dashboard/practice-plans/${res.id}`);
    } else {
      setError(res.error ?? 'Something went wrong.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New practice plan" description="Set up the basics. You'll add drills and skills on the detail page.">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Title" required>
          <input type="text" name="title" required placeholder="e.g. U14 Skating Focus" className="input-base" />
        </FormField>
        <FormField label="Focus" help="One-line summary of what this plan emphasizes.">
          <input type="text" name="focus" placeholder="Edge work and crossovers" className="input-base" />
        </FormField>
        <FormField label="Description">
          <textarea name="description" rows={3} className="input-base resize-none" />
        </FormField>
        <FormField label="Duration (min)">
          <input type="number" name="duration_minutes" min="15" max="180" placeholder="60" className="input-base" />
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
