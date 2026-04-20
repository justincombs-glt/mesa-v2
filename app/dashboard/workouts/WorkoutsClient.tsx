'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createWorkout } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Student, WorkoutPlan } from '@/lib/supabase/types';
import type { WorkoutRow } from './page';

type StudentLite = Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'active'>;

interface Props {
  workouts: WorkoutRow[];
  plans: WorkoutPlan[];
  students: StudentLite[];
  seasonId: string | null;
  seasonArchived: boolean;
  addOnly?: boolean;
}

export function WorkoutsClient({ workouts, plans, students, seasonId, seasonArchived, addOnly }: Props) {
  const [open, setOpen] = useState(false);

  if (addOnly) {
    const disabled = seasonArchived || !seasonId;
    const reason = seasonArchived
      ? 'This season is archived — read-only'
      : !seasonId
      ? 'No active season'
      : '';
    return (
      <>
        <button onClick={() => setOpen(true)} disabled={disabled}
          className="btn-primary !h-10 !px-4 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
          title={reason}>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Schedule workout
        </button>
        <NewWorkoutModal open={open} onClose={() => setOpen(false)}
          plans={plans} students={students} seasonId={seasonId} />
      </>
    );
  }

  if (workouts.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No workouts scheduled yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          Schedule your first workout above. Attach a plan template or go ad-hoc — either way, you can log actual weight, reps, and RPE per set on the detail page.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card-base overflow-hidden">
        {workouts.map((w, idx) => <WorkoutRowItem key={w.id} workout={w} first={idx === 0} />)}
      </div>
      <NewWorkoutModal open={open} onClose={() => setOpen(false)}
        plans={plans} students={students} seasonId={seasonId} />
    </>
  );
}

function WorkoutRowItem({ workout, first }: { workout: WorkoutRow; first: boolean }) {
  const category = workout.off_ice_category === 'custom' && workout.custom_category_name
    ? workout.custom_category_name
    : workout.off_ice_category
    ? categoryLabel(workout.off_ice_category)
    : null;

  return (
    <Link href={`/dashboard/workouts/${workout.id}`}
      className={`flex items-center gap-4 px-5 py-4 group ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="flex-shrink-0 w-16 text-right">
        <div className="font-serif text-sm text-ink">{formatDate(workout.occurred_on)}</div>
        {workout.starts_at && (
          <div className="text-[10px] font-mono text-ink-faint mt-0.5">{workout.starts_at.slice(0, 5)}</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-ink text-paper">
            Off-ice
          </span>
          {category && (
            <span className="text-[9px] font-mono tracking-wider text-ink-faint uppercase">{category}</span>
          )}
          <span className="font-medium text-ink group-hover:text-crimson transition-colors truncate">
            {workout.title || workout.source_plan_title || 'Workout'}
          </span>
        </div>
        {workout.focus && <div className="text-xs text-ink-faint truncate">{workout.focus}</div>}
      </div>

      <div className="flex gap-6 flex-shrink-0 text-right text-xs">
        <div>
          <div className="font-mono text-sm text-ink">{workout.roster_count}</div>
          <div className="kicker text-[9px] mt-0.5">Roster</div>
        </div>
        <div>
          <div className="font-mono text-sm text-ink">{workout.exercise_count}</div>
          <div className="kicker text-[9px] mt-0.5">Exercises</div>
        </div>
        <div>
          <div className="font-mono text-sm text-ink">{workout.sets_logged}</div>
          <div className="kicker text-[9px] mt-0.5">Sets</div>
        </div>
      </div>
    </Link>
  );
}

function NewWorkoutModal({ open, onClose, plans, students, seasonId }: {
  open: boolean; onClose: () => void; plans: WorkoutPlan[]; students: StudentLite[]; seasonId: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('strength_conditioning');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(
    new Set(students.map((s) => s.id))
  );

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelectedStudents((prev) => {
      if (prev.size === students.length) return new Set();
      return new Set(students.map((s) => s.id));
    });
  };

  const handleSubmit = async (fd: FormData) => {
    setSaving(true);
    setError(null);
    if (seasonId) fd.set('season_id', seasonId);
    fd.set('student_ids', JSON.stringify(Array.from(selectedStudents)));
    const res = await createWorkout(fd);
    setSaving(false);
    if (res.ok && res.id) {
      router.push(`/dashboard/workouts/${res.id}`);
    } else {
      setError(res.error ?? 'Failed.');
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal open={open} onClose={onClose} title="Schedule a workout"
      description="Attach a plan template or leave blank for an ad-hoc session."
      maxWidth="620px">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Date" required>
            <input type="date" name="occurred_on" defaultValue={today} required className="input-base" />
          </FormField>
          <FormField label="Start time">
            <input type="time" name="starts_at" className="input-base" />
          </FormField>
          <FormField label="Duration (min)">
            <input type="number" name="duration_minutes" min="0" className="input-base" />
          </FormField>
        </div>

        <FormField label="Title">
          <input type="text" name="title" placeholder="e.g. Lower body, Plyos, Pilates" className="input-base" />
        </FormField>

        <FormField label="Focus">
          <input type="text" name="focus" className="input-base" />
        </FormField>

        <FormField label="Category">
          <select name="off_ice_category" value={category} onChange={(e) => setCategory(e.target.value)} className="input-base">
            <option value="strength_conditioning">Strength & Conditioning</option>
            <option value="pilates">Pilates</option>
            <option value="fight_club">Fight Club</option>
            <option value="custom">Custom…</option>
          </select>
        </FormField>

        {category === 'custom' && (
          <FormField label="Custom category name">
            <input type="text" name="custom_category_name" placeholder="e.g. Yoga, Mobility" className="input-base" />
          </FormField>
        )}

        <FormField label="Plan template (optional)">
          <select name="source_workout_plan_id" defaultValue="" className="input-base">
            <option value="">— Ad-hoc (no template) —</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </FormField>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="kicker">Roster ({selectedStudents.size} of {students.length})</label>
            <button type="button" onClick={toggleAll}
              className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-ink">
              {selectedStudents.size === students.length ? 'Uncheck all' : 'Check all'}
            </button>
          </div>
          <div className="card-base max-h-48 overflow-y-auto">
            {students.length === 0 ? (
              <div className="p-4 text-xs text-ink-faint text-center">No active students yet.</div>
            ) : (
              students.map((s, idx) => (
                <label key={s.id}
                  className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-ivory ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
                  <input type="checkbox" checked={selectedStudents.has(s.id)} onChange={() => toggleStudent(s.id)} />
                  {s.jersey_number && (
                    <span className="text-crimson font-serif text-sm w-8 text-right">#{s.jersey_number}</span>
                  )}
                  <span className="text-sm text-ink flex-1">{s.full_name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <FormField label="Notes">
          <textarea name="notes" rows={2} className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function categoryLabel(c: string): string {
  if (c === 'strength_conditioning') return 'Strength & Conditioning';
  if (c === 'pilates') return 'Pilates';
  if (c === 'fight_club') return 'Fight Club';
  return c;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
