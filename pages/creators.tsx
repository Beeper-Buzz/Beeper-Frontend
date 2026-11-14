import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Layout } from "@components/Layout";
import { cn } from "@lib/utils";

// Lit pads on the hero's 4x4 grid: a kick-and-hat pattern, bank A on top.
const LIT = new Set([0, 2, 5, 7, 8, 10, 13, 15]);
const ACCENT = new Set([0, 8]);

const KINDS = [
  {
    title: "Sample packs",
    body: "Up to 16 one-shots or loops, each mapped to a pad, a key zone or both. They load straight into the Sampler and work offline once downloaded."
  },
  {
    title: "Effect presets",
    body: "Settings for the app's nine effects: drive, crush, EQ, chorus, phaser, echo, reverb, pump and compressor. One tap applies the whole chain."
  },
  {
    title: "Visualizers",
    body: "A GLSL fragment shader with up to eight parameters, driven by the bass, mids, highs and the beat. You preview it live in the browser while you build it."
  }
];

const STEPS = [
  "Apply with a few examples of your work.",
  "Once approved, build products in the creator studio: upload files, map samples to pads, set a price.",
  "Submit each product for review. We listen to it, check it loads in the app and put it live.",
  "Buyers download it into the Beeper app. You see every sale and get paid out from your balance."
];

const CreatorsPage = () => (
  <Layout>
    <Head>
      <title>Sell on Beeper | Creators</title>
      <meta
        name="description"
        content="Sell sample packs, effect presets and visualizers that people play inside the Beeper app. You keep 70% of every sale."
      />
    </Head>
    <div className="section-container py-10 sm:py-16">
      {/* Hero */}
      <div className="grid items-center gap-10 md:grid-cols-[1fr_auto]">
        <div className="max-w-xl">
          <h1 className="font-michroma text-2xl leading-snug text-white sm:text-4xl sm:leading-tight">
            Make the sounds people play on Beeper
          </h1>
          <p className="mt-4 font-body text-base text-white/65 sm:text-lg">
            Creators sell sample packs, effect presets and visualizers on
            beeper.buzz. Buyers use them inside the Beeper app, on the pads, in
            the effects rack and behind the music.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href="/account/creator"
              className="neon-btn inline-block text-xs no-underline"
            >
              Apply to sell
            </Link>
            <Link
              href="/browse?mode=marketplace"
              className="font-body text-sm text-white/60 underline-offset-4 hover:text-white hover:underline"
            >
              See the marketplace
            </Link>
          </div>
        </div>

        <div
          className="mx-auto grid w-[220px] grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-surface-deep/80 p-3 shadow-[0_0_40px_rgba(0,255,255,0.08)] sm:w-[260px]"
          aria-hidden
        >
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className={cn(
                "aspect-square rounded-md border",
                ACCENT.has(i)
                  ? "border-neon-magenta/70 bg-neon-magenta/30 shadow-[0_0_14px_rgba(255,0,255,0.45)]"
                  : LIT.has(i)
                  ? "border-neon-cyan/60 bg-neon-cyan/20 shadow-[0_0_10px_rgba(0,255,255,0.35)]"
                  : "border-white/10 bg-white/[0.03]"
              )}
            />
          ))}
        </div>
      </div>

      {/* Revenue share */}
      <section className="mt-14 glass-panel p-5 sm:p-6" aria-labelledby="share">
        <h2 id="share" className="font-michroma text-sm text-white">
          You keep 70% of every sale
        </h2>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden>
          <div className="w-[70%] bg-neon-cyan" />
          <div className="w-[30%] bg-white/15" />
        </div>
        <div className="mt-2 flex justify-between font-mono-semibold text-sm tabular-nums">
          <span className="text-neon-cyan">70% to you</span>
          <span className="text-white/50">30% Beeper</span>
        </div>
        <p className="mt-4 max-w-2xl font-body text-sm text-white/60">
          The share is of the price the buyer paid after discounts. Earnings
          become payable 14 days after the order completes, and refunded orders
          don&apos;t count. Payouts are sent by hand for now; you set the payout
          email in the studio.
        </p>
      </section>

      {/* Kinds */}
      <section className="mt-10" aria-labelledby="sell">
        <h2 id="sell" className="font-michroma text-sm text-white">
          What you can sell
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {KINDS.map((k) => (
            <div key={k.title} className="glass-panel p-5">
              <h3 className="font-title text-sm text-neon-cyan">{k.title}</h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-white/65">
                {k.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps: a real sequence */}
      <section className="mt-10" aria-labelledby="how">
        <h2 id="how" className="font-michroma text-sm text-white">
          How it works
        </h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className="rounded-lg border border-glass-border bg-white/[0.02] p-4"
            >
              <span className="font-mono-semibold text-xs tabular-nums text-neon-cyan">
                {i + 1}
              </span>
              <p className="mt-1 font-body text-sm text-white/70">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-4">
        <Link
          href="/account/creator"
          className="neon-btn inline-block text-xs no-underline"
        >
          Apply to sell
        </Link>
        <span className="font-body text-sm text-white/50">
          You&apos;ll need a Beeper account.
        </span>
      </div>
    </div>
  </Layout>
);

export default CreatorsPage;
