'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updatePractice, deletePractice,
  addStudentToActivity, removeStudentFromActivity, setAttendance,
} from '@/app/actions';
import { toFormAction } from '@/lib/form-helpers';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Activity, Student } from '@/lib/supabase/types';
import type { RosterEntry, ResolvedPracticeItem } from './page';

type AddableStudent = Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position' | 'active'>;

interface Props {
  practice: Activity;
  roster: RosterEntry[];
  items: ResolvedPracticeItem[];
  planTitle: string | null;
  addableStudents: AddableStudent[];
  readOnly: boolean;
}

export function PracticeDetailClient(props: Props) {
  const { practice, roster, items, planTitle, addableStudents, readOnly } = props;

  return (
    <div className="flex flex-col gap-10">
      <MetaSection practice={practice} readOnly={readOnly} />
      {planTitle && items.length > 0 && <ItemsSection items={items} planTitle={planTitle} />}
      <RosterAndAttendanceSection
        practice={practice} roster={roster} addableStudents={addableStudents} readOnly={readOnly}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------

function MetaSection({ practice, readOnly }: { practice: Activity; readOnly: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (fd: FormData) => {
    fd.set('id', practice.id);
    setSaving('saving');
    setError(null);
    const res = await updatePractice(fd);
    if (res.ok) {
      setSaving('saved');
      setTimeout(() => { setSaving('idle'); setEditing(false); }, 1200);
    } else {
      setSaving('error');
      setError(res.error ?? 'Failed.');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this practice? Roster + attendance go with it.')) return;
    const fd = new FormData();
    fd.set('id', practice.id);
    await deletePractice(fd);
    router.push('/dashboard/practices');
  };

  if (!editing) {
    return (
      <section className="flex items-start justify-between gap-4 pb-6 border-b border-ink-hair">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 text-sm text-ink-dim flex-wrap">
            {practice.occurred_on && <span className="font-mono">{formatDate(practice.occurred_on)}</span>}
            {practice.starts_at && <span>&middot; {formatTime(practice.starts_at)}</span>}
            {practice.duration_minutes && <span>&middot; {practice.duration_minutes} min</span>}
          </div>
          {practice.notes && <p className="text-sm text-ink-dim mt-1 max-w-xl">{practice.notes}</p>}
        </div>
        {!readOnly && (
          <button onClick={() => setEditing(true)} className="btn-secondary !h-9 text-xs">
            Edit
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="pb-6 border-b border-ink-hair">
      <div className="kicker mb-4">Edit practice</div>
      <form action={handleSubmit} className="card-base p-6 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Date" required>
            <input type="date" name="occurred_on" defaultValue={practice.occurred_on} required className="input-base" />
          </FormField>
          <FormField label="Start time">
            <input type="time" name="starts_at" defaultValue={practice.starts_at ?? ''} className="input-base" />
          </FormField>
          <FormField label="Duration (min)">
            <input type="number" name="duration_minutes" defaultValue={practice.duration_minutes ?? ''} min="15" max="240" className="input-base" />
          </FormField>
        </div>

        <FormField label="Title">
          <input type="text" name="title" defaultValue={practice.title ?? ''} className="input-base" />
        </FormField>
        <FormField label="Focus">
          <input type="text" name="focus" defaultValue={practice.focus ?? ''} className="input-base" />
        </FormField>
        <FormField label="Notes">
          <textarea name="notes" defaultValue={practice.notes ?? ''} rows={3} className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-between items-center pt-4 border-t border-ink-hair">
          <button type="button" onClick={handleDelete} className="text-xs text-crimson hover:text-crimson-dark font-mono uppercase tracking-wider">
            Delete practice
          </button>
          <div className="flex items-center gap-3">
            {saving === 'saved' && <span className="text-sm text-sage-dark">✓ Saved</span>}
            <button type="button" onClick={() => setEditing(false)} disabled={saving === 'saving'} className="btn-secondary !h-10 text-[13px]">
              Cancel
            </button>
            <button type="submit" disabled={saving === 'saving'} className="btn-primary !h-10 text-[13px]">
              {saving === 'saving' ? 'Saving\u2026' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

// ----------------------------------------------------------------------------

function ItemsSection({ items, planTitle }: { items: ResolvedPracticeItem[]; planTitle: string }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="kicker">Plan items &middot; from {planTitle}</div>
        <div className="text-[11px] text-ink-faint italic">
          Items shown from the source plan &mdash; edit the plan to change
        </div>
      </div>

      <ol className="card-base overflow-hidden">
        {items.map((it, idx) => (
          <li key={it.id} className={`flex items-start gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
            <span className="font-mono text-sm text-ink-faint w-5 text-right flex-shrink-0 mt-0.5">{idx + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${
                  it.item_type === 'drill' ? 'bg-ink text-paper' : 'bg-sand-100 text-ink border border-sand-200'
                }`}>
                  {it.item_type}
                </span>
                <span className="text-sm text-ink font-medium">
                  {it.item_type === 'drill' ? (it.drill?.title ?? '(missing drill)') : it.skill_title}
                </span>
                {it.item_type === 'drill' && it.drill?.category && (
                  <span className="text-[10px] text-ink-faint capitalize">{it.drill.category.replace('_', ' ')}</span>
                )}
                {(it.duration_override ?? it.drill?.duration_minutes) && (
                  <span className="text-[11px] text-ink-faint font-mono ml-auto">{it.duration_override ?? it.drill?.duration_minutes} min</span>
                )}
              </div>
              {it.coach_notes && (
                <div className="text-[11px] text-ink-dim italic mt-1 leading-relaxed">{it.coach_notes}</div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ----------------------------------------------------------------------------

function RosterAndAttendanceSection({ practice, roster, addableStudents, readOnly }: {
  practice: Activity; roster: RosterEntry[]; addableStudents: AddableStudent[]; readOnly: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="kicker">Roster &amp; attendance &middot; {roster.length} student{roster.length === 1 ? '' : 's'}</div>
        {!readOnly && (
          <button
            onClick={() => setAddOpen(true)}
            disabled={addableStudents.length === 0}
            className="btn-secondary !h-9 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            title={addableStudents.length === 0 ? 'All active students already in roster' : ''}
          >
            + Add student
          </button>
        )}
      </div>

      {roster.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim">
            Empty roster. Click <strong className="text-ink">+ Add student</strong> to add players.
          </p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {roster.map((entry, idx) => (
            <RosterRow key={entry.link.id} entry={entry} practice={practice} first={idx === 0} readOnly={readOnly} />
          ))}
        </div>
      )}

      <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)}
        practice={practice} addableStudents={addableStudents} />
    </section>
  );
}

function RosterRow({ entry, practice, first, readOnly }: {
  entry: RosterEntry; practice: Activity; first: boolean; readOnly: boolean;
}) {
  const { student, attendance, link } = entry;
  const [saving, setSaving] = useState(false);

  const setMark = async (value: 'true' | 'false' | '') => {
    if (readOnly || saving) return;
    setSaving(true);
    const fd = new FormData();
    fd.set('activity_id', practice.id);
    fd.set('student_id', student.id);
    fd.set('attended', value);
    await setAttendance(fd);
    setSaving(false);
  };

  const current = attendance?.attended === true ? 'present' : attendance?.attended === false ? 'absent' : 'unmarked';

  return (
    <div className={`flex items-center gap-3 px-5 py-3 ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {student.jersey_number && (
          <div className="font-serif text-lg text-crimson leading-none flex-shrink-0 w-8 text-right">#{student.jersey_number}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-ink truncate">{student.full_name}</div>
          <div className="text-[11px] text-ink-faint">
            {student.position && <span>{positionLabel(student.position)}</span>}
            {student.dominant_hand && <span> &middot; {student.dominant_hand}-shot</span>}
          </div>
        </div>
      </div>

      <div className="flex gap-1 flex-shrink-0">
        <AttendanceButton label="Present" active={current === 'present'}
          onClick={() => setMark('true')} disabled={readOnly || saving} tone="sage" />
        <AttendanceButton label="Absent" active={current === 'absent'}
          onClick={() => setMark('false')} disabled={readOnly || saving} tone="crimson" />
        {current !== 'unmarked' && !readOnly && (
          <button onClick={() => setMark('')} disabled={saving}
            className="text-[9px] font-mono uppercase tracking-wider text-ink-faint hover:text-ink px-2">
            Clear
          </button>
        )}
      </div>

      {!readOnly && (
        <form action={toFormAction(removeStudentFromActivity)}
          onSubmit={(e) => { if (!confirm(`Remove ${student.full_name} from this practice?`)) e.preventDefault(); }}
          className="flex-shrink-0">
          <input type="hidden" name="id" value={link.id} />
          <input type="hidden" name="activity_id" value={practice.id} />
          <button type="submit" className="text-[10px] text-ink-faint hover:text-crimson font-mono uppercase tracking-wider">
            Remove
          </button>
        </form>
      )}
    </div>
  );
}

function AttendanceButton({ label, active, onClick, disabled, tone }: {
  label: string; active: boolean; onClick: () => void; disabled: boolean; tone: 'sage' | 'crimson';
}) {
  const base = 'px-2.5 h-7 rounded-md text-[11px] font-mono uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  let style = 'border border-ink-hair bg-paper text-ink-faint hover:bg-ivory';
  if (active && tone === 'sage') style = 'border border-sage/40 bg-sage text-paper';
  if (active && tone === 'crimson') style = 'border border-crimson/40 bg-crimson text-paper';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${style}`}>
      {label}
    </button>
  );
}

function AddStudentModal({ open, onClose, practice, addableStudents }: {
  open: boolean; onClose: () => void; practice: Activity; addableStudents: AddableStudent[];
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (studentId: string) => {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set('activity_id', practice.id);
    fd.set('student_id', studentId);
    const res = await addStudentToActivity(fd);
    setSaving(false);
    if (!res.ok) setError(res.error ?? 'Failed.');
  };

  return (
    <Modal open={open} onClose={onClose} title="Add student" description="Pick an active student to add to this practice's roster.">
      <div className="flex flex-col gap-3">
        {addableStudents.length === 0 ? (
          <div className="text-sm text-ink-dim p-4 text-center">
            All active students are already in the roster.
          </div>
        ) : (
          <div className="card-base overflow-hidden max-h-[50vh] overflow-y-auto">
            {addableStudents.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleAdd(s.id)}
                disabled={saving}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-ivory disabled:opacity-50 ${idx > 0 ? 'border-t border-ink-hair' : ''}`}
              >
                {s.jersey_number && <span className="font-mono text-sm text-crimson flex-shrink-0 w-8 text-right">#{s.jersey_number}</span>}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">{s.full_name}</div>
                  {s.position && <div className="text-[10px] text-ink-faint uppercase">{positionLabel(s.position)}</div>}
                </div>
              </button>
            ))}
          </div>
        )}

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Close</button>
        </div>
      </div>
    </Modal>
  );
}

function positionLabel(p: string) {
  return p === 'F' ? 'Forward' : p === 'D' ? 'Defense' : 'Goalie';
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(hhmmss: string): string {
  const parts = hhmmss.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}
