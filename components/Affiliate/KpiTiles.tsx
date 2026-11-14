import React from "react";
import { cn } from "@lib/utils";
import { formatMoney, type SeriesSummary } from "@lib/affiliate/stats";
import type { AffiliateTotals } from "@lib/affiliate/types";
import { num } from "./ui";

const Tile: React.FC<{
  label: string;
  value: string;
  accent?: string;
  dim?: boolean;
  /** Below 414 px, lay the tile out as a row (label left, value right). */
  compact?: boolean;
}> = ({ label, value, accent, dim, compact }) => (
  <div
    className={cn(
      "relative min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] px-3 pb-2.5 pt-3",
      compact &&
        "max-xs:flex max-xs:items-baseline max-xs:justify-between max-xs:gap-3 max-xs:py-2.5"
    )}
  >
    {accent && (
      <span
        className={cn("absolute inset-x-0 top-0 h-[2px]", accent)}
        aria-hidden
      />
    )}
    <dt className="truncate font-body-bold text-xs leading-4 text-white/55">
      {label}
    </dt>
    <dd
      className={cn(
        "m-0 mt-1 truncate text-[15px] leading-6 xs:text-lg",
        compact && "max-xs:mt-0",
        num,
        dim ? "text-white/60" : "text-white"
      )}
      title={value}
    >
      {value}
    </dd>
  </div>
);

const Group: React.FC<{
  caption: string;
  compact?: boolean;
  children: React.ReactNode;
}> = ({ caption, compact, children }) => (
  <div className="min-w-0">
    <p className="m-0 mb-2 font-body-bold text-xs text-white/45">{caption}</p>
    <dl
      className={cn(
        "m-0 grid grid-cols-3 gap-2",
        compact && "max-xs:grid-cols-1"
      )}
    >
      {children}
    </dl>
  </div>
);

export const KpiTiles: React.FC<{
  summary: SeriesSummary | null;
  totals: AffiliateTotals;
  loading?: boolean;
}> = ({ summary, totals, loading }) => {
  const cur = totals.currency || "USD";
  const dash = "—";
  return (
    <div
      className={cn(
        "grid gap-4 transition-opacity lg:grid-cols-2",
        loading && "opacity-60"
      )}
      aria-busy={loading}
    >
      <Group caption="In this range">
        <Tile
          label="Clicks"
          value={summary ? summary.clicks.toLocaleString("en-US") : dash}
          accent="bg-neon-cyan"
        />
        <Tile
          label="Orders"
          value={summary ? summary.orders.toLocaleString("en-US") : dash}
          accent="bg-neon-magenta"
        />
        <Tile
          label="Conversion"
          value={
            summary
              ? `${(summary.conversion * 100).toFixed(
                  summary.conversion > 0 && summary.conversion < 0.1 ? 2 : 1
                )}%`
              : dash
          }
        />
      </Group>
      <Group caption="Commission balance, all time" compact>
        <Tile
          label="Pending"
          compact
          value={formatMoney(totals.pending, cur)}
          accent="bg-neon-amber"
        />
        <Tile
          label="Approved"
          compact
          value={formatMoney(totals.approved, cur)}
          accent="bg-neon-cyan"
        />
        <Tile
          label="Paid"
          compact
          value={formatMoney(totals.paid, cur)}
          accent="bg-neon-lime"
        />
      </Group>
    </div>
  );
};

export default KpiTiles;
