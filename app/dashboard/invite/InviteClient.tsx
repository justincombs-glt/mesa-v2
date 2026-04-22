'use client';

import { useMemo, useState } from 'react';
import { createInvite, revokeInvite } from '@/app/actions';
import { toFormAction } from '@/lib/form-helpers';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Invite, AppRole, Student } from '@/lib/supabase/types';

const ROLES: AppRole[] = ['admin', 'director', 'coach', 'trainer', 'student', 'parent'];

type StudentLite = Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'date_of_birth' | 'profile_id' | 'active'>;

interface Props {
  pending: Invite[];
  students: StudentLite[];
  addOnly?: boolean;
}

export function InviteClient({ pending, students, addOnly }: Props) {
  const [open, setOpen] = useState(false);

  if (addOnly) {
    return (
      <>
        <button onClick={() => setOpen(true)} className="btn-primary !h-10 !px-4 text-[13px]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Send invite
        </button>
        <InviteFormModal open={open} onClose={() => setOpen(false)} students={students} />
      </>
    );
  }

  return (
    <>
      <div className="kicker mb-3">Pending invites · {pending.length}</div>

      {pending.length === 0 ? (
        <div className="card-base p-10 text-center">
          <h3 className="font-serif text-xl text-ink mb-2">No pending invites</h3>
          <p className="text-sm text-ink-dim max-w-md mx-auto mb-6">
            Click <strong className="text-ink">Send invite</strong> above to add a coach, trainer, parent, or student.
          </p>
          <p className="text-xs text-ink-faint italic max-w-md mx-auto">
            Invites are records in the database. Email delivery integration arrives in a later phase. For now: tell the person their email is whitelisted, ask them to sign up at the MESA URL, and the role is auto-assigned at signup.
          </p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {pending.map((inv, idx) => (
            <div key={inv.id} className={`flex items-center justify-between gap-4 px-5 py-4 ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink truncate">{inv.email}</div>
                <div className="flex gap-2 text-xs text-ink-faint mt-0.5 flex-wrap items-center">
                  <span>Invited as <span className="text-ink capitalize font-medium">{inv.role}</span></span>
                  {inv.note && <span>· {inv.note}</span>}
                </div>
              </div>
              <form action={toFormAction(revokeInvite)}>
                <input type="hidden" name="id" value={inv.id} />
                <button type="submit" className="text-xs text-ink-faint hover:text-crimson font-mono uppercase tracking-wider">
                  Revoke
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <InviteFormModal open={open} onClose={() => setOpen(false)} students={students} />
    </>
  );
}

function isUnder13(dob: string | null): boolean {
  if (!dob) return false;
  const d = new Date(dob);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 13);
  return d > cutoff;
}

function InviteFormModal({ open, onClose, students }: {
  open: boolean; onClose: () => void; students: StudentLite[];
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [linkedStudentId, setLinkedStudentId] = useState<string>('');

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === linkedStudentId) ?? null,
    [linkedStudentId, students],
  );
  const selectedIsMinor = selectedStudent ? isUnder13(selectedStudent.date_of_birth) : false;

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await createInvite(formData);
    setSaving(false);
    if (res.ok) {
      setSuccess('Invite created. The role will be assigned automatically when they sign up with this email.');
      setTimeout(() => { setSuccess(null); setRole(''); setLinkedStudentId(''); onClose(); }, 3000);
    } else {
      setError(res.error ?? 'Something went wrong.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Send an invite" description="When they sign up with this email, the chosen role is assigned automatically.">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Email" required>
          <input type="email" name="email" required placeholder="person@example.com" className="input-base" />
        </FormField>
        <FormField label="Role" required>
          <select name="role" required value={role} onChange={(e) => setRole(e.target.value)} className="input-base capitalize">
            <option value="" disabled>Choose a role…</option>
            {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
          </select>
        </FormField>

        {role === 'student' && (
          <FormField
            label="Link to student record"
            help="Optional. Pick which student record this account represents. Required when enforcing the 13+ age rule.">
            <select name="linked_student_id" value={linkedStudentId} onChange={(e) => setLinkedStudentId(e.target.value)} className="input-base">
              <option value="">— Not linked —</option>
              {students.map((s) => {
                const minor = isUnder13(s.date_of_birth);
                return (
                  <option key={s.id} value={s.id} disabled={minor}>
                    {s.full_name}
                    {s.jersey_number ? ` · #${s.jersey_number}` : ''}
                    {minor ? ' (under 13 — not eligible)' : ''}
                  </option>
                );
              })}
            </select>
          </FormField>
        )}

        {role === 'student' && selectedIsMinor && (
          <div className="text-sm text-crimson bg-crimson/10 border border-crimson/30 rounded p-3">
            {selectedStudent?.full_name} is under 13. Minor students can&apos;t have their own login account. Link a parent to the student record instead.
          </div>
        )}

        <FormField label="Note" help="Optional. For your reference only.">
          <input type="text" name="note" placeholder="e.g. U14 head coach" className="input-base" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}
        {success && <div className="text-sm text-sage-dark">{success}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving || (role === 'student' && selectedIsMinor)}
            className="btn-primary !h-10 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
