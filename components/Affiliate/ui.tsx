import React from "react";
import { cn } from "@lib/utils";
import type { CommissionState } from "@lib/affiliate/types";

/** Glass panel with a Michroma title. */
export const Panel: React.FC<{
  title?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  id?: string;
}> = ({ title, aside, className, children, id }) => (
  <section
    className={cn("glass-panel min-w-0 p-4 sm:p-5", className)}
    aria-labelledby={id && title ? `${id}-title` : undefined}
  >
    {(title || aside) && (
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {title && (
          <h2
            id={id ? `${id}-title` : undefined}
            className="m-0 font-michroma text-[13px] leading-5 tracking-[0.03em] text-white"
          >
            {title}
          </h2>
        )}
        {aside}
      </header>
    )}
    {children}
  </section>
);

/** Numbers: IBM Plex Mono with tabular figures. */
export const num = "font-mono-semibold tabular-nums";

export const labelClass =
  "mb-1.5 block font-body-bold text-[13px] leading-4 text-white/70";

export const fieldClass =
  "block w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2.5 font-body-bold text-[16px] leading-5 text-white placeholder:text-white/45 transition-colors aria-[invalid=true]:border-neon-pink focus:border-neon-cyan focus:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/30 disabled:opacity-50";

export const hintClass =
  "mt-1.5 font-body-bold text-xs leading-4 text-white/60";

export const STATE_STYLE: Record<
  CommissionState,
  { label: string; dot: string; text: string }
> = {
  pending: { label: "Pending", dot: "bg-neon-amber", text: "text-neon-amber" },
  approved: { label: "Approved", dot: "bg-neon-cyan", text: "text-neon-cyan" },
  paid: { label: "Paid", dot: "bg-neon-lime", text: "text-neon-lime" },
  void: { label: "Void", dot: "bg-white/40", text: "text-white/55" }
};

export const StateChip: React.FC<{ state: CommissionState }> = ({ state }) => {
  const s = STATE_STYLE[state] || STATE_STYLE.void;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-body-bold text-xs leading-4",
        s.text
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
};

/** Small secondary button (glass, cyan on hover). */
export const ghostBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 font-body-bold text-[13px] leading-4 text-white/80 transition-colors hover:border-neon-cyan/60 hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/40 disabled:pointer-events-none disabled:opacity-40";

export const formatDate = (iso?: string | null) => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};
