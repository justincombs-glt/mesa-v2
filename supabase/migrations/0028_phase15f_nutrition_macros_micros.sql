-- ============================================================================
-- Phase 15f: Nutrition macros + micros expansion
--
-- Extends nutrition_entries with macro and micro nutrient columns. Open Food
-- Facts (the existing food database integration) returns these fields per
-- product but they were previously discarded. After this migration, the OFF
-- wrapper persists them and the UI surfaces them.
--
-- Columns added (all nullable, no backfill):
--   Macros: protein_g, carbs_g, fat_g, fiber_g (numeric grams)
--           sodium_mg (numeric milligrams)
--   Micros: iron_mg, calcium_mg, potassium_mg (numeric milligrams)
--           vitamin_d_mcg (numeric micrograms)
--
-- WHY these specific fields:
--   - Macros chosen: the 5 OFF returns most reliably + most relevant to
--     trainer-requested weight gain / performance tracking
--   - Micros chosen: iron, calcium, vitamin D, potassium — most relevant to
--     adolescent athlete performance/recovery and best populated in OFF
--   - Saturated fat, sugars, B vitamins, magnesium etc deferred — sparse OFF
--     data and adds visual noise for marginal utility
--
-- WHY all nullable: not every entry has macro data. Manual entries (no OFF
-- match) leave them NULL. Older entries pre-15f stay NULL. Postgres SUM()
-- naturally ignores NULLs so daily totals work without changes.
--
-- RLS: NO CHANGES NEEDED. The existing 15a household-read + 15b trainer-read
-- policies on nutrition_entries cover all columns automatically. The new
-- columns inherit the same access scope.
--
-- TYPE GENERATION: After running this migration, regenerate Supabase types
-- so the NutritionEntry TypeScript interface picks up the new fields:
--   supabase gen types typescript --linked > lib/supabase/types.ts
-- If you can't regenerate, the code uses inline extensions to compensate.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Macro columns
-- ----------------------------------------------------------------------------

alter table public.nutrition_entries
  add column if not exists protein_g numeric(7, 2),
  add column if not exists carbs_g numeric(7, 2),
  add column if not exists fat_g numeric(7, 2),
  add column if not exists fiber_g numeric(7, 2),
  add column if not exists sodium_mg numeric(8, 2);

-- Sanity bounds: non-negative + reasonable upper limits to catch unit
-- conversion bugs (e.g. accidentally storing sodium in grams as if it were mg).
alter table public.nutrition_entries
  drop constraint if exists nutrition_macros_sane;
alter table public.nutrition_entries
  add constraint nutrition_macros_sane check (
    (protein_g is null or (protein_g >= 0 and protein_g <= 500))
    and (carbs_g is null or (carbs_g >= 0 and carbs_g <= 1000))
    and (fat_g is null or (fat_g >= 0 and fat_g <= 500))
    and (fiber_g is null or (fiber_g >= 0 and fiber_g <= 200))
    and (sodium_mg is null or (sodium_mg >= 0 and sodium_mg <= 20000))
  );

-- ----------------------------------------------------------------------------
-- 2. Micro columns
-- ----------------------------------------------------------------------------

alter table public.nutrition_entries
  add column if not exists iron_mg numeric(7, 3),
  add column if not exists calcium_mg numeric(8, 2),
  add column if not exists vitamin_d_mcg numeric(7, 2),
  add column if not exists potassium_mg numeric(8, 2);

alter table public.nutrition_entries
  drop constraint if exists nutrition_micros_sane;
alter table public.nutrition_entries
  add constraint nutrition_micros_sane check (
    (iron_mg is null or (iron_mg >= 0 and iron_mg <= 100))
    and (calcium_mg is null or (calcium_mg >= 0 and calcium_mg <= 5000))
    and (vitamin_d_mcg is null or (vitamin_d_mcg >= 0 and vitamin_d_mcg <= 1000))
    and (potassium_mg is null or (potassium_mg >= 0 and potassium_mg <= 20000))
  );

-- ----------------------------------------------------------------------------
-- 3. Refresh PostgREST schema cache
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
