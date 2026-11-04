import { DynamicHome } from "../components/Home";
import type { HeroData } from "@components/Home/Hero";
import { FEED_CONFIGS, fetchProductFeed } from "@hooks/useProductFeed";
import { fetchHomepage, HomepageData } from "@hooks/useHomepage";
import { fetchFeaturedProducts } from "@lib/featured";
import { hasMsrp } from "@lib/productMedia";

// Which Spree product drives the hero price + CTA:
// 1. NEXT_PUBLIC_HERO_PRODUCT_SLUG, if set;
// 2. else the first product of the Featured taxon (order it in the admin
//    under Products -> Taxons -> Collections -> Featured);
// 3. else null, and Hero falls back to its static copy.
const HERO_PRODUCT_SLUG = (
  process.env.NEXT_PUBLIC_HERO_PRODUCT_SLUG || ""
).trim();

const SPREE_URL =
  process.env.NEXT_PUBLIC_SPREE_API_URL || "http://localhost:8080";

const heroFromAttributes = (slug: string, attrs: any): HeroData => ({
  slug,
  price: attrs.display_price ?? null,
  // Only a real MSRP: compare_at_price is 0.00 on some products.
  compareAtPrice: hasMsrp(attrs.price, attrs.compare_at_price)
    ? attrs.display_compare_at_price ?? null
    : null
});

async function fetchFeaturedHeroData(): Promise<HeroData | null> {
  // Only the first product's slug and prices are used.
  const featured = await fetchFeaturedProducts({
    baseUrl: SPREE_URL,
    perPage: 1
  });
  const attrs = featured?.data?.[0]?.attributes;
  if (!attrs?.slug) return null;
  return heroFromAttributes(attrs.slug, attrs);
}

// Server-safe price pull: plain fetch against the v2 storefront API. We do NOT
// reuse fetchProduct/fetchProductFeed here because they call storage.getToken(),
// which touches window.localStorage and throws in getStaticProps (which is why
// the feed fetches below are wrapped in .catch). Mirrors pages/[slug].tsx.
async function fetchHeroData(slug: string): Promise<HeroData | null> {
  const spreeUrl = SPREE_URL;
  try {
    const res = await fetch(
      `${spreeUrl}/api/v2/storefront/products?filter[slug]=${encodeURIComponent(
        slug
      )}`,
      { headers: { "Content-Type": "application/vnd.api+json" } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const attrs = json?.data?.[0]?.attributes;
    if (!attrs) return null;
    return heroFromAttributes(slug, attrs);
  } catch {
    return null;
  }
}

export async function getStaticProps() {
  try {
    const [feedData, homepageData, heroData] = await Promise.all([
      fetchProductFeed({ ...FEED_CONFIGS.latest, per_page: 8 }).catch(
        () => null
      ),
      fetchHomepage().catch(() => null),
      HERO_PRODUCT_SLUG
        ? fetchHeroData(HERO_PRODUCT_SLUG)
        : fetchFeaturedHeroData()
    ]);
    return {
      props: {
        initialProducts: feedData || null,
        initialHomepage: homepageData || null,
        heroData: heroData || null
      },
      revalidate: 60
    };
  } catch {
    return {
      props: {
        initialProducts: null,
        initialHomepage: null,
        heroData: null
      },
      revalidate: 60
    };
  }
}

export default function HomePage({
  initialProducts,
  initialHomepage,
  heroData
}: {
  initialProducts: any;
  initialHomepage: HomepageData | null;
  heroData: HeroData | null;
}) {
  return (
    <DynamicHome
      initialProducts={initialProducts}
      initialHomepage={initialHomepage}
      heroData={heroData}
    />
  );
}
