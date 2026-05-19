/**
 * Open Food Facts lookup helper.
 *
 * - Endpoint: world.openfoodfacts.org/api/v2/product/{barcode}.json
 * - No auth required for reads
 * - Sends a custom User-Agent identifying MESA
 * - In-memory cache for the session (Q3 = B from Phase 15c)
 * - Always called client-side from the browser (Q8 = A)
 *
 * Phase 15f: now extracts macros + micros in addition to calories. The fields
 * come back as null when OFF doesn't have them for that product (very common
 * for whole foods and crowdsourced entries with sparse data). NULLs propagate
 * through to the database — the UI displays "—" for missing values.
 *
 * Return shape — designed to be friendly to the confirm-before-save UI:
 *   - `not_found`: status 0 from OFF, or 404 from the server
 *   - `partial`:   product found but no usable calorie data — caller falls
 *                  through to manual entry, optionally with the product_name
 *   - `found`:     product + calorie data ready to populate the log form.
 *                  May also include macros/micros (any field may be null).
 *
 * The caller is expected to handle network errors (rejection) by falling
 * back to manual entry as well.
 */

/**
 * Macros and micros extracted from an Open Food Facts entry, normalized to
 * MESA's storage units. Any field can be null when OFF has no data for it.
 *
 * Units (matching DB columns):
 *   - protein_g, carbs_g, fat_g, fiber_g: grams
 *   - sodium_mg: milligrams (note: OFF stores in grams; we convert)
 *   - iron_mg, calcium_mg, potassium_mg: milligrams
 *   - vitamin_d_mcg: micrograms (note: OFF stores in grams; we convert)
 */
export interface OffNutrients {
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
  iron_mg: number | null;
  calcium_mg: number | null;
  vitamin_d_mcg: number | null;
  potassium_mg: number | null;
}

export type OffLookupResult =
  | { kind: 'found'; name: string; calories: number; per: 'serving' | '100g'; nutrients: OffNutrients }
  | { kind: 'partial'; name: string }
  | { kind: 'not_found' };

const cache = new Map<string, OffLookupResult>();

interface OffNutriments {
  // calories (kcal)
  'energy-kcal_serving'?: number;
  'energy-kcal_100g'?: number;
  'energy-kcal'?: number;
  // macros — proteins/carbohydrates/fat/fiber in grams
  proteins_serving?: number;
  proteins_100g?: number;
  carbohydrates_serving?: number;
  carbohydrates_100g?: number;
  fat_serving?: number;
  fat_100g?: number;
  fiber_serving?: number;
  fiber_100g?: number;
  // sodium — OFF stores in grams
  sodium_serving?: number;
  sodium_100g?: number;
  // micros — OFF stores in grams (yes, even for tiny amounts)
  iron_serving?: number;
  iron_100g?: number;
  calcium_serving?: number;
  calcium_100g?: number;
  'vitamin-d_serving'?: number;
  'vitamin-d_100g'?: number;
  potassium_serving?: number;
  potassium_100g?: number;
}

interface OffProductResponse {
  status: 0 | 1;
  product?: {
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    nutriments?: OffNutriments;
  };
}

/**
 * Look up a barcode against Open Food Facts. Resolves to a OffLookupResult
 * describing how usable the response is. Throws only on network errors —
 * "not found" returns normally.
 */
export async function lookupBarcode(barcode: string): Promise<OffLookupResult> {
  const cleaned = barcode.replace(/\s+/g, '').trim();
  if (!cleaned) return { kind: 'not_found' };

  const cached = cache.get(cleaned);
  if (cached) return cached;

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleaned)}.json?fields=product_name,product_name_en,brands,nutriments`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      // OFF asks for a custom User-Agent. Browsers may strip this; harmless if so.
      'User-Agent': 'MESA-Hockey-Academy/1.0 (https://mesa-v2-five.vercel.app)',
    },
  });

  if (res.status === 404) {
    const result: OffLookupResult = { kind: 'not_found' };
    cache.set(cleaned, result);
    return result;
  }
  if (!res.ok) {
    // Treat other server errors as "not found" so the UI degrades to manual entry.
    return { kind: 'not_found' };
  }

  const json = (await res.json()) as OffProductResponse;

  if (json.status !== 1 || !json.product) {
    const result: OffLookupResult = { kind: 'not_found' };
    cache.set(cleaned, result);
    return result;
  }

  // Best name: brand + product_name when brand exists and isn't already in the name
  const productName = json.product.product_name_en ?? json.product.product_name ?? '';
  const brand = (json.product.brands ?? '').split(',')[0]?.trim() ?? '';
  let displayName = productName.trim();
  if (brand && !displayName.toLowerCase().includes(brand.toLowerCase())) {
    displayName = displayName ? `${brand} ${displayName}` : brand;
  }
  if (!displayName) displayName = 'Unknown product';

  const nutr = json.product.nutriments ?? {};
  const serving = nutr['energy-kcal_serving'];
  const per100 = nutr['energy-kcal_100g'] ?? nutr['energy-kcal'];

  // Decide which "per" basis to use for ALL fields (calories + macros + micros).
  // Prefer per-serving when available; macros/micros use the same basis.
  if (typeof serving === 'number' && Number.isFinite(serving) && serving >= 0) {
    const result: OffLookupResult = {
      kind: 'found',
      name: displayName,
      calories: Math.round(serving),
      per: 'serving',
      nutrients: _extractNutrients(nutr, 'serving'),
    };
    cache.set(cleaned, result);
    return result;
  }

  if (typeof per100 === 'number' && Number.isFinite(per100) && per100 >= 0) {
    const result: OffLookupResult = {
      kind: 'found',
      name: displayName,
      calories: Math.round(per100),
      per: '100g',
      nutrients: _extractNutrients(nutr, '100g'),
    };
    cache.set(cleaned, result);
    return result;
  }

  // Product found but no calorie data — Q1 = A: fall through to manual entry
  // with the product name pre-filled.
  const result: OffLookupResult = { kind: 'partial', name: displayName };
  cache.set(cleaned, result);
  return result;
}

// ============================================================================
// Phase 15d: text search (used for autocomplete fallback)
// Phase 15f: also extracts macros + micros per result.
// ============================================================================

export type OffSearchResult = {
  name: string;
  calories: number | null;
  per: 'serving' | '100g' | null;
  /** Same-basis macros/micros as the calorie reading. Null fields are common. */
  nutrients: OffNutrients;
};

const searchCache = new Map<string, OffSearchResult[]>();

/**
 * Search Open Food Facts by free-text. Used by the autocomplete fallback
 * when the player's history has no matches for their query.
 *
 * Behavior:
 *   - Returns up to `limit` results (default 5)
 *   - Filters out products with no calorie data at all
 *   - In-memory cache keyed by query (case-insensitive)
 *   - Returns [] on network errors (UI degrades gracefully)
 */
export async function searchByText(query: string, limit = 5): Promise<OffSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const cached = searchCache.get(`${q}|${limit}`);
  if (cached) return cached;

  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&page_size=${limit}&fields=product_name,product_name_en,brands,nutriments`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'MESA-Hockey-Academy/1.0 (https://mesa-v2-five.vercel.app)',
      },
    });
  } catch {
    return [];
  }

  if (!res.ok) return [];

  let json: { products?: Array<{
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    nutriments?: OffNutriments;
  }> };
  try {
    json = await res.json();
  } catch {
    return [];
  }

  const products = json.products ?? [];

  const out: OffSearchResult[] = [];
  for (const p of products) {
    const productName = p.product_name_en ?? p.product_name ?? '';
    const brand = (p.brands ?? '').split(',')[0]?.trim() ?? '';
    let displayName = productName.trim();
    if (brand && !displayName.toLowerCase().includes(brand.toLowerCase())) {
      displayName = displayName ? `${brand} ${displayName}` : brand;
    }
    if (!displayName) continue;

    const nutr = p.nutriments ?? {};
    const serving = nutr['energy-kcal_serving'];
    const per100 = nutr['energy-kcal_100g'] ?? nutr['energy-kcal'];

    let calories: number | null = null;
    let per: 'serving' | '100g' | null = null;
    let nutrients: OffNutrients;
    if (typeof serving === 'number' && Number.isFinite(serving) && serving >= 0) {
      calories = Math.round(serving);
      per = 'serving';
      nutrients = _extractNutrients(nutr, 'serving');
    } else if (typeof per100 === 'number' && Number.isFinite(per100) && per100 >= 0) {
      calories = Math.round(per100);
      per = '100g';
      nutrients = _extractNutrients(nutr, '100g');
    } else {
      // Skip products with no usable calorie data — autocomplete is meant to be
      // tap-and-fill, so a result with no calorie value isn't useful here.
      continue;
    }

    out.push({ name: displayName, calories, per, nutrients });
    if (out.length >= limit) break;
  }

  searchCache.set(`${q}|${limit}`, out);
  return out;
}

// ============================================================================
// Helpers — Phase 15f
// ============================================================================

/**
 * Pull a single numeric nutrient from the OFF nutriments object. Tries the
 * preferred basis first (serving or 100g), no fallback to the other basis —
 * we want all macros/micros consistent with the calorie reading. Returns
 * null when the value is missing, non-numeric, or negative.
 */
function _readNum(
  nutr: OffNutriments,
  key: string,
  basis: 'serving' | '100g',
): number | null {
  // Type assertion to a Record so we can dynamically index — type-safe lookups
  // would require enumerating every key with both bases, which is tedious.
  const rec = nutr as unknown as Record<string, number | undefined>;
  const fieldKey = `${key}_${basis}`;
  const v = rec[fieldKey];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  return v;
}

/**
 * Round to a given decimal place. Returns null when input is null.
 */
function _round(v: number | null, decimals: number): number | null {
  if (v === null) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

/**
 * Extract all known nutrients for the given basis (serving or 100g), with
 * unit conversions to match MESA's DB columns.
 *
 * Unit conversion notes:
 *   - Macros (proteins/carbohydrates/fat/fiber): OFF stores in grams. No conversion.
 *   - Sodium: OFF stores in grams. We store in mg. Multiply by 1000.
 *   - Iron, calcium, potassium: OFF stores in grams. We store in mg. Multiply by 1000.
 *   - Vitamin D: OFF stores in grams. We store in mcg (micrograms). Multiply by 1,000,000.
 *
 * Why these conversions: the OFF storage convention is to use grams as the
 * base unit for nutriment density even for micronutrients. Real human-readable
 * values (and our DB) use mg/mcg for tiny amounts.
 */
function _extractNutrients(nutr: OffNutriments, basis: 'serving' | '100g'): OffNutrients {
  const proteins = _readNum(nutr, 'proteins', basis);
  const carbs = _readNum(nutr, 'carbohydrates', basis);
  const fat = _readNum(nutr, 'fat', basis);
  const fiber = _readNum(nutr, 'fiber', basis);
  const sodium_g = _readNum(nutr, 'sodium', basis);
  const iron_g = _readNum(nutr, 'iron', basis);
  const calcium_g = _readNum(nutr, 'calcium', basis);
  const vit_d_g = _readNum(nutr, 'vitamin-d', basis);
  const potassium_g = _readNum(nutr, 'potassium', basis);

  return {
    protein_g: _round(proteins, 1),
    carbs_g: _round(carbs, 1),
    fat_g: _round(fat, 1),
    fiber_g: _round(fiber, 1),
    sodium_mg: _round(sodium_g === null ? null : sodium_g * 1000, 0),
    iron_mg: _round(iron_g === null ? null : iron_g * 1000, 2),
    calcium_mg: _round(calcium_g === null ? null : calcium_g * 1000, 0),
    vitamin_d_mcg: _round(vit_d_g === null ? null : vit_d_g * 1_000_000, 1),
    potassium_mg: _round(potassium_g === null ? null : potassium_g * 1000, 0),
  };
}

/**
 * Empty nutrients object — used by callers (e.g. autocomplete history items
 * that lack macros) to produce a consistent type without leaving fields
 * undefined.
 */
export function emptyNutrients(): OffNutrients {
  return {
    protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, sodium_mg: null,
    iron_mg: null, calcium_mg: null, vitamin_d_mcg: null, potassium_mg: null,
  };
}
