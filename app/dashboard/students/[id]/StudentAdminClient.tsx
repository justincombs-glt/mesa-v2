'use client';

import { useState, useEffect, useRef } from 'react';
import {
  updateStudent, deactivateStudent, reactivateStudent,
  linkParent, unlinkParent,
  linkStudentProfile, unlinkStudentProfile,
  searchProfilesByEmail,
} from '@/app/actions';
import type { ProfileSearchResult } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Student, Profile, AppRole } from '@/lib/supabase/types';
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

  const handleUnlink = async (lp: LinkedParent) => {
    const name = lp.profile.full_name || lp.profile.email;
    if (!confirm(`Unlink ${name} from ${student.full_name}? They will lose access to this student's data.`)) return;
    const fd = new FormData();
    fd.set('id', lp.link_id);
    fd.set('student_id', student.id);
    const res = await unlinkParent(fd);
    if (!res.ok) alert(res.error ?? 'Could not unlink.');
  };

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
                  <button
                    type="button"
                    onClick={() => handleUnlink(lp)}
                    className="text-xs text-ink-faint hover:text-crimson font-mono uppercase tracking-wider"
                  >
                    Unlink
                  </button>
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

  const handleUnlink = async () => {
    if (!linkedStudentProfile) return;
    const name = linkedStudentProfile.full_name || linkedStudentProfile.email;
    if (!confirm(`Unlink ${name} from ${student.full_name}? They will lose access to this student's data.`)) return;
    const fd = new FormData();
    fd.set('student_id', student.id);
    const res = await unlinkStudentProfile(fd);
    if (!res.ok) alert(res.error ?? 'Could not unlink.');
  };

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
              <button
                type="button"
                onClick={handleUnlink}
                className="text-xs text-ink-faint hover:text-crimson font-mono uppercase tracking-wider"
              >
                Unlink
              </button>
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
  const [picked, setPicked] = useState<ProfileSearchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<string>('guardian');

  // Reset state on open
  useEffect(() => {
    if (open) {
      setPicked(null);
      setError(null);
      setRelationship('guardian');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) {
      setError('Pick a parent to link.');
      return;
    }

    const name = picked.full_name || picked.email;
    if (!confirm(`Link ${name} (${picked.email}) as a parent of ${student.full_name}? They will gain access to this student's data.`)) return;

    const formData = new FormData(e.target as HTMLFormElement);
    formData.set('student_id', student.id);
    formData.set('profile_id', picked.id);
    setSaving(true);
    setError(null);
    const res = await linkParent(formData);
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Something went wrong.');
  };

  return (
    <Modal open={open} onClose={onClose} title="Link a parent" description={`To ${student.full_name}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Find a parent" required help="Search by email or name. They must already have a parent-role MESA account.">
          <UserPicker selected={picked} onSelect={setPicked} role="parent" />
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
          <button type="submit" disabled={saving || !picked} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Linking…' : 'Link parent'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LinkStudentProfileModal({ open, onClose, student }: { open: boolean; onClose: () => void; student: Student }) {
  const [picked, setPicked] = useState<ProfileSearchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPicked(null);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) {
      setError('Pick a student account to link.');
      return;
    }

    const name = picked.full_name || picked.email;
    if (!confirm(`Link ${name} (${picked.email}) as the login account for ${student.full_name}? They will gain access to this student's own data.`)) return;

    const formData = new FormData();
    formData.set('student_id', student.id);
    formData.set('profile_id', picked.id);
    setSaving(true);
    setError(null);
    const res = await linkStudentProfile(formData);
    setSaving(false);
    if (res.ok) onClose();
    else setError(res.error ?? 'Something went wrong.');
  };

  return (
    <Modal open={open} onClose={onClose} title="Link student account" description={`To ${student.full_name}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Find a student account" required help="Search by email or name. They must already have a student-role MESA account (signed up themselves at /sign-up).">
          <UserPicker selected={picked} onSelect={setPicked} role="student" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving || !picked} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Linking…' : 'Link account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// UserPicker — searchable autocomplete dropdown for picking a profile
// ----------------------------------------------------------------------------

function UserPicker({
  selected, onSelect, role,
}: {
  selected: ProfileSearchResult | null;
  onSelect: (p: ProfileSearchResult | null) => void;
  role: AppRole;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Debounced search whenever query changes (only when nothing selected)
  useEffect(() => {
    if (selected) return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      const fd = new FormData();
      fd.set('q', query.trim());
      fd.set('role', role);
      const res = await searchProfilesByEmail(fd);
      setSearching(false);
      if (res.ok) {
        setResults(res.results ?? []);
        setOpen(true);
      } else {
        setSearchError(res.error ?? 'Search failed.');
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, role, selected]);

  // Close dropdown on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (selected) {
    return (
      <div className="card-base p-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-ink truncate">{selected.full_name || selected.email.split('@')[0]}</div>
          <div className="text-xs text-ink-faint truncate">{selected.email}</div>
          <div className="kicker text-[9px] mt-1">{selected.role}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery('');
            setResults([]);
          }}
          className="text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson flex-shrink-0"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={`Search by email or name (${role}s only)`}
        className="input-base"
        autoComplete="off"
      />
      {open && (results.length > 0 || searching || searchError || query.trim().length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-paper border border-ink-hair rounded-lg shadow-card-hover max-h-64 overflow-y-auto">
          {searching && <div className="px-4 py-3 text-xs text-ink-faint">Searching…</div>}
          {!searching && searchError && (
            <div className="px-4 py-3 text-xs text-crimson">{searchError}</div>
          )}
          {!searching && !searchError && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-xs text-ink-dim">
              No {role}s found for &ldquo;{query}&rdquo;.
              {' '}
              <a href="/dashboard/invite" className="text-crimson hover:underline">Send an invite instead?</a>
            </div>
          )}
          {!searching && !searchError && results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onSelect(r);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-ivory transition-colors border-b border-ink-hair last:border-b-0"
            >
              <div className="font-medium text-ink truncate text-sm">{r.full_name || r.email.split('@')[0]}</div>
              <div className="text-xs text-ink-faint truncate">{r.email}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
