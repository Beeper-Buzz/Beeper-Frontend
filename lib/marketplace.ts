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
