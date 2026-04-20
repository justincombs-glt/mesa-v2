'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createStudent, reactivateStudent } from '@/app/actions';
import { toFormAction } from '@/lib/form-helpers';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { StudentRow } from './page';

interface Props {
  students: StudentRow[];
  inactiveStudents?: StudentRow[];
  addOnly?: boolean;
  primaryAction?: boolean;
}

export function StudentsClient({ students, inactiveStudents = [], addOnly, primaryAction }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const hay = `${s.full_name} ${s.jersey_number ?? ''} ${s.position ?? ''} ${s.team_label ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [students, query]);

  if (addOnly) {
    return (
      <>
        <button
          onClick={() => setAddOpen(true)}
          className={primaryAction ? 'btn-primary' : 'btn-primary !h-10 !px-4 text-[13px]'}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {primaryAction ? 'Enroll your first student' : 'Enroll student'}
        </button>
        <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-5 gap-3">
        <div className="flex-1 max-w-md relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mist pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, jersey, position, team…" className="input-base !pl-10" />
        </div>
        <div className="kicker flex-shrink-0">
          {filtered.length} of {students.length} active
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-8 text-center text-sm text-ink-dim">
          No matches.
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {filtered.map((s, idx) => <StudentRowItem key={s.id} student={s} first={idx === 0} />)}
        </div>
      )}

      {inactiveStudents.length > 0 && (
        <div className="mt-10">
          <div className="kicker mb-3">Inactive · {inactiveStudents.length}</div>
          <div className="card-base overflow-hidden">
            {inactiveStudents.map((s, idx) => <StudentRowItem key={s.id} student={s} first={idx === 0} inactive />)}
          </div>
        </div>
      )}

      <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function StudentRowItem({ student, first, inactive }: { student: StudentRow; first: boolean; inactive?: boolean }) {
  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${first ? '' : 'border-t border-ink-hair'} ${inactive ? 'opacity-60' : ''}`}>
      <Link href={`/dashboard/students/${student.id}`} className="flex items-center gap-4 min-w-0 flex-1 group">
        {student.jersey_number ? (
          <div className="font-serif text-xl text-crimson leading-none flex-shrink-0 w-10 text-right">
            #{student.jersey_number}
          </div>
        ) : <div className="w-10 flex-shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium text-ink truncate group-hover:text-crimson transition-colors">{student.full_name}</div>
            {student.hasLogin && (
              <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded text-sage-dark bg-sage/10 border border-sage/30">
                Has login
              </span>
            )}
          </div>
          <div className="flex gap-2 text-xs text-ink-faint mt-0.5 flex-wrap">
            {student.position && <span>{positionLabel(student.position)}</span>}
            {student.dominant_hand && <span>· {student.dominant_hand}-shot</span>}
            {student.team_label && <span>· {student.team_label}</span>}
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right">
          <div className="font-mono text-sm text-ink">{student.parentCount}</div>
          <div className="kicker text-[9px] mt-0.5">Parent{student.parentCount === 1 ? '' : 's'}</div>
        </div>
        {inactive && (
          <form action={toFormAction(reactivateStudent)}>
            <input type="hidden" name="id" value={student.id} />
            <button type="submit" className="text-xs font-mono uppercase tracking-wider text-ink-faint hover:text-sage-dark">
              Reactivate
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function AddStudentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setError(null);
    const res = await createStudent(formData);
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Something went wrong.');
  };

  return (
    <Modal open={open} onClose={onClose} title="Enroll a new student" description="Profile only — link parents and login from the student detail page after enrollment.">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Full name" required>
          <input type="text" name="full_name" required placeholder="First Last" className="input-base" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date of birth">
            <input type="date" name="date_of_birth" className="input-base" />
          </FormField>
          <FormField label="Jersey #">
            <input type="text" name="jersey_number" placeholder="17" className="input-base" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Position">
            <select name="position" className="input-base">
              <option value="">—</option>
              <option value="F">Forward</option>
              <option value="D">Defense</option>
              <option value="G">Goalie</option>
            </select>
          </FormField>
          <FormField label="Shoots / Catches">
            <select name="dominant_hand" className="input-base">
              <option value="">—</option>
              <option value="L">Left</option>
              <option value="R">Right</option>
            </select>
          </FormField>
        </div>

        <FormField label="Team label" help="Optional descriptive tag (e.g., 'U14 AAA'). Not a relationship — just metadata.">
          <input type="text" name="team_label" placeholder="U14 AAA" className="input-base" />
        </FormField>

        <FormField label="Notes" help="Visible to staff only.">
          <textarea name="notes" rows={2} className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Enrolling\u2026' : 'Enroll student'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function positionLabel(p: string) {
  return p === 'F' ? 'Forward' : p === 'D' ? 'Defense' : 'Goalie';
}
