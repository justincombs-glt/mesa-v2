'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateStudentTeam } from '@/app/actions';
import { ScheduleGameModal } from '@/components/games/ScheduleGameModal';
import type { Student } from '@/lib/supabase/types';

interface Props {
  student: Pick<Student, 'id' | 'full_name' | 'team_label'>;
}

/**
 * Student-side header strip on /dashboard/my-games. Shows:
 *  - Current team_label with inline edit
 *  - "+ Schedule" button that opens the shared ScheduleGameModal
 */
export function MyGamesHeader({ student }: Props) {
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <section className="card-base p-4 mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <TeamEditor student={student} />

      <button
        type="button"
        onClick={() => setScheduleOpen(true)}
        className="btn-primary !h-10 text-[13px] !px-4 flex-shrink-0"
      >
        + Schedule a game
      </button>

      <ScheduleGameModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        student={student}
      />
    </section>
  );
}

function TeamEditor({ student }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(student.team_label ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set('id', student.id);
    fd.set('team_label', value);
    const res = await updateStudentTeam(fd);
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(res.error ?? 'Could not save.');
    }
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="kicker mb-1">My team</div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. U14 Maple Leafs"
            className="input-base"
            autoFocus
          />
          {error && <div className="text-xs text-crimson">{error}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary !h-8 text-[11px] !px-3"
            >
              {saving ? 'Saving\u2026' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setValue(student.team_label ?? ''); setError(null); }}
              className="btn-secondary !h-8 text-[11px] !px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="font-serif text-ink">
            {student.team_label || <span className="text-ink-faint italic">No team set</span>}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
