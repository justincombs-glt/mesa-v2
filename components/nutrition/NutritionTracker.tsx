'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  setNutritionGoal, logNutritionEntry,
  deleteNutritionEntry, deleteAllNutritionHistory,
  getNutritionHistory,
} from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { BarcodeScanModal } from '@/components/nutrition/BarcodeScanModal';
import { FoodAutocomplete, type HistoryItem } from '@/components/nutrition/FoodAutocomplete';
import type { OffLookupResult, OffNutrients } from '@/lib/openfoodfacts';
import type { NutritionData, NutritionEntryExtended, NutritionTotals } from '@/lib/nutrition';

interface Props {
  studentId: string;
  studentName: string;
  data: NutritionData;
  /** Caller role determines copy and slight UI differences. */
  viewerRole: 'student' | 'parent';
  /** Q3 = B: only 16+ students can self-set their daily goal. Parents always can. */
  allowGoalSelfSet: boolean;
}

export function NutritionTracker({ studentId, studentName, data, viewerRole, allowGoalSelfSet }: Props) {
  const { goal, today, last7Days } = data;
  const hasGoal = !!goal;

  // Phase 15e: history page route differs by role
  const historyHref = viewerRole === 'parent'
    ? `/dashboard/family/${studentId}/nutrition/history`
    : '/dashboard/nutrition/history';

  return (
    <div className="flex flex-col gap-6">
      <EducationalBanner viewerRole={viewerRole} />

      <TodaySection
        studentId={studentId}
        today={today}
        goal={goal?.daily_calories ?? null}
        viewerRole={viewerRole}
      />

      {hasGoal && (
        <SevenDaySection days={last7Days} goal={goal!.daily_calories} historyHref={historyHref} />
      )}

      <GoalSection
        studentId={studentId}
        currentGoal={goal?.daily_calories ?? null}
        viewerRole={viewerRole}
        allowSelfSet={allowGoalSelfSet}
      />

      <DangerZone studentId={studentId} studentName={studentName} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Educational copy at top — Q9 = D
// ----------------------------------------------------------------------------

function EducationalBanner({ viewerRole }: { viewerRole: 'student' | 'parent' }) {
  return (
    <div className="card-base p-4 bg-sand-50 border-sage/20">
      <div className="kicker mb-1">A note on fueling</div>
      <p className="text-sm text-ink-dim leading-relaxed">
        {viewerRole === 'student'
          ? "You're an athlete. Eating enough is part of your training — not the opposite of it. This tracker helps you notice patterns, not restrict food. If you're ever unsure how much to eat, ask a parent or trusted adult."
          : "This tracker is a tool for awareness, not restriction. Active teen athletes typically need 2,200\u20133,000+ calories per day. If you're setting a daily goal here, please choose one that supports growth and training rather than limits it."}
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Today: progress + entry log
// ----------------------------------------------------------------------------

function TodaySection({
  studentId, today, goal, viewerRole,
}: {
  studentId: string;
  today: { date: string; entries: NutritionEntryExtended[]; total: number; totals: NutritionTotals };
  goal: number | null;
  viewerRole: 'student' | 'parent';
}) {
  const [logOpen, setLogOpen] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="kicker">Today</div>
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="btn-primary !h-9 text-[12px] !px-4"
        >
          + Log
        </button>
      </div>

      <TodayProgress total={today.total} goal={goal} totals={today.totals} />

      <div className="mt-4">
        {today.entries.length === 0 ? (
          <div className="card-base p-6 text-center text-sm text-ink-dim">
            Nothing logged yet today.
          </div>
        ) : (
          <div className="card-base overflow-hidden">
            {today.entries.map((entry, idx) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                studentId={studentId}
                first={idx === 0}
              />
            ))}
          </div>
        )}
      </div>

      <LogEntryModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        studentId={studentId}
        viewerRole={viewerRole}
      />
    </section>
  );
}

function TodayProgress({ total, goal, totals }: { total: number; goal: number | null; totals: NutritionTotals }) {
  // Shame-free UI (Q9 = C): no red bars when over, no scolding language.
  // Pure neutral display: total / goal, with a quiet fill bar.
  if (goal === null) {
    return (
      <div className="card-base p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-serif text-4xl text-ink">{total.toLocaleString()}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
              calories logged today
            </div>
          </div>
          <div className="text-xs text-ink-faint">Set a daily goal below to track progress.</div>
        </div>
        <MacroMicroSummary totals={totals} />
      </div>
    );
  }

  const pct = Math.min(100, (total / goal) * 100);
  const remaining = goal - total;

  return (
    <div className="card-base p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="font-serif text-4xl text-ink">{total.toLocaleString()}</div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
            of {goal.toLocaleString()} kcal
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg text-ink">
            {remaining > 0 ? `${remaining.toLocaleString()}` : '\u2014'}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
            {remaining > 0 ? 'to go' : 'goal met'}
          </div>
        </div>
      </div>
      <div className="h-2 bg-sand-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-sage-dark transition-all"
          style={{ width: `${pct}%` }}
          aria-label={`${Math.round(pct)} percent of daily goal`}
        />
      </div>
      <MacroMicroSummary totals={totals} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Phase 15f: macro + micro summary lines under the calorie progress card.
// Renders only when at least one entry has macro data; otherwise hidden.
// Partial-data note shown when only some entries have macros.
// ----------------------------------------------------------------------------

function MacroMicroSummary({ totals }: { totals: NutritionTotals }) {
  if (totals.entries_with_macros === 0) return null;

  const macroBits: string[] = [];
  if (totals.protein_g > 0) macroBits.push(`${formatNum(totals.protein_g)}g protein`);
  if (totals.carbs_g > 0) macroBits.push(`${formatNum(totals.carbs_g)}g carbs`);
  if (totals.fat_g > 0) macroBits.push(`${formatNum(totals.fat_g)}g fat`);
  if (totals.fiber_g > 0) macroBits.push(`${formatNum(totals.fiber_g)}g fiber`);
  if (totals.sodium_mg > 0) macroBits.push(`${totals.sodium_mg.toLocaleString()}mg sodium`);

  const microBits: string[] = [];
  if (totals.iron_mg > 0) microBits.push(`${formatNum(totals.iron_mg)}mg iron`);
  if (totals.calcium_mg > 0) microBits.push(`${totals.calcium_mg.toLocaleString()}mg calcium`);
  if (totals.vitamin_d_mcg > 0) microBits.push(`${formatNum(totals.vitamin_d_mcg)}mcg vit D`);
  if (totals.potassium_mg > 0) microBits.push(`${totals.potassium_mg.toLocaleString()}mg potassium`);

  const partial = totals.entries_with_macros < totals.entries_total;

  return (
    <div className="mt-4 pt-4 border-t border-ink-hair space-y-1.5">
      {macroBits.length > 0 && (
        <div className="text-[11px] text-ink-dim">
          {macroBits.join(' \u00b7 ')}
        </div>
      )}
      {microBits.length > 0 && (
        <div className="text-[11px] text-ink-dim">
          {microBits.join(' \u00b7 ')}
        </div>
      )}
      {partial && (
        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-2">
          {totals.entries_with_macros} of {totals.entries_total} entries with macro data
        </div>
      )}
    </div>
  );
}

function formatNum(n: number): string {
  // Drop trailing .0 for whole numbers; otherwise show 1 decimal
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

function EntryRow({
  entry, studentId, first,
}: {
  entry: NutritionEntryExtended;
  studentId: string;
  first: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${entry.name}"?`)) return;
    setDeleting(true);
    const fd = new FormData();
    fd.set('id', entry.id);
    fd.set('student_id', studentId);
    await deleteNutritionEntry(fd);
    router.refresh();
  };

  const time = new Date(entry.occurred_at).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });

  // Phase 15f: macro subtitle. Show only the big-three (protein/carbs/fat) on
  // the per-entry row to keep it visually quiet. NULL fields are skipped.
  const macroBits: string[] = [];
  if (entry.protein_g !== null) macroBits.push(`${formatNum(Number(entry.protein_g))}g P`);
  if (entry.carbs_g !== null) macroBits.push(`${formatNum(Number(entry.carbs_g))}g C`);
  if (entry.fat_g !== null) macroBits.push(`${formatNum(Number(entry.fat_g))}g F`);

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="flex-shrink-0 w-16 text-right">
        <div className="font-mono text-xs text-ink-faint">{time}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ink truncate">{entry.name}</div>
        {macroBits.length > 0 && (
          <div className="text-[10px] font-mono text-ink-faint mt-0.5">
            {macroBits.join(' \u00b7 ')}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 font-mono text-sm text-ink">
        {entry.calories.toLocaleString()}
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="flex-shrink-0 text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson disabled:opacity-50"
        aria-label="Delete entry"
      >
        &times;
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Log entry modal (manual entry — Q7 = A)
// ----------------------------------------------------------------------------

function LogEntryModal({
  open, onClose, studentId, viewerRole,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  viewerRole: 'student' | 'parent';
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Controlled inputs so the barcode scanner can pre-populate them
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  // Phase 15f: nutrients captured from a barcode scan. Stays null when the
  // user enters food manually or picks from autocomplete (text/history) —
  // those paths don't yet carry macros (slated for 15g).
  const [scannedNutrients, setScannedNutrients] = useState<OffNutrients | null>(null);

  // Sub-modal state for barcode scanning
  const [scanOpen, setScanOpen] = useState(false);

  // Phase 15d: autocomplete history (fetched once when the modal opens)
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Fetch history when the modal opens; reset everything when it closes
  useEffect(() => {
    if (!open) {
      setName('');
      setCalories('');
      setScanInfo(null);
      setScannedNutrients(null);
      setError(null);
      setHistory([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const fd = new FormData();
      fd.set('student_id', studentId);
      const res = await getNutritionHistory(fd);
      if (!cancelled && res.ok && res.items) {
        setHistory(res.items);
      }
    })();
    return () => { cancelled = true; };
  }, [open, studentId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set('student_id', studentId);
    fd.set('name', name);
    fd.set('calories', calories);
    // Phase 15f: include macros/micros when we captured them from a scan.
    // The server action treats missing fields as null in the DB.
    if (scannedNutrients) {
      const n = scannedNutrients;
      if (n.protein_g !== null) fd.set('protein_g', String(n.protein_g));
      if (n.carbs_g !== null) fd.set('carbs_g', String(n.carbs_g));
      if (n.fat_g !== null) fd.set('fat_g', String(n.fat_g));
      if (n.fiber_g !== null) fd.set('fiber_g', String(n.fiber_g));
      if (n.sodium_mg !== null) fd.set('sodium_mg', String(n.sodium_mg));
      if (n.iron_mg !== null) fd.set('iron_mg', String(n.iron_mg));
      if (n.calcium_mg !== null) fd.set('calcium_mg', String(n.calcium_mg));
      if (n.vitamin_d_mcg !== null) fd.set('vitamin_d_mcg', String(n.vitamin_d_mcg));
      if (n.potassium_mg !== null) fd.set('potassium_mg', String(n.potassium_mg));
    }
    setSaving(true);
    setError(null);
    const res = await logNutritionEntry(fd);
    setSaving(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      setError(res.error ?? 'Could not log.');
    }
  };

  const handleScanResult = (result: OffLookupResult) => {
    if (result.kind === 'found') {
      setName(result.name);
      setCalories(result.calories.toString());
      setScannedNutrients(result.nutrients);
      // Phase 15f: enrich the scan info line with macros when present
      const macroSummary = _summarizeNutrientsLine(result.nutrients);
      const base = result.per === 'serving'
        ? 'Per serving from Open Food Facts. Review and adjust if needed.'
        : 'Per 100g from Open Food Facts \u2014 you may want to adjust for your actual portion.';
      setScanInfo(macroSummary ? `${base} (${macroSummary})` : base);
    } else if (result.kind === 'partial') {
      setName(result.name);
      setCalories('');
      setScannedNutrients(null);
      setScanInfo('Found the product but no calorie data \u2014 please enter calories.');
    } else {
      setScannedNutrients(null);
      setScanInfo('Product not found in the food database \u2014 enter the details manually.');
    }
  };

  return (
    <>
      <Modal
        open={open && !scanOpen}
        onClose={onClose}
        title="Log a food or drink"
        description={viewerRole === 'parent'
          ? "Add an item your child consumed."
          : "What did you eat or drink?"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border-2 border-dashed border-sage-dark/40 text-sage-dark hover:bg-sage/5 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6V4a1 1 0 011-1h2M3 18v2a1 1 0 001 1h2M21 6V4a1 1 0 00-1-1h-2M21 18v2a1 1 0 01-1 1h-2"/>
              <line x1="7" y1="7" x2="7" y2="17"/>
              <line x1="10" y1="7" x2="10" y2="17"/>
              <line x1="13" y1="7" x2="13" y2="17"/>
              <line x1="17" y1="7" x2="17" y2="17"/>
            </svg>
            <span className="text-sm font-medium">Scan a barcode</span>
          </button>

          {scanInfo && (
            <div className="text-xs text-ink-dim bg-sand-50 p-2.5 rounded">
              {scanInfo}
            </div>
          )}

          <FoodAutocomplete
            name={name}
            calories={calories}
            onChange={({ name: n, calories: c }) => { setName(n); setCalories(c); }}
            history={history}
            required
            label="What was it?"
            help="e.g. Granola bar, Banana, Chicken sandwich"
          />

          <FormField label="Calories" required>
            <input
              type="number"
              required
              min="0"
              max="10000"
              inputMode="numeric"
              placeholder="e.g. 180"
              className="input-base"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
          </FormField>

          {error && <div className="text-sm text-crimson">{error}</div>}

          <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-ink-hair">
            <button type="button" onClick={onClose} className="btn-secondary !h-10 text-[13px]">Cancel</button>
            <button type="submit" disabled={saving || !name.trim() || !calories.trim()} className="btn-primary !h-10 text-[13px]">
              {saving ? 'Logging\u2026' : 'Log entry'}
            </button>
          </div>
        </form>
      </Modal>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={handleScanResult}
        onSkipToManual={() => setScanInfo(null)}
      />
    </>
  );
}

// ----------------------------------------------------------------------------
// 7-day strip
// ----------------------------------------------------------------------------

function SevenDaySection({ days, goal, historyHref }: {
  days: { date: string; entries: NutritionEntryExtended[]; total: number; totals: NutritionTotals }[];
  goal: number;
  historyHref: string;
}) {
  // Phase 15e: which day is currently expanded? Null = none.
  // Today is intentionally non-expandable since it's already visible in
  // TodaySection above; tapping today's bar is a no-op.
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const todayKey = new Date().toISOString().slice(0, 10);

  // Re-look up the expanded day's entries from props (kept in sync with parent
  // refresh after edit/delete)
  const expandedDay = expandedDate
    ? days.find((d) => d.date === expandedDate)
    : null;

  return (
    <section>
      <div className="kicker mb-3">Last 7 days</div>
      <div className="card-base p-4">
        <div className="grid grid-cols-7 gap-2">
          {[...days].reverse().map((day) => {
            const date = new Date(day.date + 'T00:00:00');
            const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
            const dayNum = date.getDate();
            const pct = goal > 0 ? Math.min(100, (day.total / goal) * 100) : 0;
            const isToday = day.date === todayKey;
            const isExpanded = day.date === expandedDate;
            // Q10 = A: only days with at least one entry are tappable
            const isTappable = !isToday && day.entries.length > 0;

            const baseClasses = 'flex flex-col items-center gap-1.5 rounded p-1 -m-1';
            const interactiveClasses = isTappable
              ? `cursor-pointer ${isExpanded ? 'bg-sage/10 ring-1 ring-sage/30' : 'hover:bg-ivory'}`
              : '';

            const onClick = isTappable
              ? () => setExpandedDate(isExpanded ? null : day.date)
              : undefined;

            return (
              <button
                key={day.date}
                type="button"
                onClick={onClick}
                disabled={!isTappable}
                className={`${baseClasses} ${interactiveClasses} text-left disabled:cursor-default`}
                aria-expanded={isExpanded || undefined}
                aria-label={isTappable
                  ? `${day.entries.length} entries, ${day.total} calories on ${day.date}. Tap to ${isExpanded ? 'collapse' : 'expand'}.`
                  : `${day.total} calories on ${day.date}`}
              >
                <div className={`text-[10px] font-mono uppercase ${isToday ? 'text-crimson' : 'text-ink-faint'}`}>
                  {dayLabel}
                </div>
                <div className={`text-xs ${isToday ? 'text-ink font-medium' : 'text-ink-dim'}`}>
                  {dayNum}
                </div>
                <div className="h-16 w-full bg-sand-100 rounded relative overflow-hidden">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-sage-dark transition-all"
                    style={{ height: `${pct}%` }}
                    aria-hidden
                  />
                </div>
                <div className="text-[10px] font-mono text-ink-dim">
                  {day.total > 0 ? day.total.toLocaleString() : '\u2014'}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint text-center mt-3">
          Tap a past day to see what you ate &middot; today shown above
        </p>
        <div className="text-center mt-2">
          <Link
            href={historyHref}
            className="text-[11px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson inline-flex items-center gap-1"
          >
            View full history <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </div>

      {/* Phase 15e: inline-expand section showing the selected day's entries */}
      {expandedDay && (
        <ExpandedDayPanel
          day={expandedDay}
          goal={goal}
          onClose={() => setExpandedDate(null)}
        />
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Phase 15e: expanded-day panel
// Shown when the user taps a past day in the 7-day strip. Lists the day's
// entries with a vs-goal indicator (Q3 = B). View-only (Q4 = A).
// ----------------------------------------------------------------------------

function ExpandedDayPanel({
  day, goal, onClose,
}: {
  day: { date: string; entries: NutritionEntryExtended[]; total: number; totals: NutritionTotals };
  goal: number;
  onClose: () => void;
}) {
  const date = new Date(day.date + 'T00:00:00');
  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  const pct = goal > 0 ? Math.round((day.total / goal) * 100) : null;

  return (
    <div className="mt-4 card-base overflow-hidden border-sage/30">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-sand-50 border-b border-ink-hair">
        <div>
          <div className="font-serif text-lg text-ink">{dateLabel}</div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-0.5">
            {day.total.toLocaleString()} kcal logged
            {pct !== null && (
              <>
                {' \u00b7 '}
                {pct}% of {goal.toLocaleString()} goal
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson"
          aria-label="Collapse day"
        >
          Close
        </button>
      </div>

      {/* Entries */}
      {day.entries.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-dim">
          No entries logged on this day.
        </div>
      ) : (
        <div>
          {day.entries.map((entry, idx) => (
            <ExpandedDayEntryRow
              key={entry.id}
              entry={entry}
              first={idx === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// One row inside the expanded day panel. View-only per Q4 = A —
// past days are immutable. Today's entries remain editable via the Today
// section above; this is for historical days only.
// ----------------------------------------------------------------------------

function ExpandedDayEntryRow({
  entry, first,
}: {
  entry: NutritionEntryExtended;
  first: boolean;
}) {
  const time = new Date(entry.occurred_at).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });

  const borderClass = first ? '' : 'border-t border-ink-hair';

  // Phase 15f: same compact macro subtitle as the today EntryRow
  const macroBits: string[] = [];
  if (entry.protein_g !== null) macroBits.push(`${formatNum(Number(entry.protein_g))}g P`);
  if (entry.carbs_g !== null) macroBits.push(`${formatNum(Number(entry.carbs_g))}g C`);
  if (entry.fat_g !== null) macroBits.push(`${formatNum(Number(entry.fat_g))}g F`);

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${borderClass}`}>
      <div className="flex-shrink-0 w-16 text-right">
        <div className="font-mono text-xs text-ink-faint">{time}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ink truncate">{entry.name}</div>
        {macroBits.length > 0 && (
          <div className="text-[10px] font-mono text-ink-faint mt-0.5">
            {macroBits.join(' \u00b7 ')}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 font-mono text-sm text-ink">
        {entry.calories.toLocaleString()}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Goal management
// ----------------------------------------------------------------------------

function GoalSection({
  studentId, currentGoal, viewerRole, allowSelfSet,
}: {
  studentId: string;
  currentGoal: number | null;
  viewerRole: 'student' | 'parent';
  allowSelfSet: boolean;
}) {
  const router = useRouter();
  // Students under 16 (allowSelfSet=false) NEVER see the editor — they get a
  // "ask a parent" message instead, even when no goal is set yet.
  const canEdit = viewerRole === 'parent' || allowSelfSet;
  const [editing, setEditing] = useState(canEdit && currentGoal === null);
  const [value, setValue] = useState(currentGoal?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [floorWarning, setFloorWarning] = useState(false);

  const handleSave = async (confirmBelow: boolean) => {
    setSaving(true);
    setError(null);
    setFloorWarning(false);
    const fd = new FormData();
    fd.set('student_id', studentId);
    fd.set('daily_calories', value);
    if (confirmBelow) fd.set('confirm_below_floor', '1');
    const res = await setNutritionGoal(fd);
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else if (res.warning_below_floor) {
      setFloorWarning(true);
      setError(res.error ?? null);
    } else {
      setError(res.error ?? 'Could not save.');
    }
  };

  // Q3 = B: younger students can't self-set
  if (!canEdit) {
    return (
      <section>
        <div className="kicker mb-3">Daily calorie goal</div>
        <div className="card-base p-5">
          {currentGoal !== null ? (
            <>
              <div className="font-serif text-2xl text-ink">{currentGoal.toLocaleString()}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
                kcal per day
              </div>
              <p className="text-xs text-ink-dim mt-3">
                Set by a parent. If you want to change this, ask them to update it.
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-dim">
              No goal set yet. Ask a parent to set your daily calorie goal so you can see your progress here.
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="kicker mb-3">Daily calorie goal</div>
      <div className="card-base p-5">
        {editing ? (
          <div className="flex flex-col gap-3">
            <FormField
              label="Calories per day"
              help={viewerRole === 'parent'
                ? "An active teen athlete typically needs 2,200\u20133,000+ kcal/day."
                : "Talk with a parent if you're not sure what to put."}
            >
              <input
                type="number"
                value={value}
                onChange={(e) => { setValue(e.target.value); setFloorWarning(false); setError(null); }}
                min="500"
                max="10000"
                inputMode="numeric"
                placeholder="e.g. 2400"
                className="input-base max-w-xs"
                autoFocus
              />
            </FormField>

            {error && (
              <div className={`text-sm p-3 rounded ${floorWarning ? 'bg-crimson/5 border border-crimson/20 text-crimson' : 'text-crimson'}`}>
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {floorWarning ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="btn-secondary !h-9 text-[12px] !px-4 border-crimson/40 text-crimson"
                  >
                    Confirm anyway
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFloorWarning(false); setError(null); }}
                    disabled={saving}
                    className="btn-primary !h-9 text-[12px] !px-4"
                  >
                    Choose a higher goal
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving || !value}
                    className="btn-primary !h-9 text-[12px] !px-4"
                  >
                    {saving ? 'Saving\u2026' : 'Save goal'}
                  </button>
                  {currentGoal !== null && (
                    <button
                      type="button"
                      onClick={() => { setEditing(false); setValue(currentGoal.toString()); setError(null); }}
                      disabled={saving}
                      className="btn-secondary !h-9 text-[12px] !px-4"
                    >
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-serif text-2xl text-ink">{currentGoal!.toLocaleString()}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mt-1">
                kcal per day
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson"
            >
              Change
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Danger zone — full history deletion (Q10 = A)
// ----------------------------------------------------------------------------

function DangerZone({ studentId, studentName }: { studentId: string; studentName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set('student_id', studentId);
    fd.set('confirm', '1');
    const res = await deleteAllNutritionHistory(fd);
    setBusy(false);
    if (res.ok) {
      setConfirming(false);
      router.refresh();
    } else {
      setError(res.error ?? 'Could not delete.');
    }
  };

  return (
    <section>
      <div className="kicker mb-3">Privacy</div>
      <div className="card-base p-4">
        {confirming ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">
              Delete ALL nutrition history for {studentName}, including the daily goal and every logged entry? This cannot be undone.
            </p>
            {error && <div className="text-sm text-crimson">{error}</div>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                className="btn-secondary !h-9 text-[12px] !px-4 border-crimson/40 text-crimson"
              >
                {busy ? 'Deleting\u2026' : 'Yes, delete everything'}
              </button>
              <button
                type="button"
                onClick={() => { setConfirming(false); setError(null); }}
                disabled={busy}
                className="btn-primary !h-9 text-[12px] !px-4"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-ink-dim">
              You can delete all nutrition history at any time. Your data is yours.
            </div>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-[10px] font-mono uppercase tracking-wider text-ink-faint hover:text-crimson flex-shrink-0"
            >
              Delete all
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Phase 15f helpers
// ----------------------------------------------------------------------------

/**
 * Compact single-line summary of macros for the scan-confirmation banner.
 * Returns '' when no macros are available.
 */
function _summarizeNutrientsLine(n: OffNutrients): string {
  const bits: string[] = [];
  if (n.protein_g !== null) bits.push(`${formatNum(n.protein_g)}g protein`);
  if (n.carbs_g !== null) bits.push(`${formatNum(n.carbs_g)}g carbs`);
  if (n.fat_g !== null) bits.push(`${formatNum(n.fat_g)}g fat`);
  return bits.join(' \u00b7 ');
}
