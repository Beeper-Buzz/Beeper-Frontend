import React from "react";
import Head from "next/head";
import type { GetStaticProps } from "next";
import { Layout } from "@components/Layout";
import {
  CREATOR_SECTIONS,
  MarketplaceShelf
} from "@components/Creators/sections";
import {
  fetchPageSections,
  numberOr,
  PageSection,
  toSections
} from "@lib/cms/pageSections";
import { fetchFeaturedProducts } from "@lib/featured";
import { marketplaceTaxonPermalink } from "@lib/marketplace";
import fallbackSections from "@data/cms/creators.json";

// /creators is built from the admin's Page Sections → Creators. Editors add,
// reorder, hide and rewrite sections there; ISR picks changes up within a
// minute. With no sections published (or the admin unreachable) the page uses
// data/cms/creators.json, the same copy `rake beeper:cms:seed_page` loads.

const PAGE_KEY = "creators";
const SPREE_URL =
  process.env.SPREE_API_URL ||
  process.env.NEXT_PUBLIC_SPREE_API_URL ||
  "http://localhost:8080";

interface CreatorsProps {
  sections: PageSection[];
  marketplace: MarketplaceShelf | null;
}

export const getStaticProps: GetStaticProps<CreatorsProps> = async () => {
  const sections =
    (await fetchPageSections(PAGE_KEY, { baseUrl: SPREE_URL })) ||
    toSections(fallbackSections);

  // Only look up products when a products section will show them.
  const shelf = sections.find((s) => s.section_type === "products");
  const doc = shelf
    ? await fetchFeaturedProducts({
        baseUrl: SPREE_URL,
        permalink: marketplaceTaxonPermalink(),
        perPage: Math.max(1, Math.min(12, numberOr(shelf.settings.limit, 8))),
        timeoutMs: 5000
      })
    : null;

  return {
    props: {
      sections,
      marketplace: doc?.data.length
        ? { data: doc.data, included: doc.included || [] }
        : null
    },
    revalidate: 60
  };
};

const stripTags = (html: string | null) =>
  (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const CreatorsPage: React.FC<CreatorsProps> = ({ sections, marketplace }) => {
  const hero = sections.find((s) => s.section_type === "hero");
  const description =
    hero?.settings.meta_description ||
    stripTags(hero?.content || null) ||
    "Sell sample packs, effect presets and visualizers that people play inside the Beeper app.";

  return (
    <Layout>
      <Head>
        <title>
          {hero?.settings.meta_title || "Sell on Beeper | Creators"}
        </title>
        <meta name="description" content={description} />
      </Head>
      <div className="section-container flex flex-col gap-20 py-12 sm:gap-28 sm:py-20">
        {sections.map((section) => {
          const Section = CREATOR_SECTIONS[section.section_type];
          return Section ? (
            <Section
              key={section.id}
              section={section}
              marketplace={marketplace}
            />
          ) : null;
        })}
      </div>
    </Layout>
  );
};

export default CreatorsPage;
