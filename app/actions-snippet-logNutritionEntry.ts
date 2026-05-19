// ============================================================================
// PHASE 15F: Replacement for `logNutritionEntry` in app/actions.ts
//
// HOW TO APPLY:
//
// 1. Open app/actions.ts
// 2. Find the existing `logNutritionEntry` function (search for
//    "export async function logNutritionEntry")
// 3. Replace the ENTIRE function (from the `/**` JSDoc above it through the
//    closing `}` of the function body) with the version below.
//
// No other changes to app/actions.ts are needed for Phase 15f.
//
// Why a snippet and not a full file replacement: app/actions.ts is 3000+ lines
// across many phases. Replacing the whole file would risk clobbering changes
// you've shipped between Phase 15e and now. This surgical edit only touches
// what 15f needs.
// ============================================================================

/**
 * Log a food intake entry. Household-only.
 *
 * Required form fields:
 *   - student_id
 *   - name (non-empty)
 *   - calories (non-negative integer)
 * Optional:
 *   - occurred_at (ISO timestamp; defaults to now)
 *   - Phase 15f macro fields (all numeric, all optional):
 *     - protein_g, carbs_g, fat_g, fiber_g, sodium_mg
 *     - iron_mg, calcium_mg, vitamin_d_mcg, potassium_mg
 *     Empty / missing = NULL in DB. Sanity bounds enforced both here and at
 *     the DB level via the nutrition_macros_sane / nutrition_micros_sane
 *     constraints from migration 0028.
 */
export async function logNutritionEntry(formData: FormData): Promise<{
  ok: boolean; id?: string; error?: string;
}> {
  const profile = await requireProfile();
  const supabase = createClient();

  const student_id = String(formData.get('student_id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const calories_str = String(formData.get('calories') ?? '').trim();
  const occurred_at_raw = String(formData.get('occurred_at') ?? '').trim();

  if (!student_id) return { ok: false, error: 'Missing student.' };
  if (!name) return { ok: false, error: 'Enter what you ate.' };
  if (!calories_str) return { ok: false, error: 'Enter the calorie count.' };

  const calories = parseInt(calories_str, 10);
  if (!Number.isFinite(calories) || calories < 0) {
    return { ok: false, error: 'Calories must be a non-negative number.' };
  }
  if (calories > 10000) {
    return { ok: false, error: 'That looks too high for a single item — please re-check.' };
  }
  if (name.length > 200) {
    return { ok: false, error: 'Name is too long.' };
  }

  // ---- Phase 15f: macro + micro fields (all optional, all nullable) ----
  // Helper for parsing optional non-negative numeric form fields. Returns
  // null when the field is empty/missing. Validates bounds and returns an
  // error if a provided value is outside the sane range.
  const parseOpt = (
    key: string,
    label: string,
    min: number,
    max: number,
  ): { value: number | null; error?: string } => {
    const raw = String(formData.get(key) ?? '').trim();
    if (!raw) return { value: null };
    const v = parseFloat(raw);
    if (!Number.isFinite(v) || v < min || v > max) {
      return { value: null, error: `${label} must be between ${min} and ${max}.` };
    }
    return { value: v };
  };

  const protein = parseOpt('protein_g', 'Protein (g)', 0, 500);
  const carbs = parseOpt('carbs_g', 'Carbs (g)', 0, 1000);
  const fat = parseOpt('fat_g', 'Fat (g)', 0, 500);
  const fiber = parseOpt('fiber_g', 'Fiber (g)', 0, 200);
  const sodium = parseOpt('sodium_mg', 'Sodium (mg)', 0, 20000);
  const iron = parseOpt('iron_mg', 'Iron (mg)', 0, 100);
  const calcium = parseOpt('calcium_mg', 'Calcium (mg)', 0, 5000);
  const vitD = parseOpt('vitamin_d_mcg', 'Vitamin D (mcg)', 0, 1000);
  const potassium = parseOpt('potassium_mg', 'Potassium (mg)', 0, 20000);

  for (const r of [protein, carbs, fat, fiber, sodium, iron, calcium, vitD, potassium]) {
    if (r.error) return { ok: false, error: r.error };
  }

  const occurred_at = occurred_at_raw || new Date().toISOString();

  const { data: canView } = await (supabase.rpc as Any)('can_view_student', { sid: student_id });
  if (!canView) {
    return { ok: false, error: "You don't have permission to log entries for this student." };
  }

  const { data, error } = await (supabase.from('nutrition_entries') as Any).insert({
    student_id, name, calories, occurred_at, logged_by: profile.id,
    protein_g: protein.value,
    carbs_g: carbs.value,
    fat_g: fat.value,
    fiber_g: fiber.value,
    sodium_mg: sodium.value,
    iron_mg: iron.value,
    calcium_mg: calcium.value,
    vitamin_d_mcg: vitD.value,
    potassium_mg: potassium.value,
  }).select('id').single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/nutrition');
  revalidatePath(`/dashboard/family/${student_id}/nutrition`);
  return { ok: true, id: (data as { id: string }).id };
}
