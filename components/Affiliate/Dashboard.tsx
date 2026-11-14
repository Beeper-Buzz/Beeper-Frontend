import React, { useMemo, useState } from "react";
import { cn } from "@lib/utils";
import {
  MAX_RANGE_DAYS,
  formatBps,
  isValidRange,
  presetRange,
  summarizeSeries
} from "@lib/affiliate/stats";
import type { Affiliate } from "@lib/affiliate/types";
import { useAffiliateStats } from "@hooks/useAffiliate";
import { LinkBuilder } from "./LinkBuilder";
import { KpiTiles } from "./KpiTiles";
import { StatsChart } from "./StatsChart";
import { CommissionsTable } from "./CommissionsTable";
import { PayoutsTable } from "./PayoutsTable";
import { Terms } from "./Terms";
import { PayoutEmail } from "./PayoutEmail";
import { Panel, num } from "./ui";

type Preset = 7 | 30 | 90 | "custom";
const PRESETS: { value: Preset; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: "custom", label: "Custom" }
];

const dateInput =
  "min-w-0 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1.5 font-mono-semibold text-[16px] leading-5 text-white [color-scheme:dark] focus:border-neon-cyan focus:outline-none sm:text-[13px]";

export const Dashboard: React.FC<{ affiliate: Affiliate }> = ({
  affiliate
}) => {
  const [preset, setPreset] = useState<Preset>(30);
  const [custom, setCustom] = useState(() => presetRange(30));
  const range = useMemo(
    () => (preset === "custom" ? custom : presetRange(preset)),
    [preset, custom]
  );
  const validRange = isValidRange(range);
  const stats = useAffiliateStats(range, validRange);
  const series = stats.data?.series || [];
  const summary = stats.data ? summarizeSeries(series) : null;
  const currency = affiliate.totals?.currency || "USD";

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="m-0 font-michroma text-base leading-6 text-white sm:text-lg">
          Affiliate dashboard
        </h2>
        <p className="m-0 font-body-bold text-sm text-white/65">
          <span className={cn("text-white", num)}>{affiliate.code}</span>
          {"  "}earns{" "}
          <span className={cn("text-white", num)}>
            {formatBps(affiliate.commission_bps)}
          </span>
          , {affiliate.cookie_days}-day window
        </p>
      </div>

      <PayoutEmail email={affiliate.payout_email} className="-mt-2" />

      <LinkBuilder code={affiliate.code} link={affiliate.link} />

      <Panel
        title="Performance"
        id="aff-performance"
        aside={
          <div
            role="group"
            aria-label="Date range"
            className="flex rounded-md border border-white/10 bg-black/30 p-0.5"
          >
            {PRESETS.map((p) => {
              const on = preset === p.value;
              return (
                <button
                  key={String(p.value)}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPreset(p.value)}
                  className={cn(
                    "rounded px-2.5 py-1.5 font-body-bold text-xs leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/40",
                    on
                      ? "bg-neon-cyan/15 text-neon-cyan"
                      : "bg-transparent text-white/55 hover:text-white"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        }
      >
        {preset === "custom" && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 font-body-bold text-xs text-white/60">
              From
              <input
                type="date"
                value={custom.from}
                max={custom.to}
                onChange={(e) =>
                  e.target.value &&
                  setCustom((c) => ({ ...c, from: e.target.value }))
                }
                className={dateInput}
              />
            </label>
            <label className="flex items-center gap-2 font-body-bold text-xs text-white/60">
              to
              <input
                type="date"
                value={custom.to}
                min={custom.from}
                onChange={(e) =>
                  e.target.value &&
                  setCustom((c) => ({ ...c, to: e.target.value }))
                }
                className={dateInput}
              />
            </label>
            {!validRange && (
              <span
                role="alert"
                className="font-body-bold text-xs text-neon-amber"
              >
                {custom.from > custom.to
                  ? "The start date is after the end date."
                  : `Pick a range of ${MAX_RANGE_DAYS} days or less.`}
              </span>
            )}
          </div>
        )}

        <KpiTiles
          summary={summary}
          totals={affiliate.totals}
          loading={stats.isFetching}
        />

        <div className="mt-5">
          {stats.isError && (
            <p
              role="alert"
              className="m-0 mb-3 font-body-bold text-sm text-neon-amber"
            >
              {stats.data
                ? "The latest stats didn't load, so these may be out of date. "
                : "Stats didn't load. "}
              <button
                type="button"
                onClick={() => stats.refetch()}
                className="cursor-pointer border-0 bg-transparent p-0 text-neon-cyan underline underline-offset-4"
              >
                Try again
              </button>
            </p>
          )}
          {stats.isLoading ? (
            <div className="h-[230px] animate-pulse rounded-md bg-white/[0.03]" />
          ) : stats.data ? (
            <StatsChart
              series={series}
              currency={currency}
              loading={stats.isFetching}
            />
          ) : null}
        </div>
      </Panel>

      <CommissionsTable currency={currency} />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <PayoutsTable currency={currency} />
        <Terms
          commissionBps={affiliate.commission_bps}
          cookieDays={affiliate.cookie_days}
          onDashboard
        />
      </div>
    </div>
  );
};

export default Dashboard;
