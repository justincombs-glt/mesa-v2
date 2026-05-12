'use client';

import { useState } from 'react';

interface Props {
  /** Field name prefix; rendered inputs use `${name}[]` so server-action `getAll` works. */
  name: 'positive_notes' | 'improvement_notes';
  label: string;
  /** Color hint — sage for positive, crimson-tinged for improvement. */
  accent: 'sage' | 'crimson';
  initial: string[] | null | undefined;
  placeholder?: string;
}

/**
 * BulletNotesEditor — controlled list of bullet point text inputs that submit
 * as `${name}[]` form fields. Used in game stat editors for Positive
 * Performance Notes and Opportunities for Improvement.
 *
 * Empty rows are filtered out before submission (the server action also
 * filters, but keeping the form clean avoids storing blanks).
 */
export function BulletNotesEditor({ name, label, accent, initial, placeholder }: Props) {
  const [bullets, setBullets] = useState<string[]>(() => {
    const seed = (initial ?? []).filter((b) => b.trim().length > 0);
    return seed.length > 0 ? seed : [''];
  });

  const updateAt = (idx: number, value: string) => {
    setBullets((prev) => prev.map((b, i) => (i === idx ? value : b)));
  };

  const addBullet = () => setBullets((prev) => [...prev, '']);
  const removeAt = (idx: number) => {
    setBullets((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [''] : next;
    });
  };

  const accentClass =
    accent === 'sage'
      ? 'border-sage/30 bg-sage/5'
      : 'border-crimson/20 bg-crimson/5';

  const dotClass = accent === 'sage' ? 'bg-sage-dark' : 'bg-crimson';

  return (
    <div className={`rounded-lg border ${accentClass} p-3`}>
      <div className="kicker mb-2">{label}</div>
      <div className="flex flex-col gap-1.5">
        {bullets.map((b, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${dotClass}`} aria-hidden />
            <input
              type="text"
              name={`${name}[]`}
              value={b}
              onChange={(e) => updateAt(idx, e.target.value)}
              placeholder={placeholder ?? 'Add a bullet point\u2026'}
              className="input-base !h-9 text-sm flex-1"
            />
            <button
              type="button"
              onClick={() => removeAt(idx)}
              className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson flex-shrink-0 px-1"
              aria-label="Remove bullet"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addBullet}
        className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson mt-2"
      >
        + Add bullet
      </button>
    </div>
  );
}
