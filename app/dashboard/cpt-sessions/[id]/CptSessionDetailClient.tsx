'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateCptSession, deleteCptSession, toggleCptBaseline, upsertCptResult,
} from '@/app/actions';
import { FormField } from '@/components/ui/FormField';
import type { SessionData } from './page';

interface Props {
  data: SessionData;
  readOnly: boolean;
}

export function CptSessionDetailClient({ data, readOnly }: Props) {
  return (
    <div className="flex flex-col gap-10">
      <MetaSection session={data.session} readOnly={readOnly} />
      <ResultsGrid data={data} readOnly={readOnly} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Session metadata (edit date, notes, baseline toggle, delete)
// ----------------------------------------------------------------------------

function MetaSection({ session, readOnly }: { session: SessionData['session']; readOnly: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const [baselineBusy, setBaselineBusy] = useState(false);

  const handleSave = async (fd: FormData) => {
    fd.set('id', session.id);
    setSaving('saving');
    setError(null);
    const res = await updateCptSession(fd);
    if (res.ok) {
      setSaving('saved');
      setTimeout(() => { setSaving('idle'); setEditing(false); }, 1200);
    } else {
      setSaving('error');
      setError(res.error ?? 'Failed.');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this session? All recorded results for this session will be lost.')) return;
    const fd = new FormData();
    fd.set('id', session.id);
    await deleteCptSession(fd);
    router.push('/dashboard/cpt-sessions');
  };

  const handleBaselineToggle = async () => {
    setBaselineBusy(true);
    const fd = new FormData();
    fd.set('id', session.id);
    fd.set('next', session.is_baseline ? 'false' : 'true');
    await toggleCptBaseline(fd);
    setBaselineBusy(false);
    router.refresh();
  };

  if (!editing) {
    if (readOnly) return null;
    return (
      <section className="flex items-center justify-end gap-2 pb-2 -mt-4">
        <button onClick={handleBaselineToggle} disabled={baselineBusy}
          className="btn-secondary !h-9 text-xs">
          {baselineBusy ? 'Updating\u2026' : session.is_baseline ? 'Unset baseline' : 'Set as baseline'}
        </button>
        <button onClick={() => setEditing(true)} className="btn-secondary !h-9 text-xs">
          Edit session
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="kicker mb-4">Edit session</div>
      <form action={handleSave} className="card-base p-6 flex flex-col gap-4">
        <FormField label="Session date" required>
          <input type="date" name="session_date" defaultValue={session.session_date} required className="input-base" />
        </FormField>

        <FormField label="Conditions / notes">
          <textarea name="conditions_notes" defaultValue={session.conditions_notes ?? ''} rows={3}
            className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-between items-center pt-4 border-t border-ink-hair">
          <button type="button" onClick={handleDelete}
            className="text-xs text-crimson hover:text-crimson-dark font-mono uppercase tracking-wider">
            Delete session
          </button>
          <div className="flex items-center gap-3">
            {saving === 'saved' && <span className="text-sm text-sage-dark">✓ Saved</span>}
            <button type="button" onClick={() => setEditing(false)} disabled={saving === 'saving'}
              className="btn-secondary !h-10 text-[13px]">
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
// Bulk-entry grid (the hero of Phase 5a)
// ----------------------------------------------------------------------------

function ResultsGrid({ data, readOnly }: { data: SessionData; readOnly: boolean }) {
  if (data.tests.length === 0) {
    return (
      <section>
        <div className="kicker mb-4">Results grid</div>
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            This composite test has no individual tests attached. Go back to <strong className="text-ink">Composite Performance Tests</strong> and edit the composite to add tests before recording results.
          </p>
        </div>
      </section>
    );
  }

  if (data.students.length === 0) {
    return (
      <section>
        <div className="kicker mb-4">Results grid</div>
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            No students enrolled in this season. Enroll students in <strong className="text-ink">Students</strong> first — then their rows will appear here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-1">
        <div className="kicker">Results &middot; {data.students.length} student{data.students.length === 1 ? '' : 's'} &middot; {data.tests.length} test{data.tests.length === 1 ? '' : 's'}</div>
        <div className="text-[10px] font-mono tracking-wider uppercase text-ink-faint">
          Tap a value to edit &middot; Changes save automatically
        </div>
      </div>

      {/* Mobile: card per student */}
      <div className="md:hidden flex flex-col gap-3">
        {data.students.map((student) => (
          <div key={student.id} className="card-base p-4">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-ink-hair">
              {student.jersey_number && (
                <span className="text-crimson font-serif">#{student.jersey_number}</span>
              )}
              <span className="text-ink font-medium">{student.full_name}</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {data.tests.map((test) => (
                <div key={test.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink truncate">{test.title}</div>
                    {test.unit && <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-0.5">{test.unit}</div>}
                  </div>
                  <div className="flex-shrink-0 w-32">
                    <ResultCellInput
                      sessionId={data.session.id}
                      seasonId={data.session.season_id}
                      isBaseline={data.session.is_baseline}
                      sessionDate={data.session.session_date}
                      studentId={student.id}
                      testId={test.id}
                      unit={test.unit}
                      initialValue={data.resultMap[`${student.id}:${test.id}`]?.value ?? null}
                      readOnly={readOnly}
                      mobile
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: grid table */}
      <div className="hidden md:block card-base overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-mono tracking-wider uppercase text-ink-faint border-b border-ink-hair">
              <th className="text-left px-4 py-2.5 font-medium sticky left-0 bg-paper z-10 min-w-[200px]">
                Student
              </th>
              {data.tests.map((t) => (
                <th key={t.id} className="px-2 py-2.5 font-medium text-right min-w-[110px]">
                  <div className="text-ink">{t.title}</div>
                  {t.unit && <div className="text-[9px] text-ink-faint mt-0.5 normal-case tracking-normal">{t.unit}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.students.map((student, idx) => (
              <tr key={student.id} className={idx > 0 ? 'border-t border-ink-hair' : ''}>
                <td className="px-4 py-2 sticky left-0 bg-paper z-10">
                  <div className="flex items-center gap-2">
                    {student.jersey_number && (
                      <span className="text-crimson font-serif text-sm">#{student.jersey_number}</span>
                    )}
                    <span className="text-ink">{student.full_name}</span>
                  </div>
                </td>
                {data.tests.map((test) => (
                  <ResultCellInput
                    key={test.id}
                    sessionId={data.session.id}
                    seasonId={data.session.season_id}
                    isBaseline={data.session.is_baseline}
                    sessionDate={data.session.session_date}
                    studentId={student.id}
                    testId={test.id}
                    unit={test.unit}
                    initialValue={data.resultMap[`${student.id}:${test.id}`]?.value ?? null}
                    readOnly={readOnly}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-faint mt-3">
        Leave a cell blank (or delete the value) to remove that specific result.
      </p>
    </section>
  );
}

// Per-cell input with onBlur save
function ResultCellInput({
  sessionId, seasonId, isBaseline, sessionDate,
  studentId, testId, unit, initialValue, readOnly, mobile,
}: {
  sessionId: string; seasonId: string | null; isBaseline: boolean; sessionDate: string;
  studentId: string; testId: string; unit: string | null;
  initialValue: number | null; readOnly: boolean;
  mobile?: boolean;
}) {
  const [value, setValue] = useState<string>(initialValue !== null ? String(initialValue) : '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string>(initialValue !== null ? String(initialValue) : '');

  const doSave = async () => {
    if (value === lastSaved) return; // no change
    setStatus('saving');
    setErrMsg(null);
    const fd = new FormData();
    fd.set('cpt_session_id', sessionId);
    fd.set('student_id', studentId);
    fd.set('test_id', testId);
    fd.set('value', value.trim());
    if (seasonId) fd.set('season_id', seasonId);
    fd.set('is_baseline', isBaseline ? 'true' : 'false');
    fd.set('session_date', sessionDate);

    const res = await upsertCptResult(fd);
    if (res.ok) {
      setStatus('saved');
      setLastSaved(value.trim());
      setTimeout(() => setStatus('idle'), 1400);
    } else {
      setStatus('error');
      setErrMsg(res.error ?? 'Failed.');
    }
  };

  const borderClass =
    status === 'error' ? 'border-crimson' :
    status === 'saved' ? 'border-sage' :
    status === 'saving' ? 'border-sand-200' :
    'border-transparent';

  const inputElement = (
    <div className="relative">
      <input
        type="number" inputMode="decimal"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={doSave}
        disabled={readOnly}
        placeholder={unit ?? ''}
        title={errMsg ?? undefined}
        className={`w-full text-right font-mono text-sm px-2 py-1.5 rounded border-2 ${borderClass} bg-paper hover:bg-ivory focus:bg-paper focus:border-crimson focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
      />
      {status === 'saving' && (
        <span className="absolute -right-0.5 -top-0.5 text-[8px] text-ink-faint">…</span>
      )}
      </div>
  );

  return mobile
    ? inputElement
    : <td className="px-1 py-1 text-right">{inputElement}</td>;
}
