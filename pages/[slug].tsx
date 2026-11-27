import { GetServerSideProps } from "next";
import { QueryClient } from "react-query";
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
import { fetchQuestions, questionsKey } from "../hooks/useQuestions";
import {
  QUESTIONS_PER_PAGE,
  REVIEWS_ENABLED,
  REVIEWS_PER_PAGE
} from "../lib/reviews";
import { dehydrateForProps, seedAnonymousUser, withTimeout } from "../lib/ssr";

interface SlugPageProps {
  type: "product" | "profile" | "unavailable";
  slug: string;
  dehydratedState?: unknown;
}

/**
 * With reviews on, the PDP is server-rendered: the product, the retail review
 * summary, the first page of retail reviews and the first page of answered
 * questions go into the React Query cache, so the stars, the visible reviews,
 * the Questions tab and the product JSON-LD are in the HTML.
 * Each fetch is best-effort (a failure or timeout leaves that query to the
 * browser, as before) and nothing is cached between requests. With reviews
 * off, nothing changes: the page fetches the product on the client.
 */
const prefetchProductPage = async (slug: string): Promise<unknown> => {
  const queryClient = new QueryClient();

  // Without a seeded "auth-user" the AuthProvider never renders the PDP (see lib/ssr.ts).
  seedAnonymousUser(queryClient);

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
      .catch(() => undefined),
    // First page of answered questions, for the Questions tab (and its count).
    withTimeout((signal) =>
      fetchQuestions(slug, 1, { signal, perPage: QUESTIONS_PER_PAGE })
    )
      .then((firstPage) =>
        queryClient.setQueryData(questionsKey(slug), {
          pages: [firstPage],
          pageParams: [1]
        })
      )
      .catch(() => undefined)
  ]);

  return dehydrateForProps(queryClient);
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
