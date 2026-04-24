'use client';

import { useState } from 'react';
import {
  updateStudent, deactivateStudent, reactivateStudent,
  linkParent, unlinkParent,
  linkStudentProfile, unlinkStudentProfile,
} from '@/app/actions';
import { toFormAction } from '@/lib/form-helpers';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Student, Profile } from '@/lib/supabase/types';
import type { LinkedParent } from './page';

interface Props {
  student: Student;
  linkedParents: LinkedParent[];
  linkedStudentProfile: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
}

export function StudentAdminClient({ student, linkedParents, linkedStudentProfile }: Props) {
  return (
    <div className="grid md:grid-cols-5 gap-8">
      <div className="md:col-span-3">
        <div className="kicker mb-4">Student details</div>
        <EditForm student={student} />
      </div>
      <div className="md:col-span-2 flex flex-col gap-6">
        <ParentLinksSection student={student} linkedParents={linkedParents} />
        <StudentLoginSection student={student} linkedStudentProfile={linkedStudentProfile} />
      </div>
    </div>
  );
}

function EditForm({ student }: { student: Student }) {
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    formData.set('id', student.id);
    setSaving('saving');
    setError(null);
    const res = await updateStudent(formData);
    if (res.ok) {
      setSaving('saved');
      setTimeout(() => setSaving('idle'), 2000);
    } else {
      setSaving('error');
      setError(res.error ?? 'Something went wrong.');
    }
  };

  const handleToggleActive = async () => {
    if (student.active && !confirm(`Deactivate ${student.full_name}? Their data is preserved.`)) return;
    const fd = new FormData();
    fd.set('id', student.id);
    await (student.active ? deactivateStudent(fd) : reactivateStudent(fd));
  };

  return (
    <form action={handleSubmit} className="card-base p-6 flex flex-col gap-4">
      <FormField label="Full name" required>
        <input type="text" name="full_name" defaultValue={student.full_name} required className="input-base" />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date of birth">
          <input type="date" name="date_of_birth" defaultValue={student.date_of_birth ?? ''} className="input-base" />
        </FormField>
        <FormField label="Jersey #">
          <input type="text" name="jersey_number" defaultValue={student.jersey_number ?? ''} className="input-base" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Position">
          <select name="position" defaultValue={student.position ?? ''} className="input-base">
            <option value="">—</option>
            <option value="F">Forward</option>
            <option value="D">Defense</option>
            <option value="G">Goalie</option>
          </select>
        </FormField>
        <FormField label="Shoots / Catches">
          <select name="dominant_hand" defaultValue={student.dominant_hand ?? ''} className="input-base">
            <option value="">—</option>
            <option value="L">Left</option>
            <option value="R">Right</option>
          </select>
        </FormField>
      </div>

      <FormField label="Team label" help="Optional descriptive tag.">
        <input type="text" name="team_label" defaultValue={student.team_label ?? ''} placeholder="U14 AAA" className="input-base" />
      </FormField>

      <FormField label="Notes" help="Visible to staff only.">
        <textarea name="notes" defaultValue={student.notes ?? ''} rows={3} className="input-base resize-none" />
      </FormField>

      {error && <div className="text-sm text-crimson">{error}</div>}

      <div className="flex items-center justify-between gap-2 mt-2 pt-4 border-t border-ink-hair">
        <button
          type="button"
          onClick={handleToggleActive}
          className={`text-sm font-medium ${student.active ? 'text-crimson hover:text-crimson-dark' : 'text-sage-dark hover:text-sage'}`}
        >
          {student.active ? 'Deactivate' : 'Reactivate'}
        </button>
        <div className="flex items-center gap-3">
          {saving === 'saved' && <span className="text-sm text-sage-dark">✓ Saved</span>}
          <button type="submit" disabled={saving === 'saving'} className="btn-primary !h-10 text-[13px]">
            {saving === 'saving' ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}

function ParentLinksSection({ student, linkedParents }: { student: Student; linkedParents: LinkedParent[] }) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="kicker">Linked parents · {linkedParents.length}</div>
          <button onClick={() => setAddOpen(true)} className="text-xs font-mono uppercase tracking-wider text-ink-faint hover:text-crimson">
            + Link
          </button>
        </div>

        {linkedParents.length === 0 ? (
          <div className="card-base p-5 text-center">
            <p className="text-sm text-ink-dim">
              No parents linked yet. Click <strong className="text-ink">+ Link</strong> to connect a parent by email.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {linkedParents.map((lp) => (
              <div key={lp.link_id} className="card-base p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="font-medium text-ink truncate">
                        {lp.profile.full_name || lp.profile.email.split('@')[0]}
                      </div>
                      {lp.is_primary && (
                        <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded text-crimson bg-crimson/5 border border-crimson/20">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-faint truncate">{lp.profile.email}</div>
                    {lp.profile.phone && <div className="text-xs text-ink-faint">{lp.profile.phone}</div>}
                    {lp.relationship && (
                      <div className="kicker text-[9px] mt-2 capitalize">{lp.relationship}</div>
                    )}
                  </div>
                  <form action={toFormAction(unlinkParent)}>
                    <input type="hidden" name="id" value={lp.link_id} />
                    <input type="hidden" name="student_id" value={student.id} />
                    <button type="submit" className="text-xs text-ink-faint hover:text-crimson font-mono uppercase tracking-wider">
                      Unlink
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddParentLinkModal open={addOpen} onClose={() => setAddOpen(false)} student={student} />
    </>
  );
}

function StudentLoginSection({ student, linkedStudentProfile }: { student: Student; linkedStudentProfile: Pick<Profile, 'id' | 'full_name' | 'email'> | null }) {
  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="kicker">Student login</div>
          {!linkedStudentProfile && (
            <button onClick={() => setLinkOpen(true)} className="text-xs font-mono uppercase tracking-wider text-ink-faint hover:text-crimson">
              + Link account
            </button>
          )}
        </div>

        {linkedStudentProfile ? (
          <div className="card-base p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink truncate">{linkedStudentProfile.full_name || linkedStudentProfile.email.split('@')[0]}</div>
                <div className="text-xs text-ink-faint truncate">{linkedStudentProfile.email}</div>
              </div>
              <form action={toFormAction(unlinkStudentProfile)}>
                <input type="hidden" name="student_id" value={student.id} />
                <button type="submit" className="text-xs text-ink-faint hover:text-crimson font-mono uppercase tracking-wider">
                  Unlink
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="card-base p-5 text-center">
            <p className="text-sm text-ink-dim">
              No student account linked. Players age 13+ can self-register, then you link them here. Players under 13 don&apos;t need an account.
            </p>
          </div>
        )}
      </div>

      <LinkStudentProfileModal open={linkOpen} onClose={() => setLinkOpen(false)} student={student} />
    </>
  );
}

function AddParentLinkModal({ open, onClose, student }: { open: boolean; onClose: () => void; student: Student }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<string>('guardian');

  const handleSubmit = async (formData: FormData) => {
    formData.set('student_id', student.id);
    setSaving(true);
    setError(null);
    const res = await linkParent(formData);
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Something went wrong.');
  };

  return (
    <Modal open={open} onClose={onClose} title="Link a parent" description={`To ${student.full_name}`}>
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Parent email" required help="The parent must have signed up for a MESA account first.">
          <input type="email" name="parent_email" required placeholder="parent@example.com" className="input-base" />
        </FormField>

        <FormField label="Relationship">
          <select name="relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)} className="input-base">
            <option value="mother">Mother</option>
            <option value="father">Father</option>
            <option value="guardian">Guardian</option>
            <option value="grandparent">Grandparent</option>
            <option value="other">Other…</option>
          </select>
        </FormField>

        {relationship === 'other' && (
          <FormField label="Relationship — specify">
            <input type="text" name="relationship_other" placeholder="e.g. Step-parent, Aunt, Uncle" className="input-base" />
          </FormField>
        )}

        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" name="is_primary" className="w-4 h-4 accent-ink" />
          Primary contact
        </label>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Linking…' : 'Link parent'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LinkStudentProfileModal({ open, onClose, student }: { open: boolean; onClose: () => void; student: Student }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    formData.set('student_id', student.id);
    setSaving(true);
    setError(null);
    const res = await linkStudentProfile(formData);
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Something went wrong.');
  };

  return (
    <Modal open={open} onClose={onClose} title="Link student account" description={`To ${student.full_name}`}>
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Student email" required help="They must have signed up at /sign-up first (age 13+ required).">
          <input type="email" name="student_email" required placeholder="student@example.com" className="input-base" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Linking\u2026' : 'Link account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
