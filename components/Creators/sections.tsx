import React, { useId, useState } from "react";
import Link from "next/link";
import { cn } from "@lib/utils";
import {
  creatorEarnings,
  itemsOf,
  numberOr,
  PageSection
} from "@lib/cms/pageSections";
import { JsonApiResource, pickGridMedia } from "@lib/productMedia";
import { MarketplaceCard } from "@components/Browse/MarketplaceCard";
import { PadSequencer, DEFAULT_PATTERN } from "./PadSequencer";

// Renderers for the /creators page's CMS sections, one per section_type. Every
// field comes from the section (admin → Page Sections → Creators); the
// fallbacks here only cover a field an editor left out.

export interface MarketplaceShelf {
  data: JsonApiResource[];
  included: JsonApiResource[];
}

export interface SectionProps {
  section: PageSection;
  marketplace?: MarketplaceShelf | null;
}

const mediaBaseUrl = process.env.NEXT_PUBLIC_SPREE_API_URL || "";

const Html: React.FC<{ html: string | null; className?: string }> = ({
  html,
  className
}) =>
  html ? (
    <div
      className={cn("cms-body font-body", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : null;

const Heading: React.FC<{ id: string; children: React.ReactNode }> = ({
  id,
  children
}) => (
  <h2
    id={id}
    className="font-michroma text-lg leading-snug text-white sm:text-2xl"
  >
    {children}
  </h2>
);

const PrimaryLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children
}) => (
  <Link href={href} className="neon-btn inline-block text-xs no-underline">
    {children}
  </Link>
);

const money = (n: number) => `$${n.toFixed(2)}`;

// ── hero ────────────────────────────────────────────────────────────

const Hero: React.FC<SectionProps> = ({ section }) => {
  const s = section.settings;
  const pattern = Array.isArray(s.pattern)
    ? s.pattern.map(Number).filter(Number.isInteger)
    : DEFAULT_PATTERN;
  return (
    <section className="grid items-center gap-12 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)] md:gap-16 lg:gap-24">
      <div className="max-w-xl">
        <h1 className="font-michroma text-[28px] leading-[1.2] text-white sm:text-[44px] sm:leading-[1.15]">
          {section.title || "Make the sounds people play on Beeper"}
        </h1>
        <Html
          html={section.content}
          className="mt-6 max-w-[34rem] text-base leading-relaxed text-white/70 sm:text-lg"
        />
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <PrimaryLink href={s.button_link || "/account/creator"}>
            {s.button_text || "Apply to sell"}
          </PrimaryLink>
          {s.secondary_text && s.secondary_link && (
            <Link
              href={s.secondary_link}
              className="font-body text-sm text-white/60 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white"
            >
              {s.secondary_text}
            </Link>
          )}
        </div>
      </div>
      <PadSequencer pattern={pattern} hint={s.hint} />
    </section>
  );
};

// ── revenue_share: an earnings fader ────────────────────────────────

const RevenueShare: React.FC<SectionProps> = ({ section }) => {
  const s = section.settings;
  const share = Math.min(100, Math.max(0, numberOr(s.creator_share, 70)));
  const min = Math.max(0, numberOr(s.slider_min, 0.5));
  const max = Math.max(min + 1, numberOr(s.slider_max, 50));
  const [price, setPrice] = useState(() =>
    Math.min(max, Math.max(min, numberOr(s.example_price, 8)))
  );
  const id = useId();
  const earn = creatorEarnings(price, share);

  return (
    <section
      aria-labelledby={`${id}-h`}
      className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:items-center md:gap-16"
    >
      <div className="max-w-xl">
        <Heading id={`${id}-h`}>
          {section.title || `You keep ${share}% of every sale`}
        </Heading>
        <Html
          html={section.content}
          className="mt-4 text-sm leading-relaxed text-white/60"
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-black p-5 shadow-[inset_0_0_40px_rgba(0,255,255,0.05)] sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-body text-xs text-white/50">You earn per sale</p>
            <p
              className="font-ds-digital text-5xl leading-none text-neon-cyan [text-shadow:0_0_16px_rgba(0,255,255,0.55)] sm:text-6xl"
              aria-live="polite"
            >
              {money(earn)}
            </p>
          </div>
          <p className="text-right font-body text-xs text-white/50">
            Beeper keeps
            <span className="block font-mono-semibold text-sm tabular-nums text-white/70">
              {money(Math.round((price - earn) * 100) / 100)}
            </span>
          </p>
        </div>

        <div className="mt-5 flex h-2 overflow-hidden rounded-full" aria-hidden>
          <div className="bg-neon-cyan" style={{ width: `${share}%` }} />
          <div className="flex-1 bg-white/15" />
        </div>

        <label
          htmlFor={`${id}-price`}
          className="mt-6 flex items-baseline justify-between font-body text-xs text-white/50"
        >
          <span>If you price it at</span>
          <span className="font-mono-semibold text-sm tabular-nums text-white">
            {money(price)}
          </span>
        </label>
        <input
          id={`${id}-price`}
          type="range"
          min={min}
          max={max}
          step={0.5}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="creators-fader mt-3 w-full"
        />
      </div>
    </section>
  );
};

// ── features: what you can sell ─────────────────────────────────────

const EFFECTS = [
  "Drive",
  "Crush",
  "EQ",
  "Chorus",
  "Phaser",
  "Echo",
  "Reverb",
  "Pump",
  "Comp"
];

const KindVisual: React.FC<{ kind?: string }> = ({ kind }) => {
  if (kind === "sample_pack")
    return (
      <div className="grid w-[176px] grid-cols-8 gap-1" aria-hidden>
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "aspect-square rounded-[3px]",
              [0, 3, 6, 9, 12, 13].includes(i)
                ? "bg-neon-cyan/50"
                : "bg-white/[0.07]"
            )}
          />
        ))}
      </div>
    );
  if (kind === "effect_preset")
    return (
      <div className="relative flex flex-wrap gap-1.5" aria-hidden>
        {EFFECTS.map((e, i) => (
          <span
            key={e}
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono-semibold text-[10px]",
              [0, 4, 6].includes(i)
                ? "border-neon-cyan/50 text-neon-cyan"
                : "border-white/10 text-white/35"
            )}
          >
            {e}
          </span>
        ))}
      </div>
    );
  if (kind === "visualizer")
    return (
      <div
        className="h-14 w-full rounded-lg opacity-80"
        style={{
          background:
            "radial-gradient(circle at 30% 60%, rgba(255,0,255,0.55), transparent 45%), radial-gradient(circle at 72% 35%, rgba(0,255,255,0.5), transparent 42%), #0A0020"
        }}
        aria-hidden
      />
    );
  return null;
};

const Features: React.FC<SectionProps> = ({ section }) => {
  const items = itemsOf<{ title: string; body: string; kind?: string }>(
    section.settings,
    ["title", "body"]
  );
  const id = useId();
  if (!items.length) return null;
  return (
    <section aria-labelledby={`${id}-h`}>
      <Heading id={`${id}-h`}>{section.title || "What you can sell"}</Heading>
      <Html
        html={section.content}
        className="mt-3 max-w-2xl text-sm text-white/60"
      />
      <div className="mt-8 grid gap-x-10 gap-y-10 md:grid-cols-3">
        {items.map((k) => (
          <div key={k.title} className="border-t border-white/10 pt-5">
            <div className="flex h-14 items-center">
              <KindVisual kind={k.kind} />
            </div>
            <h3 className="mt-5 font-title text-base text-white">{k.title}</h3>
            <p className="mt-2 max-w-sm font-body text-sm leading-relaxed text-white/60">
              {k.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

// ── steps: a real sequence ──────────────────────────────────────────

const Steps: React.FC<SectionProps> = ({ section }) => {
  const items = itemsOf<{ title: string; body: string }>(section.settings, [
    "title"
  ]);
  const id = useId();
  if (!items.length) return null;
  return (
    <section aria-labelledby={`${id}-h`}>
      <Heading id={`${id}-h`}>{section.title || "How it works"}</Heading>
      <ol className="relative mt-8 grid gap-8 md:grid-cols-4 md:gap-6">
        <span
          className="absolute left-[15px] top-4 bottom-4 w-px bg-white/10 md:left-4 md:right-4 md:top-[15px] md:bottom-auto md:h-px md:w-auto"
          aria-hidden
        />
        {items.map((s, i) => (
          <li key={s.title} className="relative flex gap-4 md:block">
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neon-cyan/50 bg-surface-deep font-mono-semibold text-xs tabular-nums text-neon-cyan">
              {i + 1}
            </span>
            <div className="md:mt-4">
              <h3 className="font-title text-sm text-white">{s.title}</h3>
              {s.body && (
                <p className="mt-1.5 font-body text-sm leading-relaxed text-white/60">
                  {s.body}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

// ── products: the live marketplace ──────────────────────────────────

const Products: React.FC<SectionProps> = ({ section, marketplace }) => {
  const s = section.settings;
  const id = useId();
  const limit = Math.max(1, Math.min(12, numberOr(s.limit, 8)));
  const products = (marketplace?.data || []).slice(0, limit);
  if (!products.length) return null;
  return (
    <section aria-labelledby={`${id}-h`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading id={`${id}-h`}>
            {section.title || "In the marketplace now"}
          </Heading>
          <Html html={section.content} className="mt-2 text-sm text-white/60" />
        </div>
        {s.link && (
          <Link
            href={s.link}
            className="font-body text-sm text-white/60 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white"
          >
            {s.link_text || "See the marketplace"}
          </Link>
        )}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p, i) => (
          <MarketplaceCard
            key={p.id}
            product={p}
            index={i}
            media={pickGridMedia(p, marketplace?.included, {
              baseUrl: mediaBaseUrl
            })}
          />
        ))}
      </div>
    </section>
  );
};

// ── faq ─────────────────────────────────────────────────────────────

const Faq: React.FC<SectionProps> = ({ section }) => {
  const items = itemsOf<{ question: string; answer: string }>(
    section.settings,
    ["question", "answer"]
  );
  const id = useId();
  if (!items.length) return null;
  return (
    <section
      aria-labelledby={`${id}-h`}
      className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-16"
    >
      <Heading id={`${id}-h`}>{section.title || "Questions"}</Heading>
      <div className="divide-y divide-white/10 border-y border-white/10">
        {items.map((q) => (
          <details key={q.question} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 font-title text-sm text-white marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan [&::-webkit-details-marker]:hidden">
              {q.question}
              <span
                className="relative h-3 w-3 shrink-0 text-neon-cyan"
                aria-hidden
              >
                <span className="absolute left-0 top-1/2 h-px w-3 bg-current" />
                <span className="absolute left-1/2 top-0 h-3 w-px bg-current transition-transform duration-200 group-open:scale-y-0" />
              </span>
            </summary>
            <p className="max-w-2xl pb-5 font-body text-sm leading-relaxed text-white/60">
              {q.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
};

// ── call_to_action ──────────────────────────────────────────────────

const CallToAction: React.FC<SectionProps> = ({ section }) => {
  const s = section.settings;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-neon-cyan/25 bg-surface-deep/80 px-6 py-10 sm:px-10 sm:py-12">
      <div
        className="pointer-events-none absolute -right-10 -top-10 grid grid-cols-4 gap-2 opacity-25"
        aria-hidden
      >
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-10 w-10 rounded-md border",
              DEFAULT_PATTERN.includes(i)
                ? "border-neon-cyan/70 bg-neon-cyan/30"
                : "border-white/15"
            )}
          />
        ))}
      </div>
      <div className="relative max-w-lg">
        <h2 className="font-michroma text-xl leading-snug text-white sm:text-2xl">
          {section.title || "Start selling on Beeper"}
        </h2>
        <Html html={section.content} className="mt-3 text-sm text-white/60" />
        <div className="mt-6">
          <PrimaryLink href={s.button_link || "/account/creator"}>
            {s.button_text || "Apply to sell"}
          </PrimaryLink>
        </div>
      </div>
    </section>
  );
};

// ── content: free-form HTML ─────────────────────────────────────────

const Content: React.FC<SectionProps> = ({ section }) => {
  const id = useId();
  if (!section.content && !section.title) return null;
  return (
    <section aria-labelledby={section.title ? `${id}-h` : undefined}>
      {section.title && <Heading id={`${id}-h`}>{section.title}</Heading>}
      <Html
        html={section.content}
        className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65"
      />
    </section>
  );
};

export const CREATOR_SECTIONS: Record<string, React.FC<SectionProps>> = {
  hero: Hero,
  revenue_share: RevenueShare,
  features: Features,
  steps: Steps,
  products: Products,
  faq: Faq,
  call_to_action: CallToAction,
  content: Content
};
