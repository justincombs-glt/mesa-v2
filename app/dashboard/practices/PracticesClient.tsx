'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPractice } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Student, PracticePlan } from '@/lib/supabase/types';
import type { PracticeRow } from './page';

type StudentLite = Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position' | 'active'>;
type PlanLite = Pick<PracticePlan, 'id' | 'title' | 'focus' | 'duration_minutes'>;

interface Props {
  practices: PracticeRow[];
  students: StudentLite[];
  templates: PlanLite[];
  seasonId: string | null;
  seasonArchived: boolean;
  addOnly?: boolean;
}

export function PracticesClient({ practices, students, templates, seasonId, seasonArchived, addOnly }: Props) {
  const [addOpen, setAddOpen] = useState(false);

  if (addOnly) {
    return (
      <>
        <button
          onClick={() => setAddOpen(true)}
          disabled={seasonArchived || !seasonId}
          className="btn-primary !h-10 !px-4 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
          title={seasonArchived ? 'Season archived — read-only' : !seasonId ? 'No active season' : ''}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Schedule practice
        </button>
        <NewPracticeModal
          open={addOpen} onClose={() => setAddOpen(false)}
          students={students} templates={templates} seasonId={seasonId}
        />
      </>
    );
  }

  if (practices.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No practices scheduled yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          Schedule your first practice. You can start from a template or build the drill list fresh.
        </p>
      </div>
    );
  }

  return (
    <div className="card-base overflow-hidden">
      {practices.map((p, idx) => (
        <Link key={p.id} href={`/dashboard/practices/${p.id}`}
          className={`flex items-center gap-4 px-5 py-4 group ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
          <div className="flex-shrink-0 w-16 text-center">
            <div className="font-serif text-lg text-ink">{formatDay(p.occurred_on)}</div>
            <div className="kicker text-[9px] mt-0.5">{formatMonth(p.occurred_on)}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="font-medium text-ink group-hover:text-crimson transition-colors">
                {p.title || (p.focus ? p.focus : 'Practice')}
              </span>
              {p.source_plan_title && (
                <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-ink text-paper">
                  Template
                </span>
              )}
            </div>
            <div className="flex gap-3 text-xs text-ink-faint flex-wrap">
              {p.starts_at && <span>{formatTime(p.starts_at)}</span>}
              {p.duration_minutes && <span>· {p.duration_minutes} min</span>}
              {p.source_plan_title && <span>· from {p.source_plan_title}</span>}
            </div>
          </div>
          <div className="flex gap-5 flex-shrink-0 text-right">
            <div>
              <div className="font-mono text-sm text-ink">{p.roster_count}</div>
              <div className="kicker text-[9px] mt-0.5">Roster</div>
            </div>
            <div>
              <div className="font-mono text-sm text-ink">{p.attendance_marked}</div>
              <div className="kicker text-[9px] mt-0.5">Marked</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function NewPracticeModal({ open, onClose, students, templates, seasonId }: {
  open: boolean; onClose: () => void;
  students: StudentLite[]; templates: PlanLite[]; seasonId: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(students.map((s) => s.id)));

  const allChecked = selectedIds.size === students.length;
  const noneChecked = selectedIds.size === 0;

  const toggleAll = () => {
    if (allChecked) setSelectedIds(new Set());
    else setSelectedIds(new Set(students.map((s) => s.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSubmit = async (fd: FormData) => {
    if (!seasonId) { setError('No active season.'); return; }
    setSaving(true);
    setError(null);

    fd.set('season_id', seasonId);
    fd.set('student_ids', JSON.stringify(Array.from(selectedIds)));

    const res = await createPractice(fd);
    setSaving(false);

    if (res.ok && res.id) {
      onClose();
      router.push(`/dashboard/practices/${res.id}`);
    } else {
      setError(res.error ?? 'Failed.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Schedule practice" description="Pick a date and time, optionally start from a plan template. Uncheck any students who won't be there." maxWidth="640px">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Start from template" help="Optional. References the plan; items show up from the template on the practice page.">
          <select name="source_practice_plan_id" defaultValue="" className="input-base">
            <option value="">&mdash; Fresh practice (no template) &mdash;</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}{t.focus ? ` — ${t.focus}` : ''}{t.duration_minutes ? ` (${t.duration_minutes} min)` : ''}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Date" required>
            <input type="date" name="occurred_on" required className="input-base" />
          </FormField>
          <FormField label="Start time">
            <input type="time" name="starts_at" className="input-base" />
          </FormField>
          <FormField label="Duration (min)">
            <input type="number" name="duration_minutes" min="15" max="240" placeholder="60" className="input-base" />
          </FormField>
        </div>

        <FormField label="Title" help="Optional. Shows on the list view.">
          <input type="text" name="title" placeholder="e.g. Monday Morning Skate" className="input-base" />
        </FormField>

        <FormField label="Focus" help="Optional one-liner.">
          <input type="text" name="focus" placeholder="Skating + shooting" className="input-base" />
        </FormField>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-ink">Roster ({selectedIds.size} of {students.length})</label>
            <button type="button" onClick={toggleAll} className="text-xs font-mono uppercase tracking-wider text-ink-faint hover:text-ink">
              {allChecked ? 'Uncheck all' : 'Check all'}
            </button>
          </div>
          <div className="border border-ink-hair rounded-xl max-h-64 overflow-y-auto">
            {students.length === 0 ? (
              <div className="p-4 text-center text-sm text-ink-dim">No active students. Enroll some first.</div>
            ) : (
              students.map((s, idx) => {
                const checked = selectedIds.has(s.id);
                return (
                  <label key={s.id}
                    className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-ivory ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleOne(s.id)} className="w-4 h-4 accent-ink" />
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      {s.jersey_number && <span className="font-mono text-xs text-crimson flex-shrink-0 w-8 text-right">#{s.jersey_number}</span>}
                      <span className="text-sm text-ink truncate">{s.full_name}</span>
                      {s.position && <span className="text-[10px] text-ink-faint uppercase">{s.position}</span>}
                    </div>
                  </label>
                );
              })
            )}
          </div>
          {noneChecked && students.length > 0 && (
            <div className="text-[11px] text-ink-faint italic mt-2">
              Creating with empty roster. You can add students later from the practice page.
            </div>
          )}
        </div>

        <FormField label="Notes" help="Optional.">
          <textarea name="notes" rows={2} className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Creating\u2026' : 'Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.getDate().toString();
}

function formatMonth(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function formatTime(hhmmss: string): string {
  const parts = hhmmss.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}
