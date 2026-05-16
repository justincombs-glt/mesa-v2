'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSelfWorkout } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Exercise, WorkoutPlan } from '@/lib/supabase/types';

type ExerciseLite = Pick<Exercise, 'id' | 'title' | 'category' | 'default_sets' | 'default_reps'>;
type PlanLite = Pick<WorkoutPlan, 'id' | 'title' | 'focus'>;

interface Props {
  exercises: ExerciseLite[];
  plans: PlanLite[];
}

/**
 * Phase 18b: Player/Student "+ New workout" button and creation modal.
 *
 * Workflow:
 *   1. Tap "+ New workout" → modal opens
 *   2. Pick a date (default today), optional title/focus/notes
 *   3. Optionally pick a workout plan template (prefills exercises)
 *   4. Optionally add more exercises from the library (search-first list,
 *      multi-select per Q10 = C)
 *   5. Submit → server creates the workout + exercises → redirect to the
 *      mobile logger
 *
 * The DB trigger from Phase 18a allows the caller's own student row to be
 * added to the new workout because logged_by = caller.profile_id.
 */
export function NewWorkoutTrigger({ exercises, plans }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary !h-9 text-[13px] !px-4"
      >
        + New workout
      </button>
      <NewWorkoutModal
        open={open}
        onClose={() => setOpen(false)}
        exercises={exercises}
        plans={plans}
      />
    </>
  );
}

// ----------------------------------------------------------------------------
// Modal
// ----------------------------------------------------------------------------

function NewWorkoutModal({
  open, onClose, exercises, plans,
}: {
  open: boolean;
  onClose: () => void;
  exercises: ExerciseLite[];
  plans: PlanLite[];
}) {
  const router = useRouter();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [occurredOn, setOccurredOn] = useState<string>(todayStr);
  const [title, setTitle] = useState<string>('');
  const [focus, setFocus] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [offIceCategory, setOffIceCategory] = useState<string>('');
  const [planId, setPlanId] = useState<string>('');
  const [pickedExerciseIds, setPickedExerciseIds] = useState<string[]>([]);
  const [query, setQuery] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Q10 = C: search-first picker + scrollable list below.
  // Word-prefix matching keeps consistent with the food autocomplete pattern.
  const filteredExercises = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) => {
      const hay = `${e.title} ${e.category ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [exercises, query]);

  const handleToggleExercise = (id: string) => {
    setPickedExerciseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData();
    fd.set('occurred_on', occurredOn);
    fd.set('title', title);
    fd.set('focus', focus);
    fd.set('notes', notes);
    fd.set('off_ice_category', offIceCategory);
    if (planId) fd.set('source_workout_plan_id', planId);
    fd.set('exercise_ids_json', JSON.stringify(pickedExerciseIds));

    const res = await createSelfWorkout(fd);
    setSaving(false);
    if (res.ok && res.id) {
      onClose();
      // Reset form
      setTitle(''); setFocus(''); setNotes('');
      setOffIceCategory(''); setPlanId('');
      setPickedExerciseIds([]); setQuery('');
      router.push(`/dashboard/workouts/${res.id}/mobile`);
    } else {
      setError(res.error ?? 'Could not create workout.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New workout"
      description="Schedule and log your own off-ice session."
      maxWidth="640px"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date" required>
            <input
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              required
              className="input-base"
            />
          </FormField>
          <FormField label="Category" help="Optional grouping.">
            <select
              value={offIceCategory}
              onChange={(e) => setOffIceCategory(e.target.value)}
              className="input-base"
            >
              <option value="">{'\u2014'}</option>
              <option value="strength">Strength</option>
              <option value="conditioning">Conditioning</option>
              <option value="mobility">Mobility</option>
              <option value="recovery">Recovery</option>
              <option value="custom">Other</option>
            </select>
          </FormField>
        </div>

        <FormField label="Title" help={'Optional. Defaults to \u201cWorkout \u00b7 date\u201d if left blank.'}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="e.g. Push day, Leg day, Tempo intervals"
            className="input-base"
          />
        </FormField>

        <FormField label="Focus" help="Optional. Short tagline.">
          <input
            type="text"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            maxLength={200}
            placeholder="e.g. Heavy compounds, Aerobic base"
            className="input-base"
          />
        </FormField>

        {plans.length > 0 && (
          <FormField label="Template" help="Optional. Prefills exercises from an academy template.">
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="input-base"
            >
              <option value="">No template</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}{p.focus ? ` \u2014 ${p.focus}` : ''}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {/* Exercise picker */}
        <div>
          <div className="kicker mb-1.5">
            Exercises{pickedExerciseIds.length > 0 && (
              <span className="text-ink-dim ml-2 normal-case">
                &middot; {pickedExerciseIds.length} picked
              </span>
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the exercise library..."
            className="input-base mb-2"
          />
          <div className="card-base overflow-hidden max-h-64 overflow-y-auto">
            {filteredExercises.length === 0 ? (
              <div className="p-4 text-center text-xs text-ink-faint">
                {query ? 'No matches.' : 'Exercise library is empty.'}
              </div>
            ) : (
              filteredExercises.slice(0, 100).map((ex, idx) => {
                const picked = pickedExerciseIds.includes(ex.id);
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => handleToggleExercise(ex.id)}
                    className={`flex items-center gap-3 w-full text-left px-3 py-2 ${
                      idx === 0 ? '' : 'border-t border-ink-hair'
                    } ${picked ? 'bg-sage/10' : 'hover:bg-ivory'} transition-colors`}
                  >
                    <span className={`flex-shrink-0 w-4 h-4 border rounded flex items-center justify-center ${
                      picked ? 'bg-sage-dark border-sage-dark' : 'border-ink-hair bg-paper'
                    }`}>
                      {picked && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-paper">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </span>
                    <span className="text-sm text-ink truncate flex-1">{ex.title}</span>
                    {ex.category && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint flex-shrink-0">
                        {ex.category}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          {filteredExercises.length > 100 && (
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1.5 text-center">
              Showing first 100 &middot; refine search to narrow
            </div>
          )}
        </div>

        <FormField label="Notes" help="Optional. Anything you want to remember about this session.">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
            className="input-base resize-y min-h-[56px]"
          />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Creating\u2026' : 'Create & log'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
