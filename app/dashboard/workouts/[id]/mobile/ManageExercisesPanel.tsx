'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addSelfWorkoutExercise,
  removeSelfWorkoutExercise,
  reorderSelfWorkoutExercise,
} from '@/app/actions';
import { Modal } from '@/components/ui/Modal';

interface ExerciseLite {
  /** workout_exercises.id (NOT exercises.id) — needed to reorder/remove. */
  id: string;
  exercise_title: string;
}

interface AddableExercise {
  id: string;          // exercises.id
  title: string;
  category: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  activityId: string;
  exercises: ExerciseLite[];
  addableExercises: AddableExercise[];
}

/**
 * Phase 18b: lets the creator of a workout add/remove/reorder its exercises
 * mid-session. Mounted from MobileWorkoutLogger when `isCreator=true`.
 *
 * Operations:
 *   - Up/down arrows (Q11 = B) — swap sequence with neighbor
 *   - Remove — drops the workout_exercise row (cascades to its sets)
 *   - Add from library — search-first picker, single-tap to append
 */
export function ManageExercisesPanel({
  open, onClose, activityId, exercises, addableExercises,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  // Hide exercises already in the workout from the "add" picker
  const alreadyIn = useMemo(
    () => new Set(exercises.map((e) => e.id)),  // workout_exercise IDs, not exercise IDs
    [exercises]
  );
  // The picker uses exercises.id; we need to filter against the underlying
  // exercise_id of items already in the workout. Since the parent passes us
  // ResolvedExercise's `id` which IS the workout_exercise row's id, we can't
  // filter by exercise_id without extra plumbing. Keep it simple: show all
  // library exercises (player can add the same exercise twice if they really
  // want — sequence numbers differ).
  void alreadyIn; // suppress unused warning

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return addableExercises;
    return addableExercises.filter((e) => {
      const hay = `${e.title} ${e.category ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [addableExercises, query]);

  const handleReorder = async (workoutExerciseId: string, direction: 'up' | 'down') => {
    setBusy(true);
    const fd = new FormData();
    fd.set('activity_id', activityId);
    fd.set('workout_exercise_id', workoutExerciseId);
    fd.set('direction', direction);
    await reorderSelfWorkoutExercise(fd);
    setBusy(false);
    router.refresh();
  };

  const handleRemove = async (workoutExerciseId: string, name: string) => {
    if (!confirm(`Remove ${name} from this workout? Logged sets for it will also be removed.`)) return;
    setBusy(true);
    const fd = new FormData();
    fd.set('activity_id', activityId);
    fd.set('workout_exercise_id', workoutExerciseId);
    await removeSelfWorkoutExercise(fd);
    setBusy(false);
    router.refresh();
  };

  const handleAdd = async (exerciseId: string) => {
    setBusy(true);
    const fd = new FormData();
    fd.set('activity_id', activityId);
    fd.set('exercise_id', exerciseId);
    await addSelfWorkoutExercise(fd);
    setBusy(false);
    setQuery('');
    router.refresh();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage exercises"
      description="Reorder, remove, or add exercises to this workout."
      maxWidth="560px"
    >
      <div className="flex flex-col gap-4">
        {/* Current list */}
        <section>
          <div className="kicker mb-2">In this workout &middot; {exercises.length}</div>
          {exercises.length === 0 ? (
            <div className="card-base p-4 text-center text-sm text-ink-dim">
              No exercises yet. Add from the library below.
            </div>
          ) : (
            <div className="card-base overflow-hidden">
              {exercises.map((ex, idx) => (
                <div
                  key={ex.id}
                  className={`flex items-center gap-2 px-3 py-2.5 ${idx === 0 ? '' : 'border-t border-ink-hair'}`}
                >
                  <div className="flex-shrink-0 w-6 text-center text-[10px] font-mono text-ink-faint">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0 text-sm text-ink truncate">
                    {ex.exercise_title}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReorder(ex.id, 'up')}
                      disabled={busy || idx === 0}
                      className="w-7 h-7 inline-flex items-center justify-center text-ink-faint hover:text-ink disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 15 12 9 6 15"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorder(ex.id, 'down')}
                      disabled={busy || idx === exercises.length - 1}
                      className="w-7 h-7 inline-flex items-center justify-center text-ink-faint hover:text-ink disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(ex.id, ex.exercise_title)}
                      disabled={busy}
                      className="ml-1 px-2 text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson disabled:opacity-50"
                      aria-label="Remove"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add picker */}
        <section>
          <div className="kicker mb-2">Add from library</div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="input-base mb-2"
          />
          <div className="card-base overflow-hidden max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-ink-faint">
                {query ? 'No matches.' : 'Library is empty.'}
              </div>
            ) : (
              filtered.slice(0, 50).map((ex, idx) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => handleAdd(ex.id)}
                  disabled={busy}
                  className={`flex items-center gap-3 w-full text-left px-3 py-2 ${idx === 0 ? '' : 'border-t border-ink-hair'} hover:bg-ivory transition-colors disabled:opacity-50`}
                >
                  <span className="text-sm text-ink truncate flex-1">{ex.title}</span>
                  {ex.category && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint flex-shrink-0">
                      {ex.category}
                    </span>
                  )}
                  <span className="flex-shrink-0 text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                    Add &rarr;
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <div className="flex justify-end pt-3 border-t border-ink-hair">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary !h-10 text-[13px]"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
