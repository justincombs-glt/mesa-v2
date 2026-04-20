'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createWorkoutPlan } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { WorkoutPlanRow } from './page';

interface Props {
  plans: WorkoutPlanRow[];
  addOnly?: boolean;
}

export function WorkoutPlansClient({ plans, addOnly }: Props) {
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
        <NewPlanModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No workout plans yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          Build your first workout template above. Add exercises with target sets, reps, weights, and rest — then schedule a workout to use it.
        </p>
      </div>
    );
  }

  return (
    <div className="card-base overflow-hidden">
      {plans.map((p, idx) => <PlanRow key={p.id} plan={p} first={idx === 0} />)}
    </div>
  );
}

function PlanRow({ plan, first }: { plan: WorkoutPlanRow; first: boolean }) {
  return (
    <Link href={`/dashboard/workout-plans/${plan.id}`}
      className={`flex items-center gap-4 px-5 py-4 group ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink group-hover:text-crimson transition-colors">{plan.title}</div>
        {plan.focus && <div className="text-xs text-ink-faint mt-0.5 truncate">{plan.focus}</div>}
      </div>
      <div className="flex gap-6 flex-shrink-0 text-right text-xs">
        <div>
          <div className="font-mono text-sm text-ink">{plan.exercise_count}</div>
          <div className="kicker text-[9px] mt-0.5">Exercises</div>
        </div>
        {plan.duration_minutes && (
          <div>
            <div className="font-mono text-sm text-ink">{plan.duration_minutes}</div>
            <div className="kicker text-[9px] mt-0.5">Minutes</div>
          </div>
        )}
      </div>
    </Link>
  );
}

function NewPlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (fd: FormData) => {
    setSaving(true);
    setError(null);
    const res = await createWorkoutPlan(fd);
    setSaving(false);
    if (res.ok && res.id) {
      router.push(`/dashboard/workout-plans/${res.id}`);
    } else {
      setError(res.error ?? 'Failed.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New workout plan"
      description="Start with the basics — add exercises on the next screen.">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Title" required>
          <input type="text" name="title" required placeholder="Lower Body Strength" className="input-base" />
        </FormField>
        <FormField label="Focus">
          <input type="text" name="focus" placeholder="Squats, posterior chain, plyometrics" className="input-base" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Duration (min)">
            <input type="number" name="duration_minutes" min="0" className="input-base" />
          </FormField>
        </div>
        <FormField label="Description">
          <textarea name="description" rows={2} className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Creating…' : 'Create plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
