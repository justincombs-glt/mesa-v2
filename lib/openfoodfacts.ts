/**
 * Open Food Facts lookup helper.
 *
 * - Endpoint: world.openfoodfacts.org/api/v2/product/{barcode}.json
 * - No auth required for reads
 * - Sends a custom User-Agent identifying MESA
 * - In-memory cache for the session (Q3 = B from Phase 15c)
 * - Always called client-side from the browser (Q8 = A)
 *
 * Return shape — designed to be friendly to the confirm-before-save UI:
 *   - `not_found`: status 0 from OFF, or 404 from the server
 *   - `partial`:   product found but no usable calorie data — caller falls
 *                  through to manual entry, optionally with the product_name
 *   - `found`:     product + calorie data ready to populate the log form
 *
 * The caller is expected to handle network errors (rejection) by falling
 * back to manual entry as well.
 */

export type OffLookupResult =
  | { kind: 'found'; name: string; calories: number; per: 'serving' | '100g' }
  | { kind: 'partial'; name: string }
  | { kind: 'not_found' };

const cache = new Map<string, OffLookupResult>();

interface OffProductResponse {
  status: 0 | 1;
  product?: {
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    nutriments?: {
      'energy-kcal_serving'?: number;
      'energy-kcal_100g'?: number;
      'energy-kcal'?: number;
    };
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

  if (typeof serving === 'number' && Number.isFinite(serving) && serving >= 0) {
    const result: OffLookupResult = {
      kind: 'found',
      name: displayName,
      calories: Math.round(serving),
      per: 'serving',
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
// ============================================================================

export type OffSearchResult = {
  name: string;
  calories: number | null;
  per: 'serving' | '100g' | null;
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
    nutriments?: {
      'energy-kcal_serving'?: number;
      'energy-kcal_100g'?: number;
      'energy-kcal'?: number;
    };
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
    if (typeof serving === 'number' && Number.isFinite(serving) && serving >= 0) {
      calories = Math.round(serving);
      per = 'serving';
    } else if (typeof per100 === 'number' && Number.isFinite(per100) && per100 >= 0) {
      calories = Math.round(per100);
      per = '100g';
    }

    // Skip products with no usable calorie data — autocomplete is meant to be
    // tap-and-fill, so a result with no calorie value isn't useful here.
    if (calories === null) continue;

    out.push({ name: displayName, calories, per });
    if (out.length >= limit) break;
  }

  searchCache.set(`${q}|${limit}`, out);
  return out;
}
