'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { householdCreateGame } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Student } from '@/lib/supabase/types';

interface Props {
  open: boolean;
  onClose: () => void;
  student: Pick<Student, 'id' | 'full_name' | 'team_label'>;
}

/**
 * Phase 14: shared modal for households to schedule a game for a student.
 * Used by parents (on family detail) and by students themselves (on my-games).
 *
 * Always creates a single-student game (Q10=A — no roster picking, no cross-
 * student linking). The student's team_label is shown as the home team for
 * context but not editable here.
 */
export function ScheduleGameModal({ open, onClose, student }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('student_id', student.id);
    setSaving(true);
    setError(null);
    const res = await householdCreateGame(fd);
    setSaving(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      setError(res.error ?? 'Could not schedule.');
    }
  };

  const homeTeamLabel = student.team_label || `${student.full_name.split(' ')[0]}'s team`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule a game"
      description={`For ${student.full_name}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="card-base p-3 text-xs text-ink-dim bg-sand-50">
          Home team: <span className="text-ink font-medium">{homeTeamLabel}</span>
          {!student.team_label && (
            <span className="block text-ink-faint mt-0.5">
              Tip: set a team name in your profile so it appears here instead of the fallback.
            </span>
          )}
        </div>

        <FormField label="Opponent" required help="Free-text name of the opposing team.">
          <input type="text" name="opponent" required placeholder="e.g. Riverside Rangers" className="input-base" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date" required>
            <input type="date" name="occurred_on" required className="input-base" />
          </FormField>
          <FormField label="Start time">
            <input type="time" name="starts_at" className="input-base" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Home or away" required>
            <select name="home_away" required defaultValue="home" className="input-base">
              <option value="home">Home</option>
              <option value="away">Away</option>
            </select>
          </FormField>
          <FormField label="Duration (min)">
            <input type="number" name="duration_minutes" placeholder="75" min="1" max="300" className="input-base" />
          </FormField>
        </div>

        <FormField label="Venue">
          <input type="text" name="venue" placeholder="e.g. Lakeview Arena" className="input-base" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Scheduling\u2026' : 'Schedule game'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
