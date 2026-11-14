import React, { useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  useCreator,
  useCreatorProducts,
  useCreatorSales
} from "@hooks/useCreator";
import { dateRange, fillDailySeries } from "../../lib/creator/range";
import { kindLabel } from "../../lib/marketplace";
import {
  btnPrimary,
  ErrorNote,
  formatDate,
  formatMoney,
  numCls,
  PageTitle,
  ReviewChip,
  Section,
  Skeleton,
  Sparkline,
  Stat
} from "./kit";

export const Overview: React.FC = () => {
  const { data: creator } = useCreator();
  const products = useCreatorProducts();
  const range = useMemo(() => dateRange(30), []);
  const sales = useCreatorSales(range);

  const series = useMemo(
    () => fillDailySeries(sales.data?.series || [], range.from, range.to),
    [sales.data, range]
  );
  const units30 = series.reduce((n, p) => n + p.units, 0);
  const earned30 = series.reduce((n, p) => n + p.earned, 0);

  if (!creator) return null;
  const { totals, counts, account } = creator;
  const cur = totals.currency || "USD";
  const attention = (products.data || []).filter((p) =>
    ["submitted", "changes_requested", "rejected", "draft"].includes(
      p.review_state
    )
  );

  return (
    <>
      <PageTitle
        sub={`You keep ${(account.revenue_share_bps / 100).toFixed(
          0
        )}% of each sale.`}
        actions={
          <Link
            href="/creator/products/new"
            className={`${btnPrimary} no-underline`}
          >
            <Plus className="h-4 w-4" /> New product
          </Link>
        }
      >
        {creator.profile.name || "Overview"}
      </PageTitle>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat
          label="Payable now"
          value={formatMoney(totals.payable, cur)}
          accent
        />
        <Stat
          label="Earned"
          value={formatMoney(totals.earned, cur)}
          sub="All time, after the hold"
        />
        <Stat label="Paid out" value={formatMoney(totals.paid, cur)} />
        <Stat label="Gross sales" value={formatMoney(totals.gross, cur)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Section
          title="Last 30 days"
          aside={
            <Link
              href="/creator/sales"
              className="font-body text-xs text-white/50 hover:text-white"
            >
              All sales
            </Link>
          }
        >
          {sales.isLoading ? (
            <Skeleton className="h-16" />
          ) : sales.isError ? (
            <ErrorNote error={sales.error} />
          ) : (
            <>
              <div className="flex items-baseline gap-4">
                <span className={`${numCls} text-2xl text-white`}>
                  {formatMoney(earned30, cur)}
                </span>
                <span className="font-body text-sm text-white/50">
                  earned from <span className={numCls}>{units30}</span>{" "}
                  {units30 === 1 ? "sale" : "sales"}
                </span>
              </div>
              <Sparkline
                className="mt-2"
                values={series.map((p) => p.earned)}
                label="Earnings per day, last 30 days"
              />
            </>
          )}
        </Section>

        <Section title="Catalogue">
          <dl className="grid grid-cols-3 gap-2">
            {[
              ["Live", counts.products_live],
              ["In review", counts.products_in_review],
              ["Sales", counts.sales]
            ].map(([label, n]) => (
              <div key={label} className="rounded-md bg-white/[0.03] px-3 py-2">
                <dt className="font-title-condensed text-xs text-white/50">
                  {label}
                </dt>
                <dd className={`${numCls} text-xl text-white`}>{n}</dd>
              </div>
            ))}
          </dl>
          {!account.payout_email && (
            <p className="mt-3 font-body text-xs text-neon-amber">
              No payout email on file yet. Ask support to add one before your
              first payout.
            </p>
          )}
        </Section>
      </div>

      <Section title="Needs your attention" className="mt-4">
        {products.isLoading ? (
          <Skeleton className="h-20" />
        ) : products.isError ? (
          <ErrorNote error={products.error} />
        ) : attention.length === 0 ? (
          <p className="font-body text-sm text-white/50">
            Nothing waiting. Everything you&apos;ve made is live or in review.
          </p>
        ) : (
          <ul className="divide-y divide-glass-border">
            {attention.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/creator/products/${p.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 no-underline hover:bg-white/[0.02]"
                >
                  <span className="min-w-0 flex-1 truncate font-body text-sm text-white">
                    {p.name}
                  </span>
                  <span className="font-body text-xs text-white/40">
                    {kindLabel(p.kind)}
                  </span>
                  <ReviewChip state={p.review_state} />
                  <span className={`${numCls} text-xs text-white/40`}>
                    {formatDate(p.updated_at)}
                  </span>
                  {p.review_note &&
                    (p.review_state === "changes_requested" ||
                      p.review_state === "rejected") && (
                      <span className="w-full font-body text-xs text-white/60">
                        {p.review_note}
                      </span>
                    )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
};
