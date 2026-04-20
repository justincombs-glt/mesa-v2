'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createGame } from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import type { GameRow } from './page';

interface Props {
  games: GameRow[];
  seasonId: string | null;
  seasonArchived: boolean;
  addOnly?: boolean;
}

export function ActivitiesClient({ games, seasonId, seasonArchived, addOnly }: Props) {
  const [open, setOpen] = useState(false);

  if (addOnly) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          disabled={seasonArchived || !seasonId}
          className="btn-primary !h-10 !px-4 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
          title={seasonArchived ? 'This season is archived — read-only' : !seasonId ? 'No active season' : ''}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Log game
        </button>
        <NewGameModal open={open} onClose={() => setOpen(false)} seasonId={seasonId} />
      </>
    );
  }

  if (games.length === 0) {
    return (
      <div className="card-base p-10 text-center">
        <h3 className="font-serif text-xl text-ink mb-2">No games logged yet</h3>
        <p className="text-sm text-ink-dim max-w-md mx-auto">
          Log your first game above. Track opponent, score, and per-player stats including skater metrics and goalie stats separately.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card-base overflow-hidden">
        {games.map((g, idx) => <GameRowItem key={g.id} game={g} first={idx === 0} />)}
      </div>
      <NewGameModal open={open} onClose={() => setOpen(false)} seasonId={seasonId} />
    </>
  );
}

function GameRowItem({ game, first }: { game: GameRow; first: boolean }) {
  const scoreDisplay = game.our_score !== null && game.opp_score !== null
    ? `${game.our_score}–${game.opp_score}`
    : null;
  const won = scoreDisplay && game.our_score !== null && game.opp_score !== null && game.our_score > game.opp_score;
  const tied = scoreDisplay && game.our_score !== null && game.opp_score !== null && game.our_score === game.opp_score;

  return (
    <Link href={`/dashboard/activities/${game.id}`}
      className={`flex items-center gap-4 px-5 py-4 group ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="flex-shrink-0 w-16 text-right">
        <div className="font-serif text-sm text-ink">{formatDate(game.occurred_on)}</div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded bg-crimson text-paper">
            Game
          </span>
          {game.home_away && (
            <span className="text-[9px] font-mono tracking-wider text-ink-faint uppercase">{game.home_away}</span>
          )}
          <span className="font-medium text-ink group-hover:text-crimson transition-colors">
            vs {game.opponent ?? 'TBD'}
          </span>
          {scoreDisplay && (
            <span className={`font-mono text-sm font-medium ${
              won ? 'text-sage-dark' : tied ? 'text-ink-faint' : 'text-crimson'
            }`}>
              {scoreDisplay}
            </span>
          )}
        </div>
        {game.venue && <div className="text-xs text-ink-faint truncate">{game.venue}</div>}
      </div>

      <div className="flex gap-6 flex-shrink-0 text-right text-xs">
        <div>
          <div className="font-mono text-sm text-ink">{game.roster_count}</div>
          <div className="kicker text-[9px] mt-0.5">Roster</div>
        </div>
        <div>
          <div className="font-mono text-sm text-ink">{game.stats_recorded}</div>
          <div className="kicker text-[9px] mt-0.5">Stats</div>
        </div>
      </div>
    </Link>
  );
}

function NewGameModal({ open, onClose, seasonId }: { open: boolean; onClose: () => void; seasonId: string | null }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setError(null);
    if (seasonId) formData.set('season_id', seasonId);
    const res = await createGame(formData);
    setSaving(false);
    if (res.ok && res.id) {
      router.push(`/dashboard/activities/${res.id}`);
    } else {
      setError(res.error ?? 'Failed.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Log a game" description="Basic details first — add roster and stats on the game page.">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Opponent">
          <input type="text" name="opponent" placeholder="Opposing team" className="input-base" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date" required>
            <input type="date" name="occurred_on" required className="input-base" />
          </FormField>
          <FormField label="Start time">
            <input type="time" name="starts_at" className="input-base" />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FormField label="Home / Away">
            <select name="home_away" defaultValue="" className="input-base">
              <option value="">&mdash;</option>
              <option value="home">Home</option>
              <option value="away">Away</option>
            </select>
          </FormField>
          <FormField label="Our score">
            <input type="number" name="our_score" min="0" className="input-base" />
          </FormField>
          <FormField label="Opp. score">
            <input type="number" name="opp_score" min="0" className="input-base" />
          </FormField>
        </div>

        <FormField label="Venue">
          <input type="text" name="venue" placeholder="Arena name or address" className="input-base" />
        </FormField>

        <FormField label="Notes">
          <textarea name="notes" rows={2} className="input-base resize-none" />
        </FormField>

        {error && <div className="text-sm text-crimson">{error}</div>}

        <div className="flex justify-end gap-2 pt-4 border-t border-ink-hair">
          <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !h-10 text-[13px]">
            {saving ? 'Creating\u2026' : 'Log game'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
