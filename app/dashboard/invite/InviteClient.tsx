'use client';

import { useState } from 'react';
import { createInvite, revokeInvite } from '@/app/actions';
import { toFormAction } from '@/lib/form-helpers';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Invite, AppRole } from '@/lib/supabase/types';

const ROLES: AppRole[] = ['admin', 'director', 'coach', 'trainer', 'student', 'parent'];

interface Props {
  pending: Invite[];
  addOnly?: boolean;
}

export function InviteClient({ pending, addOnly }: Props) {
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
        <InviteFormModal open={open} onClose={() => setOpen(false)} />
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

      <InviteFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function InviteFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await createInvite(formData);
    setSaving(false);
    if (res.ok) {
      setSuccess('Invite created. The role will be assigned automatically when they sign up with this email.');
      setTimeout(() => { setSuccess(null); onClose(); }, 3000);
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
          <select name="role" required defaultValue="" className="input-base capitalize">
            <option value="" disabled>Choose a role&hellip;</option>
            {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
          </select>
        </FormField>
        <FormField label="Note" help="Optional. For your reference only.">
          <input type="text" name="note" placeholder="e.g. U14 head coach" className="input-base" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}
        {success && <div className="text-sm text-sage-dark">{success}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Sending\u2026' : 'Send invite'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
