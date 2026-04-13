import { GetServerSideProps } from "next";
import { ProductDetails } from "../components/ProductDetails";
import { UserProfile } from "../components/UserProfile";
import { Layout } from "@components/Layout";

const RESERVED_SLUGS = [
  "cart",
  "checkout",
  "login",
  "signup",
  "account",
  "browse",
  "about",
  "terms",
  "privacy",
  "home",
  "reset-password",
  "thank-you",
  "update-email",
  "update-password",
  "api",
  "admin",
  "tv",
  "user",
  "images",
  "fonts",
  "static",
  "assets",
  "_next",
  "creator-application"
];

interface SlugPageProps {
  type: "product" | "profile";
  slug: string;
  productData?: any;
  profileData?: any;
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const slug = params?.slug as string;

  if (!slug || RESERVED_SLUGS.includes(slug)) {
    return { notFound: true };
  }

  // 1. Try product lookup by slug
  const spreeUrl =
    process.env.NEXT_PUBLIC_SPREE_API_URL || "http://localhost:8080";
  try {
    const productRes = await fetch(
      `${spreeUrl}/api/v2/storefront/products?filter[slug]=${encodeURIComponent(
        slug
      )}&include=images,variants,option_types`,
      { headers: { "Content-Type": "application/vnd.api+json" } }
    );
    if (productRes.ok) {
      const productData = await productRes.json();
      if (productData.data && productData.data.length > 0) {
        return {
          props: { type: "product", slug, productData }
        };
      }
    }
  } catch {
    // Product lookup failed, try profile
  }

  // 2. Try user profile by handle
  try {
    const profileRes = await fetch(
      `${spreeUrl}/api/v1/users/by_handle/${encodeURIComponent(slug.toLowerCase())}/profile`
    );
    if (profileRes.ok) {
      const profileJson = await profileRes.json();
      if (profileJson.response_data) {
        return {
          props: {
            type: "profile" as const,
            slug,
            profileData: profileJson.response_data
          }
        };
      }
    }
  } catch {
    // fall through to 404
  }

  // 3. Neither found — fall back to client-side product detail rendering
  // (lets ProductDetails handle its own loading/404 via useProduct hook)
  return {
    props: { type: "product", slug }
  };
};

export default function SlugPage({
  type,
  slug,
  productData,
  profileData
}: SlugPageProps) {
  if (type === "profile" && profileData) {
    return (
      <Layout>
        <UserProfile username={slug} />
      </Layout>
    );
  }

  // Default: render product details (client-side hook handles loading)
  return <ProductDetails props={{}} />;
}
