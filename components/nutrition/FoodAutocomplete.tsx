'use client';

import { useEffect, useRef, useState } from 'react';
import { searchByText } from '@/lib/openfoodfacts';
import type { OffSearchResult } from '@/lib/openfoodfacts';

export interface HistoryItem {
  name: string;
  calories: number;
  last_logged: string;
}

interface Props {
  name: string;
  calories: string;
  onChange: (next: { name: string; calories: string }) => void;
  history: HistoryItem[];
  /** Required HTML attribute (Q5a: same form as before, just controlled). */
  required?: boolean;
  /** Optional label text. */
  label?: string;
  /** Hint text under the label. */
  help?: string;
}

/**
 * FoodAutocomplete — controlled combobox combining history-based suggestions
 * with optional Open Food Facts fallback search.
 *
 * Behavior (Phase 15d):
 *   - Show up to 5 suggestions in a dropdown below the input
 *   - On focus with empty input: show 5 most recent history items
 *   - As user types: word-prefix filter against history (Q3=B)
 *   - When history has 0 matches: show a "Search Open Food Facts for '<q>'"
 *     footer that triggers an opt-in OFF search (Q1=D)
 *   - Tap a suggestion: fills name + calories (Q8=A)
 *   - Keyboard: arrow keys to navigate, Enter to select, Esc to close
 */
export function FoodAutocomplete({
  name, calories, onChange, history, required, label, help,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState<number>(-1);

  // OFF search state — only triggered when user explicitly taps the search button
  const [offResults, setOffResults] = useState<OffSearchResult[] | null>(null);
  const [offLoading, setOffLoading] = useState(false);
  const [offQuery, setOffQuery] = useState<string | null>(null);

  // Reset OFF results whenever the input changes; user has to opt in again
  useEffect(() => {
    setOffResults(null);
    setOffQuery(null);
  }, [name]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ----- Filtering -----
  // Word-prefix match: split item name on whitespace; match if any word starts
  // with the query (case-insensitive).
  const query = name.trim().toLowerCase();
  const filteredHistory: HistoryItem[] = (() => {
    if (query.length === 0) return history.slice(0, 5);
    return history
      .filter((item) => {
        const words = item.name.toLowerCase().split(/\s+/);
        return words.some((w) => w.startsWith(query));
      })
      .slice(0, 5);
  })();

  // Items rendered in the dropdown — history first, then optional OFF section
  const showOffSection = filteredHistory.length === 0 && query.length >= 2;
  const hasOffResults = offResults !== null && offResults.length > 0;

  // Flattened list of selectable rows for keyboard nav (history + OFF results)
  const rows: Array<{ kind: 'history' | 'off'; name: string; calories: number }> = [
    ...filteredHistory.map((h) => ({ kind: 'history' as const, name: h.name, calories: h.calories })),
    ...(hasOffResults
      ? offResults!.map((r) => ({ kind: 'off' as const, name: r.name, calories: r.calories ?? 0 }))
      : []),
  ];

  // ----- Selection -----
  const handleSelect = (item: { name: string; calories: number }) => {
    onChange({ name: item.name, calories: item.calories.toString() });
    setOpen(false);
    setHighlightedIdx(-1);
  };

  const handleOffSearch = async () => {
    setOffLoading(true);
    setOffQuery(query);
    try {
      const results = await searchByText(query, 5);
      setOffResults(results);
    } catch {
      setOffResults([]);
    } finally {
      setOffLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((idx) => Math.min(rows.length - 1, idx + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((idx) => Math.max(-1, idx - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIdx >= 0 && highlightedIdx < rows.length) {
        e.preventDefault();
        handleSelect(rows[highlightedIdx]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightedIdx(-1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="kicker block mb-1">
        {label ?? 'What was it?'}
        {required && <span className="text-crimson ml-1">*</span>}
      </label>
      {help && <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mb-1.5">{help}</p>}
      <input
        ref={inputRef}
        type="text"
        required={required}
        maxLength={200}
        className="input-base"
        value={name}
        onChange={(e) => {
          onChange({ name: e.target.value, calories });
          setOpen(true);
          setHighlightedIdx(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
      />

      {open && (filteredHistory.length > 0 || showOffSection) && (
        <div
          className="absolute z-20 left-0 right-0 mt-1 card-base shadow-card-hover overflow-hidden"
          role="listbox"
        >
          {/* History section */}
          {filteredHistory.length > 0 && (
            <div>
              <div className="px-3 py-1.5 kicker text-[9px] bg-sand-50 border-b border-ink-hair">
                {query.length === 0 ? 'Recently logged' : 'From your history'}
              </div>
              {filteredHistory.map((item, idx) => (
                <SuggestionRow
                  key={`h-${idx}`}
                  item={item}
                  highlighted={idx === highlightedIdx}
                  onSelect={() => handleSelect(item)}
                />
              ))}
            </div>
          )}

          {/* OFF fallback section */}
          {showOffSection && (
            <div>
              {filteredHistory.length > 0 && <div className="h-px bg-ink-hair" />}
              {hasOffResults ? (
                <>
                  <div className="px-3 py-1.5 kicker text-[9px] bg-sand-50 border-b border-ink-hair">
                    From Open Food Facts &middot; {offQuery}
                  </div>
                  {offResults!.map((item, idx) => {
                    const flatIdx = filteredHistory.length + idx;
                    return (
                      <SuggestionRow
                        key={`o-${idx}`}
                        item={{ name: item.name, calories: item.calories ?? 0 }}
                        subtitle={item.per === '100g' ? 'per 100g \u2014 adjust for portion' : null}
                        highlighted={flatIdx === highlightedIdx}
                        onSelect={() => handleSelect({ name: item.name, calories: item.calories ?? 0 })}
                      />
                    );
                  })}
                </>
              ) : offResults !== null && offResults.length === 0 ? (
                <div className="px-3 py-3 text-xs text-ink-dim text-center">
                  No matches in Open Food Facts.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleOffSearch}
                  disabled={offLoading}
                  className="block w-full text-left px-3 py-2.5 text-sm text-ink-dim hover:bg-ivory border-t border-ink-hair"
                >
                  {offLoading ? (
                    <span className="font-mono text-xs">{'Searching Open Food Facts\u2026'}</span>
                  ) : (
                    <>
                      <span className="text-crimson">Search Open Food Facts</span>
                      <span className="text-ink-faint"> for &ldquo;{query}&rdquo;</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Single suggestion row
// ----------------------------------------------------------------------------

function SuggestionRow({
  item, highlighted, onSelect, subtitle,
}: {
  item: { name: string; calories: number };
  highlighted: boolean;
  onSelect: () => void;
  subtitle?: string | null;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // Use onMouseDown instead of onClick to fire before the input's onBlur,
        // which would close the dropdown and discard the click target.
        e.preventDefault();
        onSelect();
      }}
      role="option"
      aria-selected={highlighted}
      className={`flex items-center justify-between gap-3 w-full text-left px-3 py-2.5 ${
        highlighted ? 'bg-ivory' : 'hover:bg-ivory'
      } transition-colors`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ink truncate">{item.name}</div>
        {subtitle && <div className="text-[10px] text-ink-faint mt-0.5">{subtitle}</div>}
      </div>
      <div className="flex-shrink-0 font-mono text-sm text-ink-dim">
        {item.calories.toLocaleString()} <span className="text-[10px] text-ink-faint">kcal</span>
      </div>
    </button>
  );
}
