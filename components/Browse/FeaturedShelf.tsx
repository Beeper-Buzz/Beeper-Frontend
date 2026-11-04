import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@lib/utils";
import {
  hasMsrp,
  isPreorder,
  JsonApiResource,
  pickGridMedia
} from "@lib/productMedia";
import { ProductMedia } from "@components/ProductMedia";
import { CardMediaPlaceholder } from "@components/ProductCard/ProductCard";

interface FeaturedShelfProps {
  /** Featured taxon products ({ data, included }) in admin order. */
  featured: { data: JsonApiResource[]; included?: JsonApiResource[] };
}

const priceOf = (p: JsonApiResource) => {
  const a = p.attributes || {};
  return {
    price: a.display_price || (a.price ? `$${a.price}` : ""),
    msrp: hasMsrp(a.price, a.compare_at_price)
      ? a.display_compare_at_price || `$${a.compare_at_price}`
      : null
  };
};

/** Strip tags from Spree descriptions (they may hold HTML). */
const plain = (html: unknown): string =>
  String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The first featured product as a large hero, the rest as a row. Rendered by
 * Browse above the shop grid only when nothing is filtered or searched.
 */
export const FeaturedShelf: React.FC<FeaturedShelfProps> = ({ featured }) => {
  const baseUrl = process.env.NEXT_PUBLIC_SPREE_API_URL || "";
  const [hero, ...rest] = featured.data;
  if (!hero) return null;

  const heroMedia = pickGridMedia(hero, featured.included, {
    baseUrl,
    posterWidth: 1000
  });
  const heroPreorder = isPreorder(hero, featured.included);
  const { price, msrp } = priceOf(hero);
  const heroHref = `/${hero.attributes?.slug}`;
  const blurb = plain(hero.attributes?.description);

  return (
    <motion.section
      aria-label="Featured"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
      className="mb-10"
    >
      {/* Section label */}
      <div className="mb-4 flex items-center gap-3">
        <span className="font-pressstart text-[10px] tracking-widest text-neon-cyan sm:text-xs">
          FEATURED
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-neon-cyan/50 via-neon-magenta/30 to-transparent" />
        <span className="font-ds-digital text-sm tracking-wider text-white/40">
          {String(featured.data.length).padStart(2, "0")}
        </span>
      </div>

      {/* Hero */}
      <Link
        href={heroHref}
        className="group glass-panel relative block overflow-hidden no-underline transition-all duration-500 hover:border-neon-cyan/40 hover:shadow-[0_0_28px_rgba(0,255,255,0.18)]"
      >
        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Media */}
          <div className="relative md:col-span-7 md:min-h-[440px]">
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 50% 55%, rgba(0,255,255,0.10) 0%, rgba(255,0,255,0.05) 45%, transparent 75%)"
              }}
            />
            <ProductMedia
              media={heroMedia}
              surface="grid"
              priority
              className={cn(
                "scanlines relative z-[1] w-full overflow-hidden md:absolute md:inset-0 md:aspect-auto md:h-full",
                // No media yet: a shorter frame, not a big empty square.
                heroMedia ? "aspect-square sm:aspect-[16/10]" : "aspect-[16/9]"
              )}
              mediaClassName="h-full w-full object-cover transition-transform duration-700 ease-expo-out group-hover:scale-[1.03]"
              placeholder={<CardMediaPlaceholder />}
            />
            {heroPreorder && (
              <span className="badge-preorder absolute left-4 top-4 z-[2]">
                PRE-ORDER
              </span>
            )}
          </div>

          {/* Copy */}
          <div className="relative flex flex-col justify-center gap-5 border-t border-glass-border p-6 sm:p-8 md:col-span-5 md:border-l md:border-t-0 lg:p-10">
            <h2 className="neon-text-magenta font-pressstart text-base leading-relaxed sm:text-lg lg:text-xl">
              {hero.attributes?.name}
            </h2>

            {blurb && (
              <p className="line-clamp-3 font-body text-sm leading-relaxed text-white/60">
                {blurb}
              </p>
            )}

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-ds-digital text-4xl tracking-wider text-neon-cyan sm:text-5xl">
                {price}
              </span>
              {msrp && (
                <span className="font-title text-sm text-white/40">
                  <span className="line-through">{msrp}</span> MSRP
                </span>
              )}
            </div>

            <span className="neon-btn inline-flex w-full items-center justify-center gap-2 sm:w-fit">
              {heroPreorder ? "Reserve now" : "View product"}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </Link>

      {/* The rest */}
      {rest.length > 0 && (
        <div className="-mx-5 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
          {rest.map((p) => {
            const media = pickGridMedia(p, featured.included, { baseUrl });
            const pr = priceOf(p);
            const preorder = isPreorder(p, featured.included);
            return (
              <Link
                key={p.id}
                href={`/${p.attributes?.slug}`}
                className={cn(
                  "group glass-panel block w-[46%] flex-shrink-0 snap-start overflow-hidden no-underline transition-all duration-500 sm:w-auto",
                  "hover:-translate-y-0.5 hover:border-neon-cyan/40 hover:shadow-[0_0_18px_rgba(0,255,255,0.2)]"
                )}
              >
                <div className="relative">
                  <ProductMedia
                    media={media}
                    surface="grid"
                    className="aspect-square w-full overflow-hidden"
                    mediaClassName="h-full w-full object-cover transition-transform duration-500 ease-expo-out group-hover:scale-105"
                    placeholder={<CardMediaPlaceholder />}
                  />
                  {preorder && (
                    <span className="badge-preorder absolute left-2 top-2">
                      PRE-ORDER
                    </span>
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <p className="truncate font-title text-sm text-white">
                    {p.attributes?.name}
                  </p>
                  <p className="flex items-baseline gap-2">
                    <span className="font-ds-digital text-lg tracking-wider text-neon-cyan">
                      {pr.price}
                    </span>
                    {pr.msrp && (
                      <span className="font-title text-[11px] text-white/40 line-through">
                        {pr.msrp}
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </motion.section>
  );
};

export default FeaturedShelf;
