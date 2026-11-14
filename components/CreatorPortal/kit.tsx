// Small building blocks for the creator tools (portal, apply form, library).
// Tools first: dense, legible, fast. Michroma only for titles; IBM Plex Mono
// for every number; neon colour only where it carries state.

import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@lib/utils";
import { apiErrorMessage } from "../../lib/api/v1";
import type { ReviewState } from "../../lib/creator/types";

export const inputCls =
  "neon-focus w-full rounded-md border border-glass-border bg-surface-deep/80 px-3 py-2 font-body text-sm text-white placeholder:text-white/30 transition-colors disabled:opacity-50";

export const labelCls = "mb-1 block font-title-condensed text-xs text-white/60";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-md border border-neon-cyan/60 bg-neon-cyan/15 px-4 py-2 font-michroma text-[11px] tracking-wide text-neon-cyan transition-colors hover:bg-neon-cyan/25 disabled:pointer-events-none disabled:opacity-40";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-md border border-glass-border bg-transparent px-3 py-2 font-body text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:pointer-events-none disabled:opacity-40";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-md border border-neon-pink/40 bg-transparent px-3 py-2 font-body text-sm text-neon-pink transition-colors hover:bg-neon-pink/10 disabled:pointer-events-none disabled:opacity-40";

export const numCls = "font-mono-semibold tabular-nums";

export const Field: React.FC<{
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, hint, error, className, children }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className={labelCls}>
      {label}
    </label>
    {children}
    {error ? (
      <p className="mt-1 font-body text-xs text-neon-pink">{error}</p>
    ) : hint ? (
      <p className="mt-1 font-body text-xs text-white/40">{hint}</p>
    ) : null}
  </div>
);

export const Section: React.FC<{
  title?: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, aside, className, children }) => (
  <section className={cn("glass-panel p-4 sm:p-5", className)}>
    {(title || aside) && (
      <header className="mb-3 flex items-center justify-between gap-3">
        {title && (
          <h2 className="font-michroma text-[13px] text-white">{title}</h2>
        )}
        {aside}
      </header>
    )}
    {children}
  </section>
);

export const PageTitle: React.FC<{
  children: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ children, sub, actions }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <h1 className="font-michroma text-lg text-white sm:text-xl">
        {children}
      </h1>
      {sub && <p className="mt-1 font-body text-sm text-white/50">{sub}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

type Tone = "cyan" | "magenta" | "lime" | "amber" | "pink" | "muted";

const TONES: Record<Tone, string> = {
  cyan: "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan",
  magenta: "border-neon-magenta/40 bg-neon-magenta/10 text-neon-magenta",
  lime: "border-neon-lime/40 bg-neon-lime/10 text-neon-lime",
  amber: "border-neon-amber/50 bg-neon-amber/10 text-neon-amber",
  pink: "border-neon-pink/40 bg-neon-pink/10 text-neon-pink",
  muted: "border-white/15 bg-white/[0.04] text-white/60"
};

export const Chip: React.FC<{
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = "muted", className, children }) => (
  <span
    className={cn(
      "inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 font-title-condensed text-[11px] leading-none",
      TONES[tone],
      className
    )}
  >
    {children}
  </span>
);

export const REVIEW: Record<ReviewState, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "muted" },
  submitted: { label: "In review", tone: "amber" },
  approved: { label: "Live", tone: "lime" },
  rejected: { label: "Rejected", tone: "pink" },
  changes_requested: { label: "Changes requested", tone: "magenta" }
};

export const ReviewChip: React.FC<{ state: ReviewState }> = ({ state }) => (
  <Chip tone={REVIEW[state]?.tone || "muted"}>
    {REVIEW[state]?.label || state}
  </Chip>
);

export const EARNING_TONE: Record<string, Tone> = {
  pending: "amber",
  payable: "cyan",
  paid: "lime",
  void: "muted"
};

export function formatMoney(
  amount: string | number | null | undefined,
  currency = "USD"
): string {
  const n = typeof amount === "number" ? amount : parseFloat(amount || "0");
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD"
    }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return `${(Number.isFinite(n) ? n : 0).toFixed(2)} ${currency}`;
  }
}

export const formatDate = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
};

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}> = ({ label, value, sub, accent }) => (
  <div className="min-w-0 rounded-md border border-glass-border bg-white/[0.03] px-3 py-2.5">
    <div className="font-title-condensed text-xs text-white/50">{label}</div>
    <div
      className={cn(
        numCls,
        "mt-0.5 truncate text-lg",
        accent ? "text-neon-cyan" : "text-white"
      )}
    >
      {value}
    </div>
    {sub && <div className="font-body text-[11px] text-white/40">{sub}</div>}
  </div>
);

export const ErrorNote: React.FC<{ error: unknown; fallback?: string }> = ({
  error,
  fallback
}) =>
  error ? (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-neon-pink/30 bg-neon-pink/[0.07] px-3 py-2 font-body text-sm text-neon-pink"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{apiErrorMessage(error, fallback)}</span>
    </div>
  ) : null;

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn("animate-pulse rounded-md bg-white/[0.05]", className)}
    aria-hidden
  />
);

/** Tiny line, no axes: a trend at a glance. */
export const Sparkline: React.FC<{
  values: number[];
  className?: string;
  label: string;
}> = ({ values, className, label }) => {
  const w = 160;
  const h = 36;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("h-9 w-full", className)}
      role="img"
      aria-label={label}
    >
      {values.length > 1 && (
        <>
          <polyline
            points={`0,${h} ${pts} ${w},${h}`}
            fill="rgba(0,255,255,0.08)"
            stroke="none"
          />
          <polyline
            points={pts}
            fill="none"
            stroke="#00FFFF"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
};

/** Undo the site-wide `select` styling (huge, centred, uppercase). */
export const selectCls = cn(
  inputCls,
  "max-w-none appearance-auto bg-none normal-case [text-align-last:left]"
);
