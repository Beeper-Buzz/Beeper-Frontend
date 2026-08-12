import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Layout } from "../../components/Layout";

// Slug of the Spree page (spree_static_content) that backs this route. When an
// editor publishes a page with this slug in the admin, its title/body replace
// the static copy below — no redeploy. Override with NEXT_PUBLIC_ABOUT_PAGE_SLUG.
const ABOUT_PAGE_SLUG = process.env.NEXT_PUBLIC_ABOUT_PAGE_SLUG || "about";

const COMPANY_NAME = process.env.NEXT_PUBLIC_SITE_TITLE || "Beeper";
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_EMAIL || "hey@beeper.buzz";

interface CmsPage {
  title: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
}

interface AboutProps {
  page: CmsPage | null;
}

// Server-safe fetch against the admin's v1 pages endpoint. Deliberately a plain
// fetch (not the `hooks/` helpers) because those touch window.localStorage and
// throw in getStaticProps — same reasoning as fetchHeroData in pages/home.tsx.
// Any failure (endpoint missing, page unpublished, admin down) falls through to
// the static copy below, so /about never depends on Spree being reachable.
async function fetchCmsPage(slug: string): Promise<CmsPage | null> {
  const spreeUrl =
    process.env.SPREE_API_URL ||
    process.env.NEXT_PUBLIC_SPREE_API_URL ||
    "http://localhost:8080";
  try {
    const res = await fetch(
      `${spreeUrl}/api/v1/pages/${encodeURIComponent(slug)}`,
      { headers: { "Content-Type": "application/json" } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.response_data;
    if (!data?.body || data.visible === false) return null;
    return {
      title: data.title || "",
      body: data.body,
      metaTitle: data.meta_title || data.title || "",
      metaDescription: data.meta_description || ""
    };
  } catch {
    return null;
  }
}

export async function getStaticProps() {
  const page = await fetchCmsPage(ABOUT_PAGE_SLUG);
  return {
    props: { page },
    revalidate: 60
  };
}

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({
  children
}) => (
  <h2 className="neon-text-cyan mb-6 font-pressstart text-sm leading-relaxed sm:text-base">
    {children}
  </h2>
);

const Values = [
  {
    title: "EXPRESSION FIRST",
    copy: "Velocity, pressure and touch should feel like part of your hands, not a menu setting. Every pad and slider on Beeper is built to respond the way a player expects."
  },
  {
    title: "POCKETABLE",
    copy: "An instrument you leave at home is an instrument you don't play. Beeper is slim enough to travel with and wireless enough to use anywhere."
  },
  {
    title: "OPEN BY DEFAULT",
    copy: "Standard BLE MIDI, no walled garden. Beeper works with the DAW, app or synth you already use, and the companion app extends it rather than locking it down."
  }
];

const About: React.FC<AboutProps> = ({ page }) => {
  const pageTitle = page?.metaTitle || `About ${COMPANY_NAME}`;

  return (
    <Layout>
      <Head>
        <title>{pageTitle}</title>
        {page?.metaDescription && (
          <meta name="description" content={page.metaDescription} />
        )}
      </Head>

      <div className="section-container flex flex-col items-center py-16 sm:py-24">
        {page ? (
          // Admin-authored content wins when a page with this slug is published.
          <article className="w-full max-w-3xl">
            {page.title && (
              <h1 className="neon-text-magenta mb-10 text-center font-pressstart text-lg leading-relaxed sm:text-xl">
                {page.title}
              </h1>
            )}
            <div
              className="cms-body font-title text-sm leading-relaxed text-gray-400"
              dangerouslySetInnerHTML={{ __html: page.body }}
            />
          </article>
        ) : (
          <div className="w-full max-w-3xl">
            <h1 className="neon-text-magenta mb-12 text-center font-pressstart text-lg leading-relaxed sm:text-xl">
              ABOUT {COMPANY_NAME.toUpperCase()}
            </h1>

            <section className="mb-14">
              <SectionHeading>WHO WE ARE</SectionHeading>
              <p className="font-title text-sm leading-relaxed text-gray-400">
                Beeper is built by Material Instinct, a small hardware and
                software studio making instruments for people who want to play
                anywhere. We design the device, the firmware and the companion
                app in-house, so the whole thing behaves like one instrument
                rather than a gadget with an app bolted on.
              </p>
            </section>

            <section className="mb-14">
              <SectionHeading>OUR MISSION</SectionHeading>
              <p className="font-title text-sm leading-relaxed text-gray-400">
                Play with music, anywhere. Beeper &Delta;8 packs 8 force-sensing
                pads, two capacitive sliders, an AMOLED display and a MEMS mic
                into a slim, wireless body that speaks BLE MIDI to whatever you
                already make music with &mdash; no cables, no laptop required.
              </p>
            </section>

            <section className="mb-14">
              <SectionHeading>OUR VALUES</SectionHeading>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {Values.map((value) => (
                  <div
                    key={value.title}
                    className="glass-panel rounded-lg p-5"
                  >
                    <div className="mb-3 font-pressstart text-[10px] leading-4 text-neon-cyan">
                      {value.title}
                    </div>
                    <p className="font-title text-xs leading-relaxed text-gray-400">
                      {value.copy}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionHeading>GET IN TOUCH</SectionHeading>
              <p className="font-title text-sm leading-relaxed text-gray-400">
                Questions, press, or partnership ideas &mdash; reach us at{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-neon-cyan no-underline transition-opacity hover:opacity-80"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
              <div className="mt-8">
                <Link href="/" className="neon-btn inline-block">
                  BACK HOME
                </Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default About;
