import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@lib/utils";
import { MediaItem } from "@lib/productMedia";
import { ProductMedia } from "@components/ProductMedia";
import {
  creatorOf,
  digitalKindOf,
  DigitalKind,
  kindLabel
} from "../../lib/marketplace";

/** A storefront v2 product (JSON:API resource) in the Marketplace taxon. */
export type MarketplaceProduct = {
  type: string;
  id: string;
  attributes?: Record<string, any>;
};

interface MarketplaceCardProps {
  product: MarketplaceProduct;
  index?: number;
  media?: MediaItem | null;
}

const GLYPH: Record<DigitalKind, string> = {
  sample_pack: "♫",
  effect_preset: "◈",
  visualizer: "◉"
};

const priceLabel = (attrs: Record<string, any>): string => {
  const n = parseFloat(attrs.price ?? "");
  if (Number.isFinite(n) && n === 0) return "Free";
  return attrs.display_price || (Number.isFinite(n) ? `$${n.toFixed(2)}` : "");
};

export const MarketplaceCard: React.FC<MarketplaceCardProps> = ({
  product,
  index = 0,
  media = null
}) => {
  const attrs = product.attributes || {};
  const kind = digitalKindOf(product);
  const creator = creatorOf(product);

  const placeholder = (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-neon-magenta/10 via-surface-deep to-neon-cyan/10" />
      <span className="relative font-pressstart text-lg text-white/20">
        {kind ? GLYPH[kind] : "◇"}
      </span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: Math.min(index, 8) * 0.06,
        ease: "easeOut"
      }}
    >
      <div
        className={cn(
          "glass-panel group relative overflow-hidden rounded-xl transition-all duration-300",
          "hover:border-neon-magenta/40 hover:shadow-[0_0_20px_rgba(255,0,255,0.15)]"
        )}
      >
        <Link href={`/${attrs.slug}`} className="block no-underline">
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-deep">
            <ProductMedia
              media={media}
              surface="grid"
              className="absolute inset-0"
              mediaClassName="h-full w-full object-cover"
              placeholder={placeholder}
            />
            {kind && (
              <div className="absolute left-3 top-3">
                <span className="glass-panel inline-block rounded-full px-3 py-1 font-title text-[10px] tracking-wider text-white/80">
                  {kindLabel(kind)}
                </span>
              </div>
            )}
            <div className="absolute right-3 top-3">
              <span className="inline-block rounded-md border border-neon-cyan/40 bg-neon-cyan/20 px-2.5 py-1 font-mono-semibold text-xs tabular-nums text-neon-cyan">
                {priceLabel(attrs)}
              </span>
            </div>
          </div>
          <div className="px-4 pt-3">
            <h3 className="truncate font-title text-sm font-bold text-white">
              {attrs.name}
            </h3>
          </div>
        </Link>
        <div className="truncate px-4 pb-4 pt-0.5 font-body text-xs text-white/50">
          {creator ? (
            <>
              by{" "}
              <Link
                href={`/${creator.handle}`}
                className="text-white/70 no-underline hover:text-neon-cyan"
              >
                {creator.name}
              </Link>
            </>
          ) : (
            "Beeper"
          )}
        </div>
      </div>
    </motion.div>
  );
};
