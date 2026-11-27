import { GetServerSideProps } from "next";
import { QueryClient } from "react-query";
import { dehydrate } from "react-query/hydration";
import { ProductDetails } from "../components/ProductDetails";
import { UserProfile } from "../components/UserProfile";
import { ServiceUnavailable } from "../components/404/ServiceUnavailable";
import { Layout } from "@components/Layout";
import { resolveSlug } from "../lib/slugRoute";
import { QueryKeys } from "../hooks/queryKeys";
import { fetchProduct } from "../hooks/useProduct";
import {
  fetchProductReviews,
  fetchReviewSummary,
  productReviewsKey,
  reviewSummaryKey
} from "../hooks/useReviews";
import { REVIEWS_ENABLED, REVIEWS_PER_PAGE } from "../lib/reviews";

interface SlugPageProps {
  type: "product" | "profile" | "unavailable";
  slug: string;
  dehydratedState?: unknown;
}

/** react-query-auth's default query key (config/auth.ts sets no `key`). */
const AUTH_USER_QUERY_KEY = "auth-user";

/** Server fetches give up after this long; the browser then fetches instead. */
const SSR_FETCH_TIMEOUT_MS = 2500;

const withTimeout = async <T,>(
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SSR_FETCH_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * With reviews on, the PDP is server-rendered: the product, the retail review
 * summary and the first page of retail reviews go into the React Query cache,
 * so the stars, the visible reviews and the product JSON-LD are in the HTML.
 * Each fetch is best-effort (a failure or timeout leaves that query to the
 * browser, as before) and nothing is cached between requests. With reviews
 * off, nothing changes: the page fetches the product on the client.
 */
const prefetchProductPage = async (slug: string): Promise<unknown> => {
  const queryClient = new QueryClient();

  // react-query-auth's AuthProvider renders "Loading..." instead of the page
  // until its "auth-user" query succeeds, so without this the server never
  // renders the PDP. Seed a signed-out user: the browser refetches it on mount
  // (the token lives in localStorage). `updatedAt: 1` makes it older than any
  // real fetch, so hydrating on client-side navigation never signs anyone out.
  queryClient.setQueryData(AUTH_USER_QUERY_KEY, null, { updatedAt: 1 });

  await Promise.all([
    withTimeout((signal) => fetchProduct(slug, { signal }))
      .then((product) =>
        queryClient.setQueryData([QueryKeys.PRODUCT, slug], product)
      )
      .catch(() => undefined),
    withTimeout((signal) =>
      fetchReviewSummary(slug, "retail", { auth: "none", signal })
    )
      .then((summary) =>
        queryClient.setQueryData(reviewSummaryKey(slug, "retail"), summary)
      )
      .catch(() => undefined),
    withTimeout((signal) =>
      fetchProductReviews(
        slug,
        { scope: "retail", page: 1, per_page: REVIEWS_PER_PAGE },
        { auth: "none", signal }
      )
    )
      .then((firstPage) =>
        queryClient.setQueryData(productReviewsKey(slug, { scope: "retail" }), {
          pages: [firstPage],
          pageParams: [1]
        })
      )
      .catch(() => undefined)
  ]);

  try {
    // Round-trip through JSON so `undefined` values can't break Next's prop serialization.
    return JSON.parse(JSON.stringify(dehydrate(queryClient)));
  } catch {
    return null;
  }
};

// Server-rendered per request, so nothing here is cached: a product published
// or hidden in the admin is right on the next request. Without reviews the
// props never carry product or profile data and the page fetches what was
// confirmed on the client; with reviews on, a product page also gets the
// product and its first reviews in `dehydratedState` (see prefetchProductPage).
export const getServerSideProps: GetServerSideProps<SlugPageProps> = async ({
  params,
  res
}) => {
  const slug = params?.slug as string;
  const resolved = await resolveSlug(slug || "", {
    baseUrl: process.env.NEXT_PUBLIC_SPREE_API_URL || "http://localhost:8080"
  });

  switch (resolved.kind) {
    case "product":
      if (!REVIEWS_ENABLED) return { props: { type: "product", slug } };
      return {
        props: {
          type: "product",
          slug,
          dehydratedState: await prefetchProductPage(slug)
        }
      };
    case "profile":
      res.setHeader("X-Robots-Tag", "noindex");
      return { props: { type: "profile", slug } };
    case "unavailable":
      // The API failed, so this may well exist. A 503 tells crawlers and caches
      // to come back, where a 404 could get a real page dropped.
      res.statusCode = 503;
      res.setHeader("Retry-After", "30");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex");
      return { props: { type: "unavailable", slug } };
    default:
      res.setHeader("X-Robots-Tag", "noindex");
      return { notFound: true };
  }
};

export default function SlugPage({ type, slug }: SlugPageProps) {
  if (type === "unavailable") {
    return (
      <Layout>
        <ServiceUnavailable />
      </Layout>
    );
  }

  if (type === "profile") {
    return (
      <Layout>
        <UserProfile username={slug} />
      </Layout>
    );
  }

  // Confirmed visible on the server; the client hook fetches it and renders
  // not-found itself if it's hidden in the meantime.
  return <ProductDetails props={{}} />;
}
