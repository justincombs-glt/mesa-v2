'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { upsertWorkoutSet, deleteWorkoutSet } from '@/app/actions';
import type { Activity } from '@/lib/supabase/types';
import type { RosterStudent, ResolvedExercise, SetCell, SetMap } from '../page';

interface Props {
  workout: Activity;
  roster: RosterStudent[];
  exercises: ResolvedExercise[];
  setMap: SetMap;
  readOnly: boolean;
  /** True when the logger is opened by a student logging their own sets. */
  studentMode?: boolean;
  /** Whether trash buttons appear on existing sets. False for students on multi-athlete workouts (Q7=C). */
  canDeleteSets?: boolean;
}

const REP_CHIPS = [3, 5, 8, 10, 12, 15];
const RPE_CHIPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function MobileWorkoutLogger({
  workout, roster, exercises, setMap, readOnly,
  studentMode = false, canDeleteSets = true,
}: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [hideAbsent, setHideAbsent] = useState(false);
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  // For student mode (single athlete), default the card to expanded so they don't
  // have to tap to start. For trainer mode, leave collapsed (they pick which athlete).
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(
    studentMode && roster.length === 1 ? roster[0].id : null
  );

  const activeExercise = exercises[activeIdx];
  const visibleRoster = useMemo(() => {
    return hideAbsent ? roster.filter((r) => !absentIds.has(r.id)) : roster;
  }, [hideAbsent, roster, absentIds]);

  const toggleAbsent = (studentId: string) => {
    setAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const goToNextExercise = () => {
    if (activeIdx < exercises.length - 1) {
      setActiveIdx(activeIdx + 1);
      // For student mode, keep their card expanded across exercise switches
      setExpandedStudentId(studentMode && roster.length === 1 ? roster[0].id : null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isLastExercise = activeIdx === exercises.length - 1;

  return (
    <>
      {/* Exercise pills - sticks under AppShell hamburger top bar on mobile */}
      <div className="sticky top-[60px] md:top-0 z-20 bg-ivory border-b border-ink-hair">
        <div className="flex gap-2 overflow-x-auto px-3 py-2.5 scrollbar-hide">
          {exercises.map((ex, idx) => {
            const isActive = idx === activeIdx;
            return (
              <button
                key={ex.id}
                onClick={() => {
                  setActiveIdx(idx);
                  setExpandedStudentId(studentMode && roster.length === 1 ? roster[0].id : null);
                }}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-ink text-paper'
                    : 'bg-paper text-ink-dim border border-ink-hair'
                }`}
              >
                <span className="text-[10px] font-mono opacity-60 mr-1.5">{idx + 1}/{exercises.length}</span>
                {ex.exercise_title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Athletes header — hidden in student mode (single self only) */}
      {!studentMode && (
        <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-3">
          <div className="kicker">Athletes · {visibleRoster.length}/{roster.length}</div>
          <label className="flex items-center gap-2 text-xs text-ink-dim cursor-pointer">
            <input
              type="checkbox"
              checked={hideAbsent}
              onChange={(e) => setHideAbsent(e.target.checked)}
              className="w-4 h-4 accent-ink"
            />
            Hide absent
          </label>
        </div>
      )}

      {/* Athlete cards */}
      <div className="flex-1 px-3 pt-3 pb-32 flex flex-col gap-2.5">
        {visibleRoster.length === 0 ? (
          <div className="card-base p-6 text-center text-sm text-ink-dim mt-2">
            No athletes to show. Toggle off &quot;Hide absent&quot; to see everyone.
          </div>
        ) : (
          visibleRoster.map((student) => {
            const sets = setMap[`${activeExercise.id}:${student.id}`] ?? [];
            const isExpanded = expandedStudentId === student.id;
            const isAbsent = absentIds.has(student.id);

            return (
              <AthleteCard
                key={student.id}
                workoutId={workout.id}
                exerciseId={activeExercise.id}
                exerciseTitle={activeExercise.exercise_title}
                student={student}
                sets={sets}
                expanded={isExpanded}
                absent={isAbsent}
                readOnly={readOnly}
                studentMode={studentMode}
                canDeleteSets={canDeleteSets}
                onToggleExpand={() => setExpandedStudentId(isExpanded ? null : student.id)}
                onToggleAbsent={() => toggleAbsent(student.id)}
              />
            );
          })
        )}
      </div>

      {/* Next exercise footer */}
      {!readOnly && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-paper border-t border-ink-hair px-3 py-3 flex items-center justify-between gap-3">
          <div className="kicker truncate flex-1 min-w-0">
            {isLastExercise ? 'Last exercise' : `Up next: ${exercises[activeIdx + 1]?.exercise_title ?? ''}`}
          </div>
          <button
            onClick={goToNextExercise}
            disabled={isLastExercise}
            className="btn-primary !h-11 !px-5 text-sm flex-shrink-0 disabled:opacity-40"
          >
            Next exercise →
          </button>
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
// AthleteCard — one card per athlete in the active exercise
// ----------------------------------------------------------------------------

interface AthleteCardProps {
  workoutId: string;
  exerciseId: string;
  exerciseTitle: string;
  student: RosterStudent;
  sets: SetCell[];
  expanded: boolean;
  absent: boolean;
  readOnly: boolean;
  studentMode: boolean;
  canDeleteSets: boolean;
  onToggleExpand: () => void;
  onToggleAbsent: () => void;
}

function AthleteCard({
  workoutId, exerciseId, exerciseTitle, student, sets, expanded, absent, readOnly,
  studentMode, canDeleteSets,
  onToggleExpand, onToggleAbsent,
}: AthleteCardProps) {
  const lastSet = sets.length > 0 ? sets[sets.length - 1] : null;

  return (
    <div className={`card-base overflow-hidden ${absent ? 'opacity-60' : ''}`}>
      {/* Header row — hide chevron and disable toggle in student mode (always expanded) */}
      <button
        onClick={onToggleExpand}
        disabled={readOnly || studentMode}
        className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-ivory disabled:cursor-default disabled:active:bg-paper"
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {student.jersey_number !== null && (
            <span className="text-crimson font-serif text-base">#{student.jersey_number}</span>
          )}
          <span className="font-medium text-ink truncate">{student.full_name}</span>
        </div>
        <div className="flex-shrink-0 flex items-center gap-3 text-[11px] font-mono uppercase tracking-wider text-ink-faint">
          {sets.length > 0 ? (
            <span>{sets.length} set{sets.length === 1 ? '' : 's'}</span>
          ) : (
            <span>No sets</span>
          )}
          {!readOnly && !studentMode && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          )}
        </div>
      </button>

      {/* Set history (always shown if any) */}
      {sets.length > 0 && (
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {sets.map((s) => (
            <SetHistoryRow
              key={s.id}
              workoutId={workoutId}
              set={s}
              readOnly={readOnly}
              canDelete={canDeleteSets}
            />
          ))}
        </div>
      )}

      {/* Inline form */}
      {expanded && !readOnly && (
        <SetEntryForm
          workoutId={workoutId}
          exerciseId={exerciseId}
          exerciseTitle={exerciseTitle}
          studentId={student.id}
          studentName={student.full_name}
          nextSetNumber={(lastSet?.set_number ?? 0) + 1}
          lastSet={lastSet}
          // Mark-absent button only relevant for trainers (Q11 = parents skipped, Q5 = student sees self only)
          onAbsent={!studentMode && !absent ? onToggleAbsent : undefined}
          isAbsent={absent}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// SetHistoryRow — one previously-logged set
// ----------------------------------------------------------------------------

function SetHistoryRow({ workoutId, set, readOnly, canDelete }: {
  workoutId: string; set: SetCell; readOnly: boolean; canDelete: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete set ${set.set_number}?`)) return;
    setDeleting(true);
    const fd = new FormData();
    fd.set('id', set.id);
    fd.set('activity_id', workoutId);
    const res = await deleteWorkoutSet(fd);
    setDeleting(false);
    if (res.ok) router.refresh();
    else alert(res.error ?? 'Could not delete.');
  };

  const summary = formatSetSummary(set);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="kicker text-[9px] flex-shrink-0 w-10">Set {set.set_number}</span>
      <span className="flex-1 font-mono text-ink">{summary}</span>
      {!readOnly && canDelete && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          aria-label={`Delete set ${set.set_number}`}
          className="w-9 h-9 -mr-2 grid place-items-center rounded-md text-ink-faint active:text-crimson active:bg-crimson/5 disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
        </button>
      )}
    </div>
  );
}

function formatSetSummary(s: SetCell): string {
  const parts: string[] = [];
  if (s.weight !== null) parts.push(`${s.weight} lb`);
  if (s.reps !== null) parts.push(`${s.reps} rep${s.reps === 1 ? '' : 's'}`);
  if (s.rpe !== null) parts.push(`RPE ${s.rpe}`);
  return parts.join(' · ') || '—';
}

// ----------------------------------------------------------------------------
// SetEntryForm — chips + decimal weight, save on Next set
// ----------------------------------------------------------------------------

interface SetEntryFormProps {
  workoutId: string;
  exerciseId: string;
  exerciseTitle: string;
  studentId: string;
  studentName: string;
  nextSetNumber: number;
  lastSet: SetCell | null;
  onAbsent?: () => void;
  isAbsent: boolean;
}

function SetEntryForm({
  workoutId, exerciseId, studentId, nextSetNumber, lastSet, onAbsent, isAbsent,
}: SetEntryFormProps) {
  const router = useRouter();
  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<number | null>(null);
  const [repsCustom, setRepsCustom] = useState<string>('');
  const [showCustomReps, setShowCustomReps] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repeatLast = () => {
    if (!lastSet) return;
    setWeight(lastSet.weight !== null ? String(lastSet.weight) : '');
    if (lastSet.reps !== null) {
      if (REP_CHIPS.includes(lastSet.reps)) {
        setReps(lastSet.reps);
        setShowCustomReps(false);
        setRepsCustom('');
      } else {
        setShowCustomReps(true);
        setRepsCustom(String(lastSet.reps));
        setReps(lastSet.reps);
      }
    }
    setRpe(lastSet.rpe);
  };

  const clearForm = () => {
    setWeight('');
    setReps(null);
    setRepsCustom('');
    setShowCustomReps(false);
    setRpe(null);
  };

  const handleSave = async () => {
    setError(null);
    // Resolve final reps value
    const finalReps = showCustomReps
      ? (repsCustom.trim() === '' ? null : parseInt(repsCustom, 10))
      : reps;

    if (weight.trim() === '' && finalReps === null && rpe === null) {
      setError('Enter at least one value.');
      return;
    }
    if (showCustomReps && finalReps !== null && (Number.isNaN(finalReps) || finalReps < 0)) {
      setError('Reps must be 0 or higher.');
      return;
    }

    setSaving(true);

    const fd = new FormData();
    fd.set('workout_exercise_id', exerciseId);
    fd.set('student_id', studentId);
    fd.set('set_number', String(nextSetNumber));
    fd.set('activity_id', workoutId);
    fd.set('weight', weight.trim());
    fd.set('reps', finalReps !== null ? String(finalReps) : '');
    fd.set('rpe', rpe !== null ? String(rpe) : '');

    const res = await upsertWorkoutSet(fd);
    setSaving(false);

    if (res.ok) {
      // Q9 = B: clear form, stay open
      clearForm();
      router.refresh();
    } else {
      setError(res.error ?? 'Could not save set.');
    }
  };

  return (
    <div className="border-t border-ink-hair px-4 py-4 bg-sand-50/50 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="kicker">Set {nextSetNumber}</div>
        <div className="flex items-center gap-2">
          {lastSet && (
            <button
              type="button"
              onClick={repeatLast}
              className="text-[11px] font-mono uppercase tracking-wider text-ink-dim active:text-ink"
            >
              ↻ Repeat last
            </button>
          )}
          {onAbsent && !isAbsent && (
            <button
              type="button"
              onClick={onAbsent}
              className="text-[11px] font-mono uppercase tracking-wider text-ink-faint active:text-crimson"
            >
              Mark absent
            </button>
          )}
        </div>
      </div>

      {/* Weight: decimal keyboard */}
      <div>
        <label className="kicker block mb-1.5">Weight (lb)</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="e.g. 185"
          className="input-base !h-12 text-base"
        />
      </div>

      {/* Reps: chips + Other */}
      <div>
        <label className="kicker block mb-1.5">Reps</label>
        {!showCustomReps ? (
          <div className="flex flex-wrap gap-2">
            {REP_CHIPS.map((n) => (
              <Chip key={n} value={n} active={reps === n} onClick={() => setReps(n)} />
            ))}
            <button
              type="button"
              onClick={() => { setShowCustomReps(true); setReps(null); }}
              className="px-3.5 h-10 rounded-full text-sm font-medium border border-ink-hair text-ink-dim active:bg-ivory"
            >
              Other…
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={repsCustom}
              onChange={(e) => setRepsCustom(e.target.value)}
              placeholder="reps"
              className="input-base !h-12 text-base flex-1"
            />
            <button
              type="button"
              onClick={() => { setShowCustomReps(false); setRepsCustom(''); }}
              className="text-[11px] font-mono uppercase tracking-wider text-ink-dim active:text-ink"
            >
              Use chips
            </button>
          </div>
        )}
      </div>

      {/* RPE: chips */}
      <div>
        <label className="kicker block mb-1.5">RPE</label>
        <div className="flex flex-wrap gap-1.5">
          {RPE_CHIPS.map((n) => (
            <Chip key={n} value={n} active={rpe === n} onClick={() => setRpe(n)} compact />
          ))}
        </div>
      </div>

      {error && <div className="text-sm text-crimson">{error}</div>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={clearForm}
          disabled={saving}
          className="btn-secondary !h-11 text-sm"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary !h-11 text-sm"
        >
          {saving ? 'Saving…' : 'Next set →'}
        </button>
      </div>
    </div>
  );
}

function Chip({ value, active, onClick, compact }: {
  value: number; active: boolean; onClick: () => void; compact?: boolean;
}) {
  const base = compact ? 'min-w-[40px] h-10 px-2.5' : 'min-w-[52px] h-10 px-3.5';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} rounded-full text-sm font-medium transition-colors ${
        active
          ? 'bg-ink text-paper'
          : 'bg-paper text-ink-dim border border-ink-hair active:bg-ivory'
      }`}
    >
      {value}
    </button>
  );
}
