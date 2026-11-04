// Pure helpers for scripts/seed-spree.ts. Kept apart so they can be tested
// without the seed's env checks or network calls.
//
// Why: the seed used to match existing products on exact slug only. The v1
// API drops `slug` on create (not a permitted attribute), so a product created
// by hand under the same name but a different slug was not found, and the
// seed POSTed a duplicate (product 67, 2026-08-07). Matching now falls back to
// master SKU and then to the normalized name, and a non-slug match updates the
// existing product instead of creating one.

export interface ExistingProduct {
  id: number;
  name: string;
  slug: string;
  master?: { sku?: string | null } | null;
  sku?: string | null;
  taxon_ids?: number[] | null;
}

export interface SeedProductKey {
  name: string;
  slug: string;
  sku?: string;
}

export type MatchBy = "slug" | "sku" | "name";

export interface ProductMatch<P extends ExistingProduct = ExistingProduct> {
  product: P;
  by: MatchBy;
  /** Set when the match deserves a loud log line (not by slug, or ambiguous). */
  warning?: string;
}

/** Case-, accent-width- and punctuation-insensitive name key. */
export function normalizeName(name: string | null | undefined): string {
  return String(name || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐-―−\-_/|:;,.!?'"`()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const skuOf = (p: ExistingProduct): string =>
  String(p.master?.sku ?? p.sku ?? "").trim();

/**
 * Find the existing product a seed definition refers to: exact slug, then
 * master SKU, then normalized name. With several candidates the lowest id
 * (the original) wins and a warning is returned. Null means "create".
 */
export function findExistingProduct<P extends ExistingProduct>(
  def: SeedProductKey,
  existing: P[]
): ProductMatch<P> | null {
  const bySlug = existing.find((p) => p.slug === def.slug);
  if (bySlug) return { product: bySlug, by: "slug" };

  const pick = (list: P[], by: MatchBy, what: string): ProductMatch<P> => {
    const sorted = [...list].sort((a, b) => a.id - b.id);
    const product = sorted[0];
    const others = sorted.slice(1).map((p) => `${p.id} (${p.slug})`);
    const warning =
      `matched "${def.name}" by ${what}, not slug: ` +
      `existing id=${product.id} slug="${product.slug}", seed slug="${def.slug}"` +
      (others.length
        ? `. ${others.length + 1} products match; also ${others.join(", ")}. ` +
          `Updating the lowest id only; resolve the duplicates in the admin.`
        : "");
    return { product, by, warning };
  };

  const sku = (def.sku || "").trim();
  if (sku) {
    const bySku = existing.filter((p) => skuOf(p) === sku);
    if (bySku.length) return pick(bySku, "sku", `master SKU "${sku}"`);
  }

  const key = normalizeName(def.name);
  if (key) {
    const byName = existing.filter((p) => normalizeName(p.name) === key);
    if (byName.length) return pick(byName, "name", "name");
  }

  return null;
}

/**
 * v1 list path for the products the seed matches against. The admin product
 * scope drops discontinued products unless `show_discontinued` is set, and a
 * discontinued product still holds its slug: without it, discontinuing a
 * seeded product (say the reservation, once pre-orders close) would make the
 * next run create a second one under a UUID slug. Soft-deleted products stay
 * out: Spree frees their slug on delete.
 */
export const existingProductsPath = (page: number, perPage: number): string =>
  `/products?page=${page}&per_page=${perPage}&show_discontinued=true`;

export interface V1Page<T> {
  products: T[];
  pages?: number;
  current_page?: number;
  count?: number;
  total_count?: number;
}

/**
 * Collect every page of a Spree v1 list. Stops on the reported page count, on
 * an empty or short page, or after maxPages as a guard against a server that
 * never reports the end.
 */
export async function collectAllPages<T>(
  fetchPage: (page: number, perPage: number) => Promise<V1Page<T>>,
  perPage = 100,
  maxPages = 100
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchPage(page, perPage);
    const items = res.products || [];
    all.push(...items);
    if (typeof res.pages === "number") {
      if (page >= res.pages) break;
    } else if (items.length < perPage) {
      break;
    }
    if (items.length === 0) break;
  }
  return all;
}

/**
 * Taxon ids to PUT so the product has every seeded taxon, keeping any added by
 * hand. Null when nothing is missing (no request needed).
 */
export function mergeTaxonIds(
  current: number[] | null | undefined,
  wanted: number[]
): number[] | null {
  const have = new Set(current || []);
  const missing = wanted.filter((id) => !have.has(id));
  if (!missing.length) return null;
  return [...(current || []), ...missing];
}
