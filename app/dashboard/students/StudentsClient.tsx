'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  createStudent, reactivateStudent,
  enrollStudentInSeason, departStudentFromSeason,
} from '@/app/actions';
import { toFormAction } from '@/lib/form-helpers';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { StudentRow } from './page';

type TabKey = 'roster' | 'all';

interface Props {
  roster: StudentRow[];
  notEnrolled: StudentRow[];
  inactive: StudentRow[];
  seasonId: string | null;
  seasonArchived: boolean;
  addOnly?: boolean;
  primaryAction?: boolean;
}

export function StudentsClient({ roster, notEnrolled, inactive, seasonId, seasonArchived, addOnly, primaryAction }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('roster');
  const [query, setQuery] = useState('');

  const total = roster.length + notEnrolled.length + inactive.length;

  if (addOnly) {
    return (
      <>
        <button
          onClick={() => setAddOpen(true)}
          disabled={seasonArchived}
          className={`${primaryAction ? 'btn-primary' : 'btn-primary !h-10 !px-4 text-[13px]'} disabled:opacity-50 disabled:cursor-not-allowed`}
          title={seasonArchived ? 'Cannot enroll in an archived season' : ''}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {primaryAction ? 'Enroll your first student' : 'Enroll student'}
        </button>
        <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} seasonId={seasonId} />
      </>
    );
  }

  // Filter for current tab
  const allStudents = [...roster, ...notEnrolled, ...inactive];
  const source = tab === 'roster' ? roster : allStudents;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter((s) => {
      const hay = `${s.full_name} ${s.jersey_number ?? ''} ${s.position ?? ''} ${s.team_label ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [source, query]);

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 border border-ink-hair rounded-full p-1 bg-paper self-start mb-5 w-fit">
        <TabPill active={tab === 'roster'} onClick={() => setTab('roster')} label={`Current Roster (${roster.length})`} />
        <TabPill active={tab === 'all'} onClick={() => setTab('all')} label={`All Students (${total})`} />
      </div>

      <div className="flex justify-between items-center mb-4 gap-3">
        <div className="flex-1 max-w-md relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mist pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, jersey, position…" className="input-base !pl-10" />
        </div>
      </div>

      {tab === 'roster' ? (
        <RosterTab roster={filtered} seasonArchived={seasonArchived} />
      ) : (
        <AllStudentsTab
          roster={filtered.filter((r) => roster.find((x) => x.id === r.id))}
          notEnrolled={filtered.filter((r) => notEnrolled.find((x) => x.id === r.id))}
          inactive={filtered.filter((r) => inactive.find((x) => x.id === r.id))}
          seasonId={seasonId}
          seasonArchived={seasonArchived}
        />
      )}

      <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} seasonId={seasonId} />
    </>
  );
}

function TabPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`px-3 h-8 rounded-full text-xs font-medium transition-colors ${
        active ? 'bg-ink text-paper' : 'text-ink-faint hover:text-ink'
      }`}
    >{label}</button>
  );
}

function RosterTab({ roster, seasonArchived }: { roster: StudentRow[]; seasonArchived: boolean }) {
  if (roster.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No one enrolled in this season yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          Switch to <strong className="text-ink">All Students</strong> to enroll existing academy students, or <strong className="text-ink">Enroll student</strong> to create a new one.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="kicker mb-3">Enrolled this season · {roster.length}</div>
      <div className="card-base overflow-hidden">
        {roster.map((s, idx) => <StudentRowItem key={s.id} student={s} first={idx === 0} seasonArchived={seasonArchived} />)}
      </div>
    </>
  );
}

function AllStudentsTab({
  roster, notEnrolled, inactive, seasonId, seasonArchived,
}: {
  roster: StudentRow[]; notEnrolled: StudentRow[]; inactive: StudentRow[];
  seasonId: string | null; seasonArchived: boolean;
}) {
  return (
    <>
      {roster.length > 0 && (
        <div className="mb-8">
          <div className="kicker mb-3">Enrolled this season · {roster.length}</div>
          <div className="card-base overflow-hidden">
            {roster.map((s, idx) => <StudentRowItem key={s.id} student={s} first={idx === 0} seasonArchived={seasonArchived} />)}
          </div>
        </div>
      )}

      {notEnrolled.length > 0 && (
        <div className="mb-8">
          <div className="kicker mb-3">Not enrolled in this season · {notEnrolled.length}</div>
          <div className="card-base overflow-hidden">
            {notEnrolled.map((s, idx) => (
              <div key={s.id} className={`flex items-center gap-4 px-5 py-3.5 ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
                <Link href={`/dashboard/students/${s.id}`} className="flex items-center gap-4 min-w-0 flex-1 group">
                  {s.jersey_number ? (
                    <div className="font-serif text-xl text-crimson leading-none flex-shrink-0 w-10 text-right">#{s.jersey_number}</div>
                  ) : <div className="w-10 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink truncate group-hover:text-crimson transition-colors">{s.full_name}</div>
                    <div className="text-xs text-ink-faint">
                      {s.enrollment?.departed_on ? `Departed ${s.enrollment.departed_on.slice(0, 10)}` : 'Never enrolled in this season'}
                    </div>
                  </div>
                </Link>
                {seasonId && !seasonArchived && (
                  <form action={toFormAction(enrollStudentInSeason)} className="flex-shrink-0">
                    <input type="hidden" name="season_id" value={seasonId} />
                    <input type="hidden" name="student_id" value={s.id} />
                    <button type="submit" className="text-xs font-mono uppercase tracking-wider text-sage-dark hover:text-sage">
                      Enroll
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <div className="kicker mb-3">Inactive · {inactive.length}</div>
          <div className="card-base overflow-hidden">
            {inactive.map((s, idx) => <StudentRowItem key={s.id} student={s} first={idx === 0} inactive seasonArchived={seasonArchived} />)}
          </div>
        </div>
      )}
    </>
  );
}

function StudentRowItem({ student, first, inactive, seasonArchived }: {
  student: StudentRow; first: boolean; inactive?: boolean; seasonArchived?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${first ? '' : 'border-t border-ink-hair'} ${inactive ? 'opacity-60' : ''}`}>
      <Link href={`/dashboard/students/${student.id}`} className="flex items-center gap-4 min-w-0 flex-1 group">
        {student.jersey_number ? (
          <div className="font-serif text-xl text-crimson leading-none flex-shrink-0 w-10 text-right">#{student.jersey_number}</div>
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
            {student.enrollment?.enrolled_on && !student.enrollment.departed_on && (
              <span>· Enrolled {student.enrollment.enrolled_on.slice(0, 10)}</span>
            )}
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right">
          <div className="font-mono text-sm text-ink">{student.parentCount}</div>
          <div className="kicker text-[9px] mt-0.5">Parent{student.parentCount === 1 ? '' : 's'}</div>
        </div>
        {inactive && !seasonArchived && (
          <form action={toFormAction(reactivateStudent)}>
            <input type="hidden" name="id" value={student.id} />
            <button type="submit" className="text-xs font-mono uppercase tracking-wider text-ink-faint hover:text-sage-dark">
              Reactivate
            </button>
          </form>
        )}
        {!inactive && student.enrollment && !student.enrollment.departed_on && !seasonArchived && (
          <form action={toFormAction(departStudentFromSeason)}
            onSubmit={(e) => { if (!confirm(`Remove ${student.full_name} from this season's roster? Historical data stays intact.`)) e.preventDefault(); }}>
            <input type="hidden" name="id" value={student.enrollment.id} />
            <button type="submit" className="text-xs font-mono uppercase tracking-wider text-ink-faint hover:text-crimson">
              Depart
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function AddStudentModal({ open, onClose, seasonId }: { open: boolean; onClose: () => void; seasonId: string | null }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setError(null);
    const res = await createStudent(formData);
    if (res.ok && res.id && seasonId) {
      // Auto-enroll in current season (Q9 = A)
      const enrollFd = new FormData();
      enrollFd.set('season_id', seasonId);
      enrollFd.set('student_id', res.id);
      await enrollStudentInSeason(enrollFd);
    }
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Something went wrong.');
  };

  return (
    <Modal open={open} onClose={onClose} title="Enroll a new student" description="Creates the student record and auto-enrolls them in the current season.">
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
              <option value="">&mdash;</option>
              <option value="F">Forward</option>
              <option value="D">Defense</option>
              <option value="G">Goalie</option>
            </select>
          </FormField>
          <FormField label="Shoots / Catches">
            <select name="dominant_hand" className="input-base">
              <option value="">&mdash;</option>
              <option value="L">Left</option>
              <option value="R">Right</option>
            </select>
          </FormField>
        </div>

        <FormField label="Team label" help="Optional descriptive tag (e.g., U14 AAA). Not a relationship.">
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
