import { useQuery } from "react-query";
import { QueryKeys } from "@hooks/queryKeys";
import { fetchFeaturedProducts, ProductsDoc } from "../../lib/featured";
import { marketplaceTaxonPermalink } from "../../lib/marketplace";
import { cartLineSlugs } from "../../lib/cartAvailability";
import { lookupProduct } from "../../lib/slugRoute";

const baseUrl = () =>
  typeof window !== "undefined"
    ? ""
    : process.env.NEXT_PUBLIC_SPREE_API_URL || "http://localhost:8080";

/**
 * Products in the Marketplace taxon (and its Sample Packs / Effects /
 * Visualizers children). Null when the taxon is missing, empty or failing.
 */
export const fetchMarketplaceProducts = (): Promise<ProductsDoc | null> =>
  fetchFeaturedProducts({
    baseUrl: baseUrl(),
    permalink: marketplaceTaxonPermalink(),
    perPage: 100
  });

export const useMarketplaceProducts = (enabled = true) =>
  useQuery<ProductsDoc | null>(
    [QueryKeys.MARKETPLACE_PRODUCTS, marketplaceTaxonPermalink()],
    fetchMarketplaceProducts,
    { enabled, staleTime: 60_000, retry: false }
  );

/**
 * Slugs of the cart's lines whose product is digital (`digital_kind` set),
 * from the same product endpoint the product page reads. Undefined until
 * known; a failed lookup counts as not digital (so delivery stays).
 */
export const useCartDigitalSlugs = (
  cart: Parameters<typeof cartLineSlugs>[0]
): string[] | undefined => {
  const slugs = cartLineSlugs(cart);
  const { data } = useQuery(
    [QueryKeys.CART, QueryKeys.CART_DIGITAL, slugs.join(",")],
    async () => {
      const found = await Promise.all(
        slugs.map(async (slug) => {
          const r = await lookupProduct(slug, { baseUrl: "" });
          return r.status === "visible" && r.attributes?.digital_kind
            ? slug
            : null;
        })
      );
      return found.filter((s): s is string => !!s);
    },
    { enabled: slugs.length > 0, staleTime: 60_000, retry: false }
  );
  return slugs.length === 0 ? [] : data;
};

export interface MarketplaceTaxon {
  id: number;
  name: string;
  permalink: string;
}

/** The Marketplace taxon's children (Sample Packs, Effects, Visualizers). */
export const useMarketplaceTaxons = () =>
  useQuery<MarketplaceTaxon[]>(
    [QueryKeys.MARKETPLACE_PRODUCTS, "taxons", marketplaceTaxonPermalink()],
    async () => {
      const path = marketplaceTaxonPermalink()
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      const res = await fetch(
        `/api/v2/storefront/taxons/${path}?include=children`,
        { headers: { "Content-Type": "application/vnd.api+json" } }
      );
      if (!res.ok) throw new Error(`taxons ${res.status}`);
      const doc = await res.json();
      return ((doc?.included || []) as any[])
        .filter((t) => t?.type === "taxon")
        .map((t) => ({
          id: Number(t.id),
          name: String(t.attributes?.name || ""),
          permalink: String(t.attributes?.permalink || "")
        }));
    },
    { staleTime: 10 * 60_000, retry: false }
  );
