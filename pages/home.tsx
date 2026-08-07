import { DynamicHome } from "../components/Home";
import type { HeroData } from "@components/Home/Hero";
import { FEED_CONFIGS, fetchProductFeed } from "@hooks/useProductFeed";
import { fetchHomepage, HomepageData } from "@hooks/useHomepage";

// Which Spree product drives the hero price + CTA. Defaults to the pre-order
// reservation product, so the hero renders "reserve for $49 / $199.99 MSRP"
// and its CTA points at the buyable reservation. Override with
// NEXT_PUBLIC_HERO_PRODUCT_SLUG (e.g. back to "beeper-8") with no redeploy.
const HERO_PRODUCT_SLUG =
  process.env.NEXT_PUBLIC_HERO_PRODUCT_SLUG || "beeper-8-reservation";

// Server-safe price pull: plain fetch against the v2 storefront API. We do NOT
// reuse fetchProduct/fetchProductFeed here because they call storage.getToken(),
// which touches window.localStorage and throws in getStaticProps (which is why
// the feed fetches below are wrapped in .catch). Mirrors pages/[slug].tsx.
async function fetchHeroData(slug: string): Promise<HeroData | null> {
  const spreeUrl =
    process.env.NEXT_PUBLIC_SPREE_API_URL || "http://localhost:8080";
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
    return {
      slug,
      price: attrs.display_price ?? null,
      compareAtPrice: attrs.display_compare_at_price ?? null
    };
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
      fetchHeroData(HERO_PRODUCT_SLUG)
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
