'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateWorkout, deleteWorkout,
  addStudentToActivity, removeStudentFromActivity,
  addWorkoutExercise, updateWorkoutExercise, deleteWorkoutExercise,
  upsertWorkoutSet,
} from '@/app/actions';
import { toFormAction } from '@/lib/form-helpers';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Activity, Exercise } from '@/lib/supabase/types';
import type { RosterStudent, ResolvedExercise, SetCell, SetMap } from './page';

type ExerciseLite = Pick<Exercise, 'id' | 'title' | 'category' | 'active'>;

interface Props {
  workout: Activity;
  roster: RosterStudent[];
  addableStudents: RosterStudent[];
  exercises: ResolvedExercise[];
  addableExercises: ExerciseLite[];
  setMap: SetMap;
  readOnly: boolean;
}

export function WorkoutDetailClient({
  workout, roster, addableStudents, exercises, addableExercises, setMap, readOnly,
}: Props) {
  return (
    <div className="flex flex-col gap-10">
      <MetaSection workout={workout} readOnly={readOnly} />
      <RosterSection workout={workout} roster={roster}
        addableStudents={addableStudents} readOnly={readOnly} />
      <ExercisesSection
        workout={workout} roster={roster}
        exercises={exercises}
        addableExercises={addableExercises}
        setMap={setMap}
        readOnly={readOnly}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Meta
// ----------------------------------------------------------------------------

function MetaSection({ workout, readOnly }: { workout: Activity; readOnly: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(workout.off_ice_category ?? 'strength_conditioning');

  const handleSave = async (fd: FormData) => {
    fd.set('id', workout.id);
    setSaving('saving');
    setError(null);
    const res = await updateWorkout(fd);
    if (res.ok) {
      setSaving('saved');
      setTimeout(() => { setSaving('idle'); setEditing(false); }, 1000);
    } else {
      setSaving('error');
      setError(res.error ?? 'Failed.');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this workout? All exercises and logged sets will be lost.')) return;
    const fd = new FormData();
    fd.set('id', workout.id);
    await deleteWorkout(fd);
    router.push('/dashboard/workouts');
  };

  if (!editing) {
    if (readOnly) return null;
    return (
      <section className="flex items-center justify-end gap-2 pb-2 -mt-4">
        <button onClick={() => setEditing(true)} className="btn-secondary !h-9 text-xs">
          Edit workout
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="kicker mb-4">Edit workout</div>
      <form action={handleSave} className="card-base p-6 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Date" required>
            <input type="date" name="occurred_on" defaultValue={workout.occurred_on} required className="input-base" />
          </FormField>
          <FormField label="Start time">
            <input type="time" name="starts_at" defaultValue={workout.starts_at?.slice(0, 5) ?? ''} className="input-base" />
          </FormField>
          <FormField label="Duration (min)">
            <input type="number" inputMode="decimal" name="duration_minutes" defaultValue={workout.duration_minutes ?? ''} min="0" className="input-base" />
          </FormField>
        </div>

        <FormField label="Title">
          <input type="text" name="title" defaultValue={workout.title ?? ''} className="input-base" />
        </FormField>

        <FormField label="Focus">
          <input type="text" name="focus" defaultValue={workout.focus ?? ''} className="input-base" />
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
            <input type="text" name="custom_category_name" defaultValue={workout.custom_category_name ?? ''} className="input-base" />
          </FormField>
        )}

        <FormField label="Notes">
          <textarea name="notes" defaultValue={workout.notes ?? ''} rows={2} className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-between items-center pt-4 border-t border-ink-hair">
          <button type="button" onClick={handleDelete}
            className="text-xs text-crimson hover:text-crimson-dark font-mono uppercase tracking-wider">
            Delete workout
          </button>
          <div className="flex items-center gap-3">
            {saving === 'saved' && <span className="text-sm text-sage-dark">✓ Saved</span>}
            <button type="button" onClick={() => setEditing(false)} disabled={saving === 'saving'}
              className="btn-secondary !h-10 text-[13px]">Cancel</button>
            <button type="submit" disabled={saving === 'saving'} className="btn-primary !h-10 text-[13px]">
              {saving === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Roster
// ----------------------------------------------------------------------------

function RosterSection({ workout, roster, addableStudents, readOnly }: {
  workout: Activity; roster: RosterStudent[]; addableStudents: RosterStudent[]; readOnly: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="kicker">Roster · {roster.length} player{roster.length === 1 ? '' : 's'}</div>
        {!readOnly && (
          <button onClick={() => setAddOpen(true)} disabled={addableStudents.length === 0}
            className="btn-secondary !h-9 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            title={addableStudents.length === 0 ? 'All enrolled students already on roster' : ''}>
            + Add player
          </button>
        )}
      </div>

      {roster.length === 0 ? (
        <div className="card-base p-6 text-center text-sm text-ink-dim">
          No players on this workout yet.
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {roster.map((s, idx) => (
            <div key={s.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
              {s.jersey_number ? (
                <div className="font-serif text-lg text-crimson w-8 text-right flex-shrink-0">#{s.jersey_number}</div>
              ) : <div className="w-8 flex-shrink-0" />}
              <div className="text-sm text-ink flex-1">{s.full_name}</div>
              {!readOnly && (
                <form action={toFormAction(removeStudentFromActivity)}
                  onSubmit={(e) => { if (!confirm(`Remove ${s.full_name}?`)) e.preventDefault(); }}>
                  <input type="hidden" name="activity_id" value={workout.id} />
                  <input type="hidden" name="student_id" value={s.id} />
                  <button type="submit" className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson">
                    Remove
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <AddPlayerModal open={addOpen} onClose={() => setAddOpen(false)}
        workoutId={workout.id} available={addableStudents} />
    </section>
  );
}

function AddPlayerModal({ open, onClose, workoutId, available }: {
  open: boolean; onClose: () => void; workoutId: string; available: RosterStudent[];
}) {
  const [saving, setSaving] = useState<string | null>(null);

  const handleAdd = async (studentId: string) => {
    setSaving(studentId);
    const fd = new FormData();
    fd.set('activity_id', workoutId);
    fd.set('student_id', studentId);
    await addStudentToActivity(fd);
    setSaving(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="Add player to workout"
      description="Only current-season-enrolled students appear here." maxWidth="500px">
      {available.length === 0 ? (
        <div className="text-sm text-ink-dim p-4 text-center">No enrolled students available.</div>
      ) : (
        <div className="card-base overflow-hidden max-h-[50vh] overflow-y-auto">
          {available.map((s, idx) => (
            <button key={s.id} type="button" onClick={() => handleAdd(s.id)} disabled={saving === s.id}
              className={`w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-ivory ${idx > 0 ? 'border-t border-ink-hair' : ''} disabled:opacity-50`}>
              {s.jersey_number ? (
                <div className="font-serif text-lg text-crimson w-8 text-right flex-shrink-0">#{s.jersey_number}</div>
              ) : <div className="w-8 flex-shrink-0" />}
              <span className="text-sm text-ink flex-1">{s.full_name}</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                {saving === s.id ? 'Adding…' : 'Add'}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end pt-4 mt-4 border-t border-ink-hair">
        <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Close</button>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Exercises + per-set logging (the hero)
// ----------------------------------------------------------------------------

function ExercisesSection({
  workout, roster, exercises, addableExercises, setMap, readOnly,
}: {
  workout: Activity; roster: RosterStudent[];
  exercises: ResolvedExercise[]; addableExercises: ExerciseLite[];
  setMap: SetMap; readOnly: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="kicker">Exercises · {exercises.length}</div>
        {!readOnly && (
          <button onClick={() => setAddOpen(true)} disabled={addableExercises.length === 0}
            className="btn-secondary !h-9 text-xs disabled:opacity-50">
            + Add exercise
          </button>
        )}
      </div>

      {exercises.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            No exercises in this workout yet. Add one above to start logging.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {exercises.map((ex) => (
            <ExerciseCard key={ex.id}
              workoutExercise={ex} roster={roster}
              activityId={workout.id}
              setMap={setMap}
              readOnly={readOnly} />
          ))}
        </div>
      )}

      <AddExerciseModal open={addOpen} onClose={() => setAddOpen(false)}
        activityId={workout.id} exercises={addableExercises}
        existingExerciseIds={exercises.map((e) => e.exercise_id)} />
    </section>
  );
}

function ExerciseCard({ workoutExercise, roster, activityId, setMap, readOnly }: {
  workoutExercise: ResolvedExercise; roster: RosterStudent[]; activityId: string;
  setMap: SetMap; readOnly: boolean;
}) {
  const router = useRouter();
  const [editingMeta, setEditingMeta] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Remove "${workoutExercise.exercise_title}" from this workout? All logged sets for it will be lost.`)) return;
    const fd = new FormData();
    fd.set('id', workoutExercise.id);
    fd.set('activity_id', activityId);
    await deleteWorkoutExercise(fd);
    router.refresh();
  };

  const handleMetaSave = async (fd: FormData) => {
    fd.set('id', workoutExercise.id);
    fd.set('activity_id', activityId);
    setSavingMeta(true);
    const res = await updateWorkoutExercise(fd);
    setSavingMeta(false);
    if (res.ok) {
      setEditingMeta(false);
      router.refresh();
    }
  };

  return (
    <div className="card-base p-5">
      {editingMeta ? (
        <form action={handleMetaSave} className="flex flex-col gap-3 pb-4 mb-4 border-b border-ink-hair">
          <div className="text-sm font-medium text-ink">{workoutExercise.exercise_title}</div>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Target sets">
              <input type="number" inputMode="decimal" name="sets" defaultValue={workoutExercise.sets ?? ''} min="0" className="input-base !h-8 text-xs font-mono" />
            </FormField>
            <FormField label="Coach notes">
              <input type="text" name="coach_notes" defaultValue={workoutExercise.coach_notes ?? ''} className="input-base !h-8 text-xs" />
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditingMeta(false)} disabled={savingMeta}
              className="btn-secondary !h-8 text-xs">Cancel</button>
            <button type="submit" disabled={savingMeta} className="btn-primary !h-8 text-xs">
              {savingMeta ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between mb-4 pb-3 border-b border-ink-hair">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif text-lg text-crimson">{workoutExercise.sequence + 1}.</span>
              <span className="font-medium text-ink">{workoutExercise.exercise_title}</span>
              {workoutExercise.exercise_category && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                  {workoutExercise.exercise_category}
                </span>
              )}
              {workoutExercise.sets && (
                <span className="text-xs font-mono text-ink-dim">Target: {workoutExercise.sets} sets</span>
              )}
            </div>
            {workoutExercise.coach_notes && (
              <div className="text-xs text-ink-faint italic mt-1">{workoutExercise.coach_notes}</div>
            )}
          </div>
          {!readOnly && (
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setEditingMeta(true)}
                className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-ink">
                Edit
              </button>
              <button onClick={handleDelete}
                className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson">
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {roster.length === 0 ? (
        <p className="text-sm text-ink-dim text-center py-4">Add players to the roster to log sets.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {roster.map((student) => (
            <StudentSetRow key={student.id}
              workoutExerciseId={workoutExercise.id}
              activityId={activityId}
              student={student}
              targetSets={workoutExercise.sets}
              existingSets={setMap[`${workoutExercise.id}:${student.id}`] ?? []}
              readOnly={readOnly} />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentSetRow({ workoutExerciseId, activityId, student, targetSets, existingSets, readOnly }: {
  workoutExerciseId: string; activityId: string; student: RosterStudent;
  targetSets: number | null; existingSets: SetCell[]; readOnly: boolean;
}) {
  // Determine how many sets to render. If target is set, show max(target, existingSets.length). Otherwise min 1 or existingSets.length.
  const existingMax = existingSets.length > 0 ? existingSets[existingSets.length - 1].set_number : 0;
  const targetMax = targetSets ?? 0;
  const initialSetCount = Math.max(existingMax, targetMax, readOnly ? existingMax : 1);

  const [visibleSetCount, setVisibleSetCount] = useState(initialSetCount);

  const addSet = () => setVisibleSetCount((n) => n + 1);

  const setByNumber = new Map(existingSets.map((s) => [s.set_number, s]));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 pb-1 border-b border-ink-hair/60">
        {student.jersey_number && (
          <span className="text-crimson font-serif text-sm">#{student.jersey_number}</span>
        )}
        <span className="text-sm font-medium text-ink flex-1">{student.full_name}</span>
        {!readOnly && (
          <button onClick={addSet}
            className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-ink">
            + Add set
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {Array.from({ length: visibleSetCount }, (_, i) => {
          const setNumber = i + 1;
          const cell = setByNumber.get(setNumber) ?? null;
          return (
            <SetInputCell key={setNumber}
              workoutExerciseId={workoutExerciseId}
              activityId={activityId}
              studentId={student.id}
              setNumber={setNumber}
              initial={cell}
              readOnly={readOnly} />
          );
        })}
      </div>
    </div>
  );
}

function SetInputCell({ workoutExerciseId, activityId, studentId, setNumber, initial, readOnly }: {
  workoutExerciseId: string; activityId: string; studentId: string; setNumber: number;
  initial: SetCell | null; readOnly: boolean;
}) {
  const [weight, setWeight] = useState<string>(initial?.weight !== null && initial?.weight !== undefined ? String(initial.weight) : '');
  const [reps, setReps] = useState<string>(initial?.reps !== null && initial?.reps !== undefined ? String(initial.reps) : '');
  const [rpe, setRpe] = useState<string>(initial?.rpe !== null && initial?.rpe !== undefined ? String(initial.rpe) : '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<string>(JSON.stringify({
    w: initial?.weight ?? null, r: initial?.reps ?? null, e: initial?.rpe ?? null,
  }));

  const doSave = async () => {
    const current = JSON.stringify({
      w: weight.trim() === '' ? null : parseFloat(weight),
      r: reps.trim() === '' ? null : parseInt(reps, 10),
      e: rpe.trim() === '' ? null : parseInt(rpe, 10),
    });
    if (current === lastSaved) return;
    setStatus('saving');
    const fd = new FormData();
    fd.set('workout_exercise_id', workoutExerciseId);
    fd.set('activity_id', activityId);
    fd.set('student_id', studentId);
    fd.set('set_number', String(setNumber));
    fd.set('weight', weight.trim());
    fd.set('reps', reps.trim());
    fd.set('rpe', rpe.trim());
    const res = await upsertWorkoutSet(fd);
    if (res.ok) {
      setStatus('saved');
      setLastSaved(current);
      setTimeout(() => setStatus('idle'), 1200);
    } else {
      setStatus('error');
    }
  };

  const borderClass =
    status === 'error' ? 'border-crimson' :
    status === 'saved' ? 'border-sage' :
    status === 'saving' ? 'border-sand-200' :
    'border-ink-hair';

  return (
    <div className={`border-2 ${borderClass} rounded p-2 transition-colors`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[9px] font-mono uppercase tracking-wider text-ink-faint">Set {setNumber}</span>
        {status === 'saving' && <span className="text-[9px] text-ink-faint">saving…</span>}
      </div>
      <div className="grid grid-cols-3 gap-1">
        <div>
          <label className="block text-[9px] font-mono uppercase tracking-wider text-ink-faint mb-0.5">Wt (lb)</label>
          <input type="number" inputMode="decimal" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} onBlur={doSave}
            disabled={readOnly}
            className="w-full text-right font-mono text-xs px-1.5 py-1 rounded border border-ink-hair bg-paper focus:border-crimson focus:outline-none disabled:opacity-60" />
        </div>
        <div>
          <label className="block text-[9px] font-mono uppercase tracking-wider text-ink-faint mb-0.5">Reps</label>
          <input type="number" inputMode="decimal" value={reps} onChange={(e) => setReps(e.target.value)} onBlur={doSave}
            disabled={readOnly}
            className="w-full text-right font-mono text-xs px-1.5 py-1 rounded border border-ink-hair bg-paper focus:border-crimson focus:outline-none disabled:opacity-60" />
        </div>
        <div>
          <label className="block text-[9px] font-mono uppercase tracking-wider text-ink-faint mb-0.5">RPE</label>
          <input type="number" inputMode="decimal" min="1" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} onBlur={doSave}
            disabled={readOnly}
            className="w-full text-right font-mono text-xs px-1.5 py-1 rounded border border-ink-hair bg-paper focus:border-crimson focus:outline-none disabled:opacity-60" />
        </div>
      </div>
    </div>
  );
}

function AddExerciseModal({ open, onClose, activityId, exercises, existingExerciseIds }: {
  open: boolean; onClose: () => void; activityId: string;
  exercises: ExerciseLite[]; existingExerciseIds: string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (fd: FormData) => {
    fd.set('activity_id', activityId);
    setSaving(true);
    setError(null);
    const res = await addWorkoutExercise(fd);
    setSaving(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      setError(res.error ?? 'Failed.');
    }
  };

  const existing = new Set(existingExerciseIds);
  const available = exercises.filter((e) => !existing.has(e.id));

  return (
    <Modal open={open} onClose={onClose} title="Add exercise to workout"
      description="Pick an exercise and optional target sets and notes.">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Exercise" required>
          <select name="exercise_id" required defaultValue="" className="input-base">
            <option value="" disabled>Select an exercise…</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>{e.title}{e.category ? ` · ${e.category}` : ''}</option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Target sets">
            <input type="number" inputMode="decimal" name="sets" min="0" className="input-base" />
          </FormField>
        </div>

        <FormField label="Coach notes">
          <textarea name="coach_notes" rows={2} className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Adding…' : 'Add exercise'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
