// Marketplace products are ordinary Spree products in the Marketplace taxon.
// The storefront v2 serializer adds `digital_kind` (the live asset's kind, or
// null) and `creator` ({ handle, name } or null) to their attributes.

export type DigitalKind = "sample_pack" | "effect_preset" | "visualizer";

export const DIGITAL_KINDS: DigitalKind[] = [
  "sample_pack",
  "effect_preset",
  "visualizer"
];

const LABELS: Record<DigitalKind, { one: string; many: string }> = {
  sample_pack: { one: "Sample pack", many: "Sample packs" },
  effect_preset: { one: "Effect preset", many: "Effects" },
  visualizer: { one: "Visualizer", many: "Visualizers" }
};

export const kindLabel = (k: DigitalKind, plural = false): string =>
  plural ? LABELS[k].many : LABELS[k].one;

export const isDigitalKind = (v: unknown): v is DigitalKind =>
  typeof v === "string" && (DIGITAL_KINDS as string[]).includes(v);

type ProductLike = { attributes?: Record<string, any> } | null | undefined;

export const digitalKindOf = (p: ProductLike): DigitalKind | null => {
  const k = p?.attributes?.digital_kind;
  return isDigitalKind(k) ? k : null;
};

export interface CreatorRef {
  handle: string;
  name: string;
}

export const creatorOf = (p: ProductLike): CreatorRef | null => {
  const c = p?.attributes?.creator;
  if (!c || typeof c !== "object" || typeof c.handle !== "string" || !c.handle)
    return null;
  return { handle: c.handle, name: String(c.name || c.handle) };
};

/** The Marketplace taxon permalink (backend default `marketplace`). */
export const marketplaceTaxonPermalink = (): string =>
  (process.env.NEXT_PUBLIC_MARKETPLACE_TAXON || "").trim() || "marketplace";

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export type MarketplaceSort =
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc"
  | "newest";

export interface MarketplaceFilter {
  kinds: DigitalKind[];
  search: string;
  sort: string;
}

const priceOf = (p: ProductLike) =>
  parseFloat(p?.attributes?.price || "0") || 0;
const nameOf = (p: ProductLike) => String(p?.attributes?.name || "");

/**
 * Browse's marketplace grid: products with a known digital kind, narrowed by
 * kind chips and a search over the name, slug and creator, then sorted.
 */
export function filterMarketplace<
  T extends { attributes?: Record<string, any> }
>(products: T[], { kinds, search, sort }: MarketplaceFilter): T[] {
  const s = search.trim().toLowerCase();
  const out = products.filter((p) => {
    const kind = digitalKindOf(p);
    if (!kind) return false;
    if (kinds.length > 0 && !kinds.includes(kind)) return false;
    if (!s) return true;
    const creator = creatorOf(p);
    return [nameOf(p), p.attributes?.slug, creator?.name, creator?.handle]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(s));
  });
  const by: Record<MarketplaceSort, (a: T, b: T) => number> = {
    name_asc: (a, b) => nameOf(a).localeCompare(nameOf(b)),
    name_desc: (a, b) => nameOf(b).localeCompare(nameOf(a)),
    price_asc: (a, b) => priceOf(a) - priceOf(b),
    price_desc: (a, b) => priceOf(b) - priceOf(a),
    newest: (a, b) =>
      new Date(b.attributes?.created_at || 0).getTime() -
      new Date(a.attributes?.created_at || 0).getTime()
  };
  return out.sort(by[sort as MarketplaceSort] || by.name_asc);
}
