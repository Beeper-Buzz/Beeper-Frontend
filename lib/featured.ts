// Featured products come from a Spree taxon (default `collections/featured`):
// membership and order are managed in the admin (Products → Taxons). Plain
// fetch, no storage/window access, so it runs in getStaticProps as well as in
// the browser. Any failure means "no featured": callers render nothing.

import { JsonApiResource } from "./productMedia";
import { requestWithVideosFallback } from "./spreeInclude";

export const DEFAULT_FEATURED_TAXON = "collections/featured";

export const FEATURED_INCLUDE =
  "images,variants,option_types,variants.option_values,product_properties";

export interface ProductsDoc {
  data: JsonApiResource[];
  included?: JsonApiResource[];
}

export const featuredTaxonPermalink = (): string =>
  (process.env.NEXT_PUBLIC_FEATURED_TAXON || "").trim() ||
  DEFAULT_FEATURED_TAXON;

type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  text?: () => Promise<string>;
}>;

export interface FetchFeaturedOptions {
  /** "" in the browser (same-origin rewrite), the Spree URL on the server. */
  baseUrl: string;
  permalink?: string;
  perPage?: number;
  fetchImpl?: FetchLike;
}

const HEADERS = { "Content-Type": "application/vnd.api+json" };

export async function fetchFeaturedProducts({
  baseUrl,
  permalink = featuredTaxonPermalink(),
  perPage = 12,
  fetchImpl
}: FetchFeaturedOptions): Promise<ProductsDoc | null> {
  const doFetch: FetchLike | undefined =
    fetchImpl ||
    (typeof fetch === "function" ? (fetch as unknown as FetchLike) : undefined);
  if (!doFetch) return null;
  const base = baseUrl.replace(/\/+$/, "");
  const path = permalink
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  if (!path) return null;

  try {
    const taxonRes = await doFetch(`${base}/api/v2/storefront/taxons/${path}`, {
      headers: HEADERS
    });
    if (!taxonRes.ok) return null;
    const taxonId = (await taxonRes.json())?.data?.id;
    // Never query without a real id: filter[taxons] with an unknown id
    // returns the whole catalog.
    if (!taxonId) return null;

    const doc = await requestWithVideosFallback<ProductsDoc>(
      FEATURED_INCLUDE,
      async (include) => {
        const url =
          `${base}/api/v2/storefront/products?filter[taxons]=${encodeURIComponent(
            String(taxonId)
          )}` + `&sort_by=default&per_page=${perPage}&include=${include}`;
        const res = await doFetch(url, { headers: HEADERS });
        if (!res.ok) {
          const body = res.text ? await res.text().catch(() => "") : "";
          throw Object.assign(new Error(body), { status: res.status });
        }
        return res.json();
      },
      (err: any) => ({ status: err?.status, message: err?.message })
    );

    if (!doc || !Array.isArray(doc.data) || doc.data.length === 0) return null;
    return { data: doc.data, included: doc.included || [] };
  } catch {
    return null;
  }
}
