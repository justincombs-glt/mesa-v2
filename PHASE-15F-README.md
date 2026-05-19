# MESA v2 — Phase 15f: Nutrition Macros + Micros

**Status:** Ready to deploy
**SQL migration required:** `0028_phase15f_nutrition_macros_micros.sql`
**New env vars required:** None
**Action count:** 111 (unchanged)

Extends the existing nutrition feature (Phases 15a-e) to capture and display protein, carbs, fat, fiber, sodium, iron, calcium, vitamin D, and potassium when Open Food Facts returns them. Requested by the trainer to support performance and weight-gain tracking.

The Open Food Facts integration was already capturing this data — it was being discarded inside the wrapper before reaching the database. This phase plumbs it through end-to-end.

---

## What this phase ships

### Capture (write path)
- **Barcode scan**: when an OFF lookup returns macros/micros, they're now stored alongside calories.
- **Manual entry**: macros/micros stay NULL (same as before). Athletes typing free-text food names don't have macros to type in.
- **Text-search autocomplete picks**: still calorie-only in v1. Intentional scope cut — Phase 15g can extend to text-search picks if you want full coverage.

### Display (read path)
- **Today section** — under the calorie progress, two small text lines:
  - Macros: `65g protein · 180g carbs · 50g fat · 18g fiber · 1,450mg sodium`
  - Micros: `18mg iron · 800mg calcium · 12mcg vit D · 2,100mg potassium`
- **Each entry row** — small subtitle: `12g P · 38g C · 14g F` (skipped if no macro data)
- **Scan confirmation banner** — now includes macro summary when present: "Per serving from Open Food Facts. Review and adjust if needed. (12g protein · 38g carbs · 14g fat)"
- **Partial-data note** — when only SOME of today's entries have macros: "5 of 7 entries with macro data"
- **Trainer view** — mirrors the household display (same macros/micros lines).
- **7-day chart** — UNCHANGED (still calorie-only). Macro charts deferred to keep visual density manageable.

### Trainer access
**Already in place from Phase 15b.** The existing trainer-read RLS policy on `nutrition_entries` automatically covers the new columns. No RLS changes needed in this phase.

---

## What's intentionally NOT in this phase

These items came up during design and were deferred:

- **Text-search autocomplete capturing macros.** When an athlete picks a result from the FoodAutocomplete component (text-search OFF results), macros are NOT captured today. Only barcode scans capture macros in v1. Reason: avoids touching FoodAutocomplete + getNutritionHistory + HistoryItem type in this phase, reducing regression surface. Phase 15g can extend.
- **History items carrying forward macros.** When you tap a recent history item to re-log it, macros don't come along. Same reason.
- **Macro goals.** No protein/carbs/fat daily targets in `nutrition_goals`. This was an intentional product decision to avoid optimization framing — the existing copy emphasizes "notice patterns, not restrict." If the trainer asks for goal-setting, that's a follow-up phase.
- **Per-entry macro/micro editing.** The DELETE button on each entry still exists; there's no edit. Same as today.
- **Charts.** 7-day calorie chart unchanged.

---

## Files in this zip

### New
- `supabase/migrations/0028_phase15f_nutrition_macros_micros.sql` — adds 9 nullable columns + sanity check constraints

### Modified (full replacements)
- `lib/openfoodfacts.ts` — extracts macro/micro fields from OFF response; unit conversions baked in (sodium/iron/calcium/potassium grams→mg, vitamin D grams→mcg). Adds `OffNutrients` type and `nutrients` field to `OffLookupResult` and `OffSearchResult`.
- `lib/nutrition.ts` — adds `NutritionEntryExtended` type, `NutritionTotals` type, `aggregateTotals()` helper. `buildNutritionData()` now returns per-day macro totals.
- `components/nutrition/NutritionTracker.tsx` — displays macros/micros in Today section + per-entry subtitles + scan confirmation; LogEntryModal captures scanned nutrients and sends them on save.
- `components/nutrition/TrainerNutritionView.tsx` — mirrors the household display.

### Snippet for `app/actions.ts`
- `app/actions-snippet-logNutritionEntry.ts` — replacement for the existing `logNutritionEntry` function. Hand-apply this to your `app/actions.ts` (instructions in the file header).

Why a snippet not a full file: `app/actions.ts` is 3000+ lines across many phases. Shipping the whole file as a replacement would risk clobbering changes you've made between Phase 15e and now. Surgical edit only.

---

## Deploy

### Step 1: Run migration

Paste `mesa-v2-migration-0028.sql` into Supabase SQL Editor → Run.

Adds 9 columns to `nutrition_entries`. Idempotent. No backfill — existing rows stay NULL for the new columns.

### Step 2: Regenerate Supabase TypeScript types (recommended)

After running the migration, regenerate types so `NutritionEntry` includes the new columns:

```bash
supabase gen types typescript --linked > lib/supabase/types.ts
```

If you can't or don't want to regenerate, the code uses inline intersections (`NutritionEntryExtended`) to compensate. It works either way; regenerating is cleaner.

### Step 3: Apply the actions snippet

1. Open `app/actions.ts`
2. Find the existing `logNutritionEntry` function (around line 1100-1150 in your file based on the size — search for "export async function logNutritionEntry")
3. Open `app/actions-snippet-logNutritionEntry.ts` from this zip
4. Replace the ENTIRE existing `logNutritionEntry` function (including its JSDoc) with the version from the snippet file
5. Save `app/actions.ts`

The snippet file should NOT itself be in your repo — it's an instructional artifact only. Delete it after applying.

### Step 4: Push code

```bash
cd ~/Desktop/mesa-v2
claude
```

```
Unzip ~/Downloads/mesa-v2-phase-15f-clean.zip into the current directory,
overwriting existing files. Then run git status. Stop there.
```

After confirming the diff looks right + after applying the snippet to `app/actions.ts`:

```
Commit "Phase 15f: nutrition macros and micros via Open Food Facts" and push.
```

Vercel rebuilds. Should compile cleanly.

### Step 5: Verify

1. Sign in as a student (Justin, or the student who logged the existing entries in your screenshot)
2. Go to `/dashboard/nutrition`
3. Click "+ Log"
4. Click "Scan a barcode"
5. Scan a packaged item with good OFF coverage (most popular brand-name products work — Cheerios, Gatorade, protein bars). Or paste a known barcode like `5449000000996` (Coca-Cola)
6. After scan, you should see the scan info banner with macros: "Per serving from Open Food Facts. (XXg protein · XXg carbs · XXg fat)"
7. Tap "Log entry"
8. The entry now appears in today's list with a macro subtitle
9. The Today card shows macro totals under the calorie progress bar

To verify the database:
```sql
select name, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg,
       iron_mg, calcium_mg, vitamin_d_mcg, potassium_mg
from nutrition_entries
where student_id = 'YOUR_STUDENT_UUID'
order by occurred_at desc
limit 5;
```

Should show the most recent entries with macros populated for barcode-scanned items, NULL for manually-typed entries.

### Step 6: Verify trainer view

1. Sign in as a trainer
2. Navigate to the trainer's per-student nutrition view (wherever you mount `TrainerNutritionView` — likely `/dashboard/students/[id]/nutrition` or similar)
3. The macros/micros lines should appear identically to the athlete view

---

## How Open Food Facts data quality plays out

OFF is crowdsourced. Coverage varies:

- **Big packaged brands (Gatorade, Quaker Oats, Kraft, Coca-Cola, Tyson)** — macros usually complete. Micros (iron, calcium, vit D) often present.
- **Smaller / regional brands** — macros usually present. Micros spotty.
- **Whole foods (raw banana, plain chicken breast)** — exists in OFF under generic entries, but coverage is uneven. Macros often present, micros usually NULL.
- **Restaurant / homemade items** — not in OFF at all. Manual entry, no macros captured.

Expect ~70% of barcode-scanned entries to have macros, ~30-50% to have at least one micro. The "X of Y entries with macro data" note keeps the UI honest about partial data.

---

## Unit conversions (technical detail)

Open Food Facts stores nutriment values in grams as the base unit, even for tiny amounts:

| Nutrient | OFF storage | MESA DB | Conversion |
|---|---|---|---|
| protein, carbs, fat, fiber | grams | grams | none |
| sodium | grams | mg | × 1,000 |
| iron, calcium, potassium | grams | mg | × 1,000 |
| vitamin D | grams | mcg | × 1,000,000 |

The `_extractNutrients()` helper in `lib/openfoodfacts.ts` handles all conversions. If a future OFF schema change moves a field to a different unit, this is the single point to update.

---

## Sanity bounds

The migration adds CHECK constraints to catch unit-conversion bugs:

| Field | Min | Max |
|---|---|---|
| protein_g | 0 | 500 |
| carbs_g | 0 | 1,000 |
| fat_g | 0 | 500 |
| fiber_g | 0 | 200 |
| sodium_mg | 0 | 20,000 |
| iron_mg | 0 | 100 |
| calcium_mg | 0 | 5,000 |
| vitamin_d_mcg | 0 | 1,000 |
| potassium_mg | 0 | 20,000 |

These are per-entry sanity caps (not per-day). A 5,000mg calcium single-meal entry would fail the constraint — likely a unit error. The application-layer `parseOpt` in the action also rejects out-of-bounds values for a clearer error message before hitting the DB.

---

## What's next

After 15f deploys and you've confirmed scanned macros are flowing:

- **Phase 15g** (optional) — extend macro capture to text-search autocomplete picks AND history-item picks. Requires updating `FoodAutocomplete`, `HistoryItem` type, and `getNutritionHistory` action. ~half the size of 15f.
- **Phase 15h** (if trainer asks) — macro goal-setting. Adds `daily_protein_g` etc. to `nutrition_goals`, surfaces in goal-setting UI, displays vs targets in dashboard. Worth pausing to discuss disordered-eating risk before building — see migration 0019's design commentary.
- **Phase 15i** (if requested) — charts split by macro / stacked bars in the 7-day strip.

---

## Verification checklist

- [ ] `0028_phase15f_nutrition_macros_micros` migration ran in Supabase
- [ ] 9 new columns visible on `nutrition_entries`
- [ ] Sanity check constraints in place (`nutrition_macros_sane`, `nutrition_micros_sane`)
- [ ] Supabase types regenerated (or relying on inline intersection)
- [ ] `logNutritionEntry` snippet applied to `app/actions.ts`
- [ ] All other files unzipped, deployed
- [ ] Barcode scan of a packaged item produces macros in DB
- [ ] Manual entry produces calories only, NULL macros
- [ ] Today section shows macros line when ≥1 entry has macros
- [ ] Per-entry subtitle shows on entries with macros, hidden on entries without
- [ ] Trainer view shows same macros/micros
- [ ] 7-day chart unchanged
- [ ] Snippet file `app/actions-snippet-logNutritionEntry.ts` deleted from repo after applying
