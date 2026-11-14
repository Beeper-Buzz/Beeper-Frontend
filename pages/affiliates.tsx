import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Layout } from "../components/Layout";
import { useAuth } from "@config/auth";
import { CONTACT_EMAIL, SITE_TITLE } from "@utilities/branding";
import { formatBps } from "@lib/affiliate/stats";
import {
  DEFAULT_COMMISSION_BPS,
  DEFAULT_COOKIE_DAYS,
  HOLD_DAYS
} from "@lib/affiliate/terms";

const RATE = formatBps(DEFAULT_COMMISSION_BPS);
// Michroma draws "%" as a ligature-like glyph; spell it out in display type.
const RATE_WORDS = RATE.replace("%", " percent");
const APPLY_PATH = "/account/affiliate";

const STEPS = [
  {
    title: "Apply",
    copy: "Tell us where you make things and who watches. We read every application."
  },
  {
    title: "Share your link",
    copy: "Pick a code, link any page on the shop, or print the QR code for a gig or a workshop."
  },
  {
    title: "Earn on orders",
    copy: `Anyone who buys within ${DEFAULT_COOKIE_DAYS} days of clicking your link earns you ${RATE} of the order.`
  },
  {
    title: "Get paid",
    copy: `After a ${HOLD_DAYS}-day hold for returns, the commission is approved and paid to your payout email.`
  }
];

const FACTS = [
  { value: RATE, label: "of every order you send us" },
  {
    value: `${DEFAULT_COOKIE_DAYS} days`,
    label: "for a click to turn into an order"
  },
  { value: `${HOLD_DAYS} days`, label: "until a commission is approved" }
];

const FAQ = [
  {
    q: "Who can apply?",
    a: "Anyone with a Beeper account and an audience who'd care: producers, YouTubers, teachers, music shops, podcasters, community organizers."
  },
  {
    q: "What counts toward my commission?",
    a: "The item total after discounts. Shipping and tax don't count, and neither do your own orders."
  },
  {
    q: "What if someone clicks two affiliate links?",
    a: "The most recent link gets the order."
  },
  {
    q: "What do I see about buyers?",
    a: "The last four characters of each order number and the amounts. Never names or email addresses."
  }
];

const AffiliatesPage = () => {
  const { user } = useAuth();
  const ctaHref = user
    ? APPLY_PATH
    : `/login?redirect=${encodeURIComponent(APPLY_PATH)}`;
  const ctaLabel = user ? "Apply or open your dashboard" : "Sign in to apply";

  return (
    <Layout>
      <Head>
        <title>{`Affiliate program | ${SITE_TITLE}`}</title>
        <meta
          name="description"
          content={`Share ${SITE_TITLE} and earn ${RATE} on every order placed through your link.`}
        />
      </Head>

      <div className="section-container py-14 sm:py-20">
        {/* Hero: the thing an affiliate actually gets, a link. */}
        <section className="mx-auto max-w-3xl">
          <h1 className="m-0 font-michroma text-[26px] leading-[1.25] text-white sm:text-[40px]">
            Share {SITE_TITLE}. Earn {RATE_WORDS} of every order.
          </h1>
          <p className="mb-0 mt-5 max-w-[60ch] font-body-bold text-base leading-7 text-white/70">
            The affiliate program pays you for the people you send our way. You
            get a link with your own code, live stats on clicks and orders, and
            a commission on everything they buy.
          </p>

          <div
            className="mt-8 rounded-lg border border-neon-cyan/35 bg-black/50 px-4 py-3.5 shadow-[0_0_24px_rgba(0,255,255,0.08),inset_0_0_14px_rgba(0,255,255,0.06)]"
            aria-label="Example affiliate link"
          >
            <p className="m-0 break-all font-mono-semibold text-[15px] leading-6 text-white/55 sm:text-lg">
              beeper.buzz/<span className="text-white/80">browse</span>
              ?ref=<span className="neon-text-cyan">yourname</span>
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={ctaHref} className="neon-btn text-xs no-underline">
              {ctaLabel}
            </Link>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl" aria-label="Program terms">
          <dl className="m-0 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-3">
            {FACTS.map((f) => (
              <div
                key={f.label}
                className="flex flex-col-reverse bg-[#0A0020] px-5 py-4"
              >
                <dt className="mt-1 font-body-bold text-sm leading-5 text-white/55">
                  {f.label}
                </dt>
                <dd className="m-0 font-mono-semibold text-2xl leading-8 text-white">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto mt-16 max-w-3xl">
          <h2 className="m-0 mb-6 font-michroma text-base leading-6 text-white">
            How it works
          </h2>
          <ol className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="glass-panel flex gap-4 p-4">
                <span
                  className="font-mono-semibold text-sm leading-6 text-neon-cyan"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="m-0 font-michroma text-[13px] leading-6 text-white">
                    {s.title}
                  </h3>
                  <p className="m-0 mt-1 font-body-bold text-sm leading-6 text-white/65">
                    {s.copy}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto mt-16 max-w-3xl">
          <h2 className="m-0 mb-6 font-michroma text-base leading-6 text-white">
            Questions
          </h2>
          <dl className="m-0 divide-y divide-white/10 border-y border-white/10">
            {FAQ.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="font-body-bold text-[15px] leading-6 text-white">
                  {f.q}
                </dt>
                <dd className="m-0 mt-1 max-w-[65ch] font-body-bold text-sm leading-6 text-white/60">
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mb-0 mt-6 font-body-bold text-sm text-white/55">
            Something else?{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Affiliate%20program`}
              className="text-neon-cyan underline underline-offset-4"
            >
              Email {CONTACT_EMAIL}
            </a>
          </p>
        </section>
      </div>
    </Layout>
  );
};

export default AffiliatesPage;
