'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateStudentTeam } from '@/app/actions';
import { ScheduleGameModal } from '@/components/games/ScheduleGameModal';
import type { Student } from '@/lib/supabase/types';

interface Props {
  student: Pick<Student, 'id' | 'full_name' | 'team_label'>;
}

export function FamilyControls({ student }: Props) {
  return (
    <section className="card-base p-5 flex flex-col gap-5">
      <TeamEditor student={student} />
      <div className="border-t border-ink-hair pt-5">
        <ScheduleGameTrigger student={student} />
      </div>
      <div className="border-t border-ink-hair pt-5">
        <NutritionLink student={student} />
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Link to per-child nutrition page
// ----------------------------------------------------------------------------

function NutritionLink({ student }: Props) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="kicker">Nutrition</div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-0.5">
          Daily calorie goal &amp; food log for {student.full_name.split(' ')[0]}
        </div>
      </div>
      <Link
        href={`/dashboard/family/${student.id}/nutrition`}
        className="btn-secondary !h-9 text-[12px] !px-4"
      >
        Open
      </Link>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Team label inline editor
// ----------------------------------------------------------------------------

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
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0">
        <div className="kicker">{student.full_name.split(' ')[0]}&apos;s team</div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-0.5">
          Home team on games
        </div>
      </div>
      <div className="flex-1 min-w-0">
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
                className="btn-primary !h-9 text-[12px] !px-4"
              >
                {saving ? 'Saving\u2026' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setValue(student.team_label ?? ''); setError(null); }}
                className="btn-secondary !h-9 text-[12px] !px-4"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
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
    </div>
  );
}

// ----------------------------------------------------------------------------
// Schedule game trigger
// ----------------------------------------------------------------------------

function ScheduleGameTrigger({ student }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="kicker">Schedule a game</div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-0.5">
            Add an upcoming game for {student.full_name}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-primary !h-9 text-[12px] !px-4"
        >
          + Schedule
        </button>
      </div>

      <ScheduleGameModal
        open={open}
        onClose={() => setOpen(false)}
        student={student}
      />
    </>
  );
}
