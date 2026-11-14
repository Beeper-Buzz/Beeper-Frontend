import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@lib/utils";
import { useCreatorProducts } from "@hooks/useCreator";
import type { ReviewState } from "../../lib/creator/types";
import { kindLabel } from "../../lib/marketplace";
import {
  btnPrimary,
  ErrorNote,
  formatDate,
  formatMoney,
  numCls,
  PageTitle,
  REVIEW,
  ReviewChip,
  Skeleton
} from "./kit";

const FILTERS: { id: "all" | ReviewState; label: string }[] = [
  { id: "all", label: "All" },
  { id: "approved", label: REVIEW.approved.label },
  { id: "submitted", label: REVIEW.submitted.label },
  { id: "changes_requested", label: "Changes" },
  { id: "draft", label: REVIEW.draft.label },
  { id: "rejected", label: REVIEW.rejected.label }
];

export const ProductTable: React.FC = () => {
  const { data, isLoading, isError, error } = useCreatorProducts();
  const [filter, setFilter] = useState<"all" | ReviewState>("all");
  const rows = useMemo(
    () =>
      (data || [])
        .filter((p) => filter === "all" || p.review_state === filter)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [data, filter]
  );

  return (
    <>
      <PageTitle
        actions={
          <Link
            href="/creator/products/new"
            className={`${btnPrimary} no-underline`}
          >
            <Plus className="h-4 w-4" /> New product
          </Link>
        }
      >
        Products
      </PageTitle>

      <div
        className="mb-3 flex gap-1 overflow-x-auto scrollbar-hide"
        role="group"
        aria-label="Filter by review state"
      >
        {FILTERS.map((f) => {
          const n =
            f.id === "all"
              ? data?.length
              : data?.filter((p) => p.review_state === f.id).length;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "whitespace-nowrap rounded-md border px-2.5 py-1 font-body text-xs transition-colors",
                filter === f.id
                  ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                  : "border-glass-border text-white/60 hover:text-white"
              )}
            >
              {f.label}
              {n !== undefined && (
                <span className={`${numCls} ml-1.5 text-white/40`}>{n}</span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : isError ? (
        <ErrorNote error={error} />
      ) : !data?.length ? (
        <div className="glass-panel px-5 py-10 text-center">
          <p className="font-body text-sm text-white/70">
            You haven&apos;t made a product yet.
          </p>
          <Link
            href="/creator/products/new"
            className={`${btnPrimary} mt-4 no-underline`}
          >
            Make your first product
          </Link>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead className="hidden border-b border-glass-border sm:table-header-group">
              <tr className="font-title-condensed text-xs text-white/50">
                <th className="px-3 py-2 font-normal">Product</th>
                <th className="px-3 py-2 font-normal">State</th>
                <th className="px-3 py-2 text-right font-normal">Price</th>
                <th className="px-3 py-2 text-right font-normal">Version</th>
                <th className="px-3 py-2 text-right font-normal">Sales</th>
                <th className="px-3 py-2 text-right font-normal">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2 hover:bg-white/[0.02] sm:table-row sm:p-0"
                >
                  <td className="min-w-0 sm:px-3 sm:py-2">
                    <Link
                      href={`/creator/products/${p.id}`}
                      className="block truncate font-body text-sm text-white no-underline hover:text-neon-cyan"
                    >
                      {p.name || "Untitled"}
                    </Link>
                    <span className="font-body text-xs text-white/40">
                      {kindLabel(p.kind)}
                    </span>
                  </td>
                  <td className="text-right sm:px-3 sm:py-2 sm:text-left">
                    <ReviewChip state={p.review_state} />
                  </td>
                  <td
                    className={`${numCls} text-xs text-white/70 sm:px-3 sm:py-2 sm:text-right sm:text-sm`}
                  >
                    {Number(p.price) === 0
                      ? "Free"
                      : formatMoney(p.price, p.currency)}
                  </td>
                  <td
                    className={`${numCls} hidden text-right text-sm text-white/50 sm:table-cell sm:px-3 sm:py-2`}
                  >
                    {p.live_asset_version ? `v${p.live_asset_version}` : "—"}
                    {p.asset &&
                      p.asset.status === "draft" &&
                      p.live_asset_version && (
                        <span className="ml-1 text-neon-amber">
                          +v{p.asset.version}
                        </span>
                      )}
                  </td>
                  <td
                    className={`${numCls} text-right text-xs text-white/70 sm:px-3 sm:py-2 sm:text-sm`}
                  >
                    {p.sales_count}
                    <span className="font-body text-white/40 sm:hidden">
                      {" "}
                      sold
                    </span>
                  </td>
                  <td
                    className={`${numCls} hidden text-right text-sm text-white/50 sm:table-cell sm:px-3 sm:py-2`}
                  >
                    {formatDate(p.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-3 py-6 text-center font-body text-sm text-white/50">
              No products in this state.
            </p>
          )}
        </div>
      )}
    </>
  );
};
