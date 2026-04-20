'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateGame, deleteGame,
  addStudentToActivity, removeStudentFromActivity,
  upsertGameStat,
} from '@/app/actions';
import { toFormAction } from '@/lib/form-helpers';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { Activity, Student } from '@/lib/supabase/types';
import type { RosterEntry } from './page';

type StudentLite = Pick<Student, 'id' | 'full_name' | 'jersey_number' | 'position'>;

interface Props {
  game: Activity;
  roster: RosterEntry[];
  availableStudents: StudentLite[];
  readOnly: boolean;
}

export function GameDetailClient({ game, roster, availableStudents, readOnly }: Props) {
  const skaters = roster.filter((r) => r.student.position !== 'G');
  const goalies = roster.filter((r) => r.student.position === 'G');

  return (
    <div className="flex flex-col gap-10">
      <GameMetaSection game={game} readOnly={readOnly} />
      <RosterSection game={game} roster={roster} availableStudents={availableStudents} readOnly={readOnly} />
      {skaters.length > 0 && (
        <StatsSection title="Skater stats" entries={skaters} game={game} type="skater" readOnly={readOnly} />
      )}
      {goalies.length > 0 && (
        <StatsSection title="Goalie stats" entries={goalies} game={game} type="goalie" readOnly={readOnly} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Game metadata
// ----------------------------------------------------------------------------

function GameMetaSection({ game, readOnly }: { game: Activity; readOnly: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (fd: FormData) => {
    fd.set('id', game.id);
    setSaving('saving');
    setError(null);
    const res = await updateGame(fd);
    if (res.ok) {
      setSaving('saved');
      setTimeout(() => { setSaving('idle'); setEditing(false); }, 1200);
    } else {
      setSaving('error');
      setError(res.error ?? 'Failed.');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this game? Roster and all stats will be lost.')) return;
    const fd = new FormData();
    fd.set('id', game.id);
    await deleteGame(fd);
    router.push('/dashboard/activities');
  };

  if (!editing) {
    if (readOnly) return null;
    return (
      <section className="flex items-center justify-end gap-2 pb-2 -mt-4">
        <button onClick={() => setEditing(true)} className="btn-secondary !h-9 text-xs">
          Edit game
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="kicker mb-4">Edit game</div>
      <form action={handleSubmit} className="card-base p-6 flex flex-col gap-4">
        <FormField label="Opponent">
          <input type="text" name="opponent" defaultValue={game.opponent ?? ''} className="input-base" />
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Date" required>
            <input type="date" name="occurred_on" defaultValue={game.occurred_on} required className="input-base" />
          </FormField>
          <FormField label="Home / Away">
            <select name="home_away" defaultValue={game.home_away ?? ''} className="input-base">
              <option value="">&mdash;</option>
              <option value="home">Home</option>
              <option value="away">Away</option>
            </select>
          </FormField>
          <FormField label="Venue">
            <input type="text" name="venue" defaultValue={game.venue ?? ''} className="input-base" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Our score">
            <input type="number" name="our_score" defaultValue={game.our_score ?? ''} min="0" className="input-base" />
          </FormField>
          <FormField label="Opp. score">
            <input type="number" name="opp_score" defaultValue={game.opp_score ?? ''} min="0" className="input-base" />
          </FormField>
        </div>

        <FormField label="Notes">
          <textarea name="notes" defaultValue={game.notes ?? ''} rows={3} className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-between items-center pt-4 border-t border-ink-hair">
          <button type="button" onClick={handleDelete} className="text-xs text-crimson hover:text-crimson-dark font-mono uppercase tracking-wider">
            Delete game
          </button>
          <div className="flex items-center gap-3">
            {saving === 'saved' && <span className="text-sm text-sage-dark">✓ Saved</span>}
            <button type="button" onClick={() => setEditing(false)} disabled={saving === 'saving'} className="btn-secondary !h-10 text-[13px]">
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
// Roster section
// ----------------------------------------------------------------------------

function RosterSection({ game, roster, availableStudents, readOnly }: {
  game: Activity; roster: RosterEntry[]; availableStudents: StudentLite[]; readOnly: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="kicker">Roster &middot; {roster.length} player{roster.length === 1 ? '' : 's'}</div>
        {!readOnly && (
          <button onClick={() => setAddOpen(true)} disabled={availableStudents.length === 0}
            className="btn-secondary !h-9 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            title={availableStudents.length === 0 ? 'All enrolled students already on roster' : ''}>
            + Add player
          </button>
        )}
      </div>

      {roster.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            No players added to this game yet. Click <strong className="text-ink">+ Add player</strong> to build the roster. Only students enrolled in the current season appear in the picker.
          </p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {roster.map((r, idx) => (
            <div key={r.student.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${idx > 0 ? 'border-t border-ink-hair' : ''}`}>
              {r.student.jersey_number ? (
                <div className="font-serif text-lg text-crimson leading-none flex-shrink-0 w-8 text-right">
                  #{r.student.jersey_number}
                </div>
              ) : <div className="w-8 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate">{r.student.full_name}</div>
                {r.student.position && (
                  <div className="text-[10px] text-ink-faint mt-0.5">{positionLabel(r.student.position)}</div>
                )}
              </div>
              {!readOnly && (
                <form action={toFormAction(removeStudentFromActivity)}
                  onSubmit={(e) => { if (!confirm(`Remove ${r.student.full_name} from this game?`)) e.preventDefault(); }}>
                  <input type="hidden" name="activity_id" value={game.id} />
                  <input type="hidden" name="student_id" value={r.student.id} />
                  <button type="submit" className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson">
                    Remove
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <AddPlayerModal open={addOpen} onClose={() => setAddOpen(false)}
        gameId={game.id} available={availableStudents} />
    </section>
  );
}

function AddPlayerModal({ open, onClose, gameId, available }: {
  open: boolean; onClose: () => void; gameId: string; available: StudentLite[];
}) {
  const [saving, setSaving] = useState<string | null>(null);

  const handleAdd = async (studentId: string) => {
    setSaving(studentId);
    const fd = new FormData();
    fd.set('activity_id', gameId);
    fd.set('student_id', studentId);
    await addStudentToActivity(fd);
    setSaving(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="Add player to roster" description="Only current-season enrolled students appear here." maxWidth="500px">
      {available.length === 0 ? (
        <div className="text-sm text-ink-dim p-4 text-center">
          No enrolled students available — either they&apos;re all on the roster, or no one is enrolled in this season.
        </div>
      ) : (
        <div className="card-base overflow-hidden max-h-[50vh] overflow-y-auto">
          {available.map((s, idx) => (
            <button key={s.id} type="button"
              onClick={() => handleAdd(s.id)}
              disabled={saving === s.id}
              className={`w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-ivory ${idx > 0 ? 'border-t border-ink-hair' : ''} disabled:opacity-50`}>
              {s.jersey_number ? (
                <div className="font-serif text-lg text-crimson leading-none flex-shrink-0 w-8 text-right">
                  #{s.jersey_number}
                </div>
              ) : <div className="w-8 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate">{s.full_name}</div>
                {s.position && (
                  <div className="text-[10px] text-ink-faint">{positionLabel(s.position)}</div>
                )}
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
                {saving === s.id ? 'Adding\u2026' : 'Add'}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-4 mt-4 border-t border-ink-hair">
        <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Close</button>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Stats section - one for skaters, one for goalies
// ----------------------------------------------------------------------------

function StatsSection({ title, entries, game, type, readOnly }: {
  title: string; entries: RosterEntry[]; game: Activity;
  type: 'skater' | 'goalie'; readOnly: boolean;
}) {
  return (
    <section>
      <div className="kicker mb-4">{title} &middot; {entries.length}</div>
      <div className="card-base overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-mono tracking-wider uppercase text-ink-faint border-b border-ink-hair">
              <th className="text-left px-4 py-2.5 font-medium">Player</th>
              {type === 'skater' ? (
                <>
                  <th className="text-right px-2 py-2.5 font-medium">G</th>
                  <th className="text-right px-2 py-2.5 font-medium">A</th>
                  <th className="text-right px-2 py-2.5 font-medium">+/&minus;</th>
                  <th className="text-right px-2 py-2.5 font-medium">Shots</th>
                  <th className="text-right px-2 py-2.5 font-medium">PIM</th>
                  <th className="text-right px-2 py-2.5 font-medium">TOI</th>
                </>
              ) : (
                <>
                  <th className="text-right px-2 py-2.5 font-medium">Saves</th>
                  <th className="text-right px-2 py-2.5 font-medium">SA</th>
                  <th className="text-right px-2 py-2.5 font-medium">GA</th>
                  <th className="text-right px-2 py-2.5 font-medium">SV%</th>
                </>
              )}
              {!readOnly && <th className="px-2 py-2.5"></th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((r, idx) => (
              <StatRow key={r.student.id} entry={r} gameId={game.id}
                type={type} readOnly={readOnly}
                first={idx === 0} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatRow({ entry, gameId, type, readOnly, first }: {
  entry: RosterEntry; gameId: string; type: 'skater' | 'goalie';
  readOnly: boolean; first: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && !readOnly) {
    return (
      <StatEditRow entry={entry} gameId={gameId} type={type}
        onDone={() => setEditing(false)}
        rowBorder={!first} />
    );
  }

  const stats = entry.stats;
  const rowClasses = `${first ? '' : 'border-t border-ink-hair'} ${readOnly ? '' : 'cursor-pointer hover:bg-ivory'} group`;
  const handleClick = readOnly ? undefined : () => setEditing(true);

  return (
    <tr className={rowClasses} onClick={handleClick}>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          {entry.student.jersey_number && (
            <span className="text-crimson font-serif text-sm">#{entry.student.jersey_number}</span>
          )}
          <span className="text-ink">{entry.student.full_name}</span>
        </div>
      </td>
      {type === 'skater' ? (
        <>
          <StatCell value={stats?.goals ?? 0} />
          <StatCell value={stats?.assists ?? 0} />
          <StatCell value={stats?.plus_minus ?? 0} signed />
          <StatCell value={stats?.shots ?? 0} />
          <StatCell value={stats?.penalty_mins ?? 0} />
          <td className="px-2 py-2 text-right font-mono text-ink">{stats?.time_on_ice ?? <span className="text-ink-faint">&mdash;</span>}</td>
        </>
      ) : (
        <>
          <StatCell value={stats?.saves} />
          <StatCell value={stats?.shots_against} />
          <StatCell value={stats?.goals_against} />
          <td className="px-2 py-2 text-right font-mono text-ink">
            {stats?.saves !== null && stats?.saves !== undefined && stats?.shots_against && stats.shots_against > 0
              ? ((stats.saves / stats.shots_against) * 100).toFixed(1)
              : <span className="text-ink-faint">&mdash;</span>
            }
          </td>
        </>
      )}
      {!readOnly && (
        <td className="px-2 py-2 text-right">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint group-hover:text-crimson">Edit</span>
        </td>
      )}
    </tr>
  );
}

function StatCell({ value, signed }: { value: number | null | undefined; signed?: boolean }) {
  if (value === null || value === undefined) {
    return <td className="px-2 py-2 text-right font-mono text-ink-faint">&mdash;</td>;
  }
  const display = signed && value > 0 ? `+${value}` : String(value);
  return <td className="px-2 py-2 text-right font-mono text-ink">{display}</td>;
}

function StatEditRow({ entry, gameId, type, onDone, rowBorder }: {
  entry: RosterEntry; gameId: string; type: 'skater' | 'goalie';
  onDone: () => void; rowBorder: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (fd: FormData) => {
    fd.set('activity_id', gameId);
    fd.set('student_id', entry.student.id);
    // Keep existing values for fields not in this grid type
    if (type === 'skater') {
      if (entry.stats) {
        fd.set('saves', entry.stats.saves?.toString() ?? '');
        fd.set('shots_against', entry.stats.shots_against?.toString() ?? '');
        fd.set('goals_against', entry.stats.goals_against?.toString() ?? '');
      }
    } else {
      if (entry.stats) {
        fd.set('goals', String(entry.stats.goals));
        fd.set('assists', String(entry.stats.assists));
        fd.set('plus_minus', String(entry.stats.plus_minus));
        fd.set('shots', String(entry.stats.shots));
        fd.set('penalty_mins', String(entry.stats.penalty_mins));
        fd.set('time_on_ice', entry.stats.time_on_ice ?? '');
      }
    }
    setSaving(true);
    setError(null);
    const res = await upsertGameStat(fd);
    setSaving(false);
    if (res.ok) onDone();
    else setError(res.error ?? 'Failed.');
  };

  return (
    <tr className={`${rowBorder ? 'border-t border-ink-hair' : ''} bg-sand-50`}>
      <td colSpan={type === 'skater' ? 8 : 6} className="px-4 py-4">
        <form action={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-ink mb-1">
            {entry.student.jersey_number && (
              <span className="text-crimson font-serif">#{entry.student.jersey_number}</span>
            )}
            <span>{entry.student.full_name}</span>
          </div>

          {type === 'skater' ? (
            <div className="grid grid-cols-6 gap-2">
              <StatInput label="Goals" name="goals" defaultValue={entry.stats?.goals ?? 0} />
              <StatInput label="Assists" name="assists" defaultValue={entry.stats?.assists ?? 0} />
              <StatInput label="+/&minus;" name="plus_minus" defaultValue={entry.stats?.plus_minus ?? 0} />
              <StatInput label="Shots" name="shots" defaultValue={entry.stats?.shots ?? 0} />
              <StatInput label="PIM" name="penalty_mins" defaultValue={entry.stats?.penalty_mins ?? 0} />
              <div>
                <label className="kicker block mb-1">TOI</label>
                <input type="text" name="time_on_ice" defaultValue={entry.stats?.time_on_ice ?? ''}
                  placeholder="MM:SS" className="input-base !h-8 text-xs" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <StatInput label="Saves" name="saves" defaultValue={entry.stats?.saves ?? ''} />
              <StatInput label="Shots against" name="shots_against" defaultValue={entry.stats?.shots_against ?? ''} />
              <StatInput label="Goals against" name="goals_against" defaultValue={entry.stats?.goals_against ?? ''} />
            </div>
          )}

          <div>
            <label className="kicker block mb-1">Notes</label>
            <textarea name="notes" defaultValue={entry.stats?.notes ?? ''} rows={1}
              className="input-base !h-8 resize-none text-xs" />
          </div>

          {error && <div className="text-xs text-crimson">{error}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onDone} disabled={saving}
              className="btn-secondary !h-8 text-xs">Cancel</button>
            <button type="submit" disabled={saving}
              className="btn-primary !h-8 text-xs">
              {saving ? 'Saving\u2026' : 'Save stats'}
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function StatInput({ label, name, defaultValue }: {
  label: string; name: string; defaultValue: number | string;
}) {
  return (
    <div>
      <label className="kicker block mb-1" dangerouslySetInnerHTML={{ __html: label }} />
      <input type="number" name={name} defaultValue={defaultValue}
        className="input-base !h-8 text-xs font-mono" />
    </div>
  );
}

function positionLabel(p: string): string {
  return p === 'F' ? 'Forward' : p === 'D' ? 'Defense' : 'Goalie';
}
