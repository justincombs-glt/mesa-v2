'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createPlayer, updateStudent, deactivateStudent, reactivateStudent,
} from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { PlayerRow } from './page';

type TabKey = 'active' | 'inactive';

interface Props {
  players: PlayerRow[];
}

export function PlayersClient({ players }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerRow | null>(null);
  const [tab, setTab] = useState<TabKey>('active');
  const [query, setQuery] = useState('');

  const active = useMemo(() => players.filter((p) => p.active), [players]);
  const inactive = useMemo(() => players.filter((p) => !p.active), [players]);

  const filtered = useMemo(() => {
    const source = tab === 'active' ? active : inactive;
    if (!query.trim()) return source;
    const q = query.trim().toLowerCase();
    return source.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [active, inactive, tab, query]);

  return (
    <div className="flex flex-col gap-6">
      {/* Controls bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex border border-ink-hair rounded overflow-hidden">
            <TabButton active={tab === 'active'} onClick={() => setTab('active')}>
              Active <span className="text-ink-faint ml-1.5">({active.length})</span>
            </TabButton>
            <TabButton active={tab === 'inactive'} onClick={() => setTab('inactive')}>
              Inactive <span className="text-ink-faint ml-1.5">({inactive.length})</span>
            </TabButton>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name\u2026"
            className="input-base !h-9 text-[13px] w-48"
          />
        </div>

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="btn-primary !h-9 text-[13px] !px-4"
        >
          + Add player
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <h3 className="font-serif text-xl text-ink mb-2">No players</h3>
          <p className="text-sm text-ink-dim max-w-md mx-auto">
            {query
              ? 'No matches for that search.'
              : tab === 'active'
                ? 'Add your first external player using the button above.'
                : 'No deactivated players.'}
          </p>
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          {filtered.map((p, idx) => (
            <PlayerRowItem
              key={p.id}
              player={p}
              first={idx === 0}
              onEdit={() => setEditing(p)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <PlayerFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        mode="create"
      />

      {/* Edit modal */}
      {editing && (
        <PlayerFormModal
          open={true}
          onClose={() => setEditing(null)}
          mode="edit"
          existing={editing}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-[12px] font-mono uppercase tracking-wider transition-colors ${
        active ? 'bg-ink text-paper' : 'text-ink-dim hover:bg-ivory'
      }`}
    >
      {children}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Single player row
// ----------------------------------------------------------------------------

function PlayerRowItem({
  player, first, onEdit,
}: {
  player: PlayerRow;
  first: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleToggleActive = async () => {
    setBusy(true);
    const fd = new FormData();
    fd.set('id', player.id);
    if (player.active) {
      if (!confirm(`Deactivate ${player.full_name}? They won't be able to sign in.`)) {
        setBusy(false);
        return;
      }
      await deactivateStudent(fd);
    } else {
      await reactivateStudent(fd);
    }
    router.refresh();
  };

  return (
    <div className={`flex items-stretch ${first ? '' : 'border-t border-ink-hair'}`}>
      <Link
        href={`/dashboard/students/${player.id}`}
        className="flex items-center gap-4 px-5 py-3.5 group flex-1 min-w-0 hover:bg-ivory"
      >
        <div className="flex-shrink-0 w-12 text-center">
          <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-ink text-paper">
            Player
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-medium text-ink group-hover:text-crimson transition-colors truncate">
              {player.full_name}
            </span>
            {player.hasLogin ? (
              <span className="text-[9px] font-mono tracking-wider uppercase text-sage-dark inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sage-dark inline-block" aria-hidden />
                Login
              </span>
            ) : (
              <span className="text-[9px] font-mono tracking-wider uppercase text-ink-faint">
                No login
              </span>
            )}
            {!player.active && (
              <span className="text-[9px] font-mono tracking-wider uppercase text-crimson">
                Inactive
              </span>
            )}
          </div>
          <div className="text-xs text-ink-faint truncate">
            {[
              player.team_label,
              player.position,
              player.jersey_number && `#${player.jersey_number}`,
            ].filter(Boolean).join(' \u00b7 ') || 'No details'}
          </div>
        </div>
        <div className="flex-shrink-0 text-[10px] font-mono uppercase tracking-wider text-ink-faint group-hover:text-crimson">
          Open &rarr;
        </div>
      </Link>

      <div className="flex items-center gap-1 pr-3 flex-shrink-0">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson disabled:opacity-50 px-2"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleToggleActive}
          disabled={busy}
          className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson disabled:opacity-50 px-2"
        >
          {player.active ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Create / edit modal
// ----------------------------------------------------------------------------

function PlayerFormModal({
  open, onClose, mode, existing,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  existing?: PlayerRow;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    let res: { ok: boolean; error?: string };
    if (mode === 'edit' && existing) {
      fd.set('id', existing.id);
      res = await updateStudent(fd);
    } else {
      res = await createPlayer(fd);
    }
    setSaving(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      setError(res.error ?? 'Could not save.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit player' : 'Add player'}
      description={mode === 'edit'
        ? 'Update this player\u2019s details.'
        : 'External athlete who pays the academy for individual services.'}
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Full name" required>
          <input
            type="text"
            name="full_name"
            defaultValue={existing?.full_name ?? ''}
            required
            maxLength={200}
            className="input-base"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date of birth">
            <input
              type="date"
              name="date_of_birth"
              defaultValue={existing?.date_of_birth ?? ''}
              className="input-base"
            />
          </FormField>
          <FormField label="Jersey #">
            <input
              type="text"
              name="jersey_number"
              defaultValue={existing?.jersey_number ?? ''}
              maxLength={5}
              className="input-base"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Position">
            <select
              name="position"
              defaultValue={existing?.position ?? ''}
              className="input-base"
            >
              <option value="">{"\u2014"}</option>
              <option value="F">Forward</option>
              <option value="D">Defense</option>
              <option value="G">Goalie</option>
            </select>
          </FormField>
          <FormField label="Hand">
            <select
              name="dominant_hand"
              defaultValue={existing?.dominant_hand ?? ''}
              className="input-base"
            >
              <option value="">{"\u2014"}</option>
              <option value="L">Left</option>
              <option value="R">Right</option>
            </select>
          </FormField>
        </div>

        <FormField label="Team / context" help="Optional. e.g. their home team, league name, age group.">
          <input
            type="text"
            name="team_label"
            defaultValue={existing?.team_label ?? ''}
            maxLength={100}
            className="input-base"
          />
        </FormField>

        <FormField label="Notes" help="Optional internal notes.">
          <textarea
            name="notes"
            defaultValue={existing?.notes ?? ''}
            rows={3}
            maxLength={2000}
            className="input-base resize-y min-h-[72px]"
          />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Saving\u2026' : (mode === 'edit' ? 'Save changes' : 'Add player')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
