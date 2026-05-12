'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  setNutritionGoal, logNutritionEntry,
  deleteNutritionEntry, deleteAllNutritionHistory,
} from '@/app/actions';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { BarcodeScanModal } from '@/components/nutrition/BarcodeScanModal';
import type { OffLookupResult } from '@/lib/openfoodfacts';
import type { NutritionEntry } from '@/lib/supabase/types';
import type { NutritionData } from '@/lib/nutrition';

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
        <SevenDaySection days={last7Days} goal={goal!.daily_calories} />
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
  today: { date: string; entries: NutritionEntry[]; total: number };
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

      <TodayProgress total={today.total} goal={goal} />

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

function TodayProgress({ total, goal }: { total: number; goal: number | null }) {
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
    </div>
  );
}

function EntryRow({
  entry, studentId, first,
}: {
  entry: NutritionEntry;
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

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${first ? '' : 'border-t border-ink-hair'}`}>
      <div className="flex-shrink-0 w-16 text-right">
        <div className="font-mono text-xs text-ink-faint">{time}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ink truncate">{entry.name}</div>
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

  // Sub-modal state for barcode scanning
  const [scanOpen, setScanOpen] = useState(false);

  // Reset all state when the parent modal closes
  useEffect(() => {
    if (!open) {
      setName('');
      setCalories('');
      setScanInfo(null);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set('student_id', studentId);
    fd.set('name', name);
    fd.set('calories', calories);
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
      setScanInfo(result.per === 'serving'
        ? 'Calories per serving from Open Food Facts. Review and adjust if needed.'
        : 'Per 100g from Open Food Facts \u2014 you may want to adjust for your actual portion.');
    } else if (result.kind === 'partial') {
      setName(result.name);
      setCalories('');
      setScanInfo('Found the product but no calorie data \u2014 please enter calories.');
    } else {
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

          <FormField label="What was it?" required help="e.g. Granola bar, Banana, Chicken sandwich">
            <input
              type="text"
              required
              maxLength={200}
              className="input-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

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

function SevenDaySection({ days, goal }: {
  days: { date: string; entries: NutritionEntry[]; total: number }[];
  goal: number;
}) {
  return (
    <section>
      <div className="kicker mb-3">Last 7 days</div>
      <div className="card-base p-4">
        <div className="grid grid-cols-7 gap-2">
          {[...days].reverse().map((day) => {
            const date = new Date(day.date + 'T00:00:00');
            const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
            const dayNum = date.getDate();
            // Shame-free: bars fill toward goal but never get a "you went over" red.
            // Cap at 100% visually, mark color slightly different at full.
            const pct = goal > 0 ? Math.min(100, (day.total / goal) * 100) : 0;
            const isToday = day.date === new Date().toISOString().slice(0, 10);

            return (
              <div key={day.date} className="flex flex-col items-center gap-1.5">
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
                    aria-label={`${day.total} calories on ${day.date}`}
                  />
                </div>
                <div className="text-[10px] font-mono text-ink-dim">
                  {day.total > 0 ? day.total.toLocaleString() : '\u2014'}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint text-center mt-3">
          Sage bars = calories logged each day &middot; full bar at goal
        </p>
      </div>
    </section>
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
