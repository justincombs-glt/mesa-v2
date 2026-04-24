'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStudentAsParent } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddChildModal({ open, onClose }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [relationship, setRelationship] = useState<string>('mother');

  const handleSubmit = async (fd: FormData) => {
    setSaving(true);
    setError(null);
    const res = await createStudentAsParent(fd);
    setSaving(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      setError(res.error ?? 'Could not add child.');
    }
  };

  return (
    <Modal open={open} onClose={onClose}
      title="Add your child"
      description="Tell us about your child. The academy will see this record and can add things like jersey number or position later if you don't have them."
      maxWidth="560px">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Child's full name" required>
          <input type="text" name="full_name" required placeholder="e.g. Alex Johnson" className="input-base" />
        </FormField>

        <FormField label="Date of birth" required>
          <input type="date" name="date_of_birth" required className="input-base"
            max={new Date().toISOString().slice(0, 10)} />
        </FormField>

        <FormField label="Your relationship to this child" required>
          <select name="relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)}
            required className="input-base">
            <option value="mother">Mother</option>
            <option value="father">Father</option>
            <option value="guardian">Guardian</option>
            <option value="grandparent">Grandparent</option>
            <option value="other">Other…</option>
          </select>
        </FormField>

        {relationship === 'other' && (
          <FormField label="Relationship — please specify" required>
            <input type="text" name="relationship_other" required placeholder="e.g. Step-parent, Aunt, Uncle" className="input-base" />
          </FormField>
        )}

        <button type="button" onClick={() => setShowMore((v) => !v)}
          className="text-left text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-ink py-1">
          {showMore ? '− Hide optional details' : '+ More details (optional)'}
        </button>

        {showMore && (
          <div className="flex flex-col gap-4 pl-3 border-l-2 border-ink-hair">
            <div className="grid grid-cols-3 gap-2">
              <FormField label="Jersey #">
                <input type="text" name="jersey_number" maxLength={3} className="input-base" />
              </FormField>
              <FormField label="Position">
                <select name="position" defaultValue="" className="input-base">
                  <option value="">—</option>
                  <option value="F">Forward</option>
                  <option value="D">Defense</option>
                  <option value="G">Goalie</option>
                </select>
              </FormField>
              <FormField label="Hand">
                <select name="dominant_hand" defaultValue="" className="input-base">
                  <option value="">—</option>
                  <option value="L">Left</option>
                  <option value="R">Right</option>
                </select>
              </FormField>
            </div>
            <FormField label="Notes for the academy">
              <textarea name="notes" rows={2} className="input-base resize-none"
                placeholder="Anything helpful the academy should know (allergies, equipment, etc.)" />
            </FormField>
          </div>
        )}

        <div className="text-xs text-ink-faint bg-sand-50 p-3 rounded border border-ink-hair">
          <strong className="text-ink">Heads up:</strong> once you submit, the academy sees this record in their student list. If you need to make corrections later, contact the academy — you can&apos;t edit the record yourself after it&apos;s created.
        </div>

        {error && <div className="text-sm text-crimson bg-crimson/5 p-3 rounded border border-crimson/30">{error}</div>}

        <div className="flex justify-end gap-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} disabled={saving}
            className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving}
            className="btn-primary !h-10 text-[13px]">
            {saving ? 'Adding…' : 'Add child'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
