'use client';

import { useMemo, useState } from 'react';
import { changeUserRole, createInvite, revokeInvite } from '@/app/actions';
import { toFormAction } from '@/lib/form-helpers';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Profile, Invite, AppRole } from '@/lib/supabase/types';

const ROLES: AppRole[] = ['admin', 'director', 'coach', 'trainer', 'student', 'parent'];

interface Props {
  profiles: Profile[];
  pendingInvites: Invite[];
  inviteOnly?: boolean;
}

export function UsersClient({ profiles, pendingInvites, inviteOnly }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (!q) return true;
      const hay = `${p.email} ${p.full_name ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [profiles, query, roleFilter]);

  if (inviteOnly) {
    return (
      <>
        <button onClick={() => setInviteOpen(true)} className="btn-primary !h-10 !px-4 text-[13px]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Invite user
        </button>
        <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      </>
    );
  }

  return (
    <>
      {/* Pending invites section */}
      {pendingInvites.length > 0 && (
        <div className="mb-10">
          <div className="kicker mb-3">Pending invites · {pendingInvites.length}</div>
          <div className="card-base overflow-hidden">
            {pendingInvites.map((inv, idx) => (
              <div key={inv.id} className={`flex items-center justify-between px-5 py-3 ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink truncate">{inv.email}</div>
                  <div className="text-xs text-ink-faint mt-0.5">
                    Invited as <span className="text-ink capitalize">{inv.role}</span>
                    {inv.note && <span className="ml-2">· {inv.note}</span>}
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
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mist pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…" className="input-base !pl-10" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as AppRole | 'all')}
          className="input-base !w-auto">
          <option value="all">All roles</option>
          {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
        </select>
      </div>

      {/* Users list */}
      <div className="kicker mb-3">All users · {filtered.length} of {profiles.length}</div>
      <div className="card-base overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-dim">
            No matches.
          </div>
        ) : (
          filtered.map((p, idx) => <UserRow key={p.id} profile={p} first={idx === 0} />)
        )}
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </>
  );
}

function UserRow({ profile, first }: { profile: Profile; first: boolean }) {
  const [role, setRole] = useState<AppRole>(profile.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (newRole: AppRole) => {
    if (newRole === role) return;
    if (!confirm(`Change ${profile.email} from ${role} to ${newRole}?`)) return;
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set('id', profile.id);
    fd.set('role', newRole);
    const res = await changeUserRole(fd);
    setSaving(false);
    if (res.ok) setRole(newRole);
    else setError(res.error ?? 'Failed');
  };

  return (
    <div className={`flex items-center gap-4 px-5 py-3 ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-ink truncate">
          {profile.full_name || profile.email.split('@')[0]}
        </div>
        <div className="text-xs text-ink-faint truncate">{profile.email}</div>
        {error && <div className="text-xs text-crimson mt-1">{error}</div>}
      </div>
      <select
        value={role}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as AppRole)}
        className="input-base !w-auto !h-9 text-xs capitalize"
      >
        {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
      </select>
    </div>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (fd: FormData) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await createInvite(fd);
    setSaving(false);
    if (res.ok) {
      setSuccess('Invite created. Email sending requires integration — for now, the invite is a DB record that auto-assigns the role when they sign up with the invited email.');
      setTimeout(() => { setSuccess(null); onClose(); }, 3500);
    } else {
      setError(res.error ?? 'Failed');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite user" description="Create a pending invite. When they sign up with this email, the role is assigned automatically.">
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
        <FormField label="Note" help="Optional. For your own reference.">
          <input type="text" name="note" placeholder="e.g. U14 head coach" className="input-base" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}
        {success && <div className="text-sm text-sage-dark">{success}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Saving\u2026' : 'Create invite'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
