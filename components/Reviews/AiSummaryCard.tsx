import React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@lib/utils";
import { pluralize } from "@lib/reviews";
import type {
  AiSummary,
  AiSummaryPoint,
  ReviewScope
} from "../../types/reviews";

interface AiSummaryCardProps {
  summary: AiSummary | null | undefined;
  /** The scope the surrounding section shows; `all` labels it "retail reviews". */
  scope: ReviewScope;
  className?: string;
}

const Point = ({
  point,
  tone
}: {
  point: AiSummaryPoint;
  tone: "pro" | "con";
}) => (
  <li className="inline-flex items-center gap-1 rounded-full border border-glass-border bg-glass-bg px-2.5 py-0.5 font-body text-xs text-foreground">
    <span
      aria-hidden="true"
      className={tone === "pro" ? "text-neon-lime" : "text-neon-amber"}
    >
      {tone === "pro" ? "+" : "−"}
    </span>
    <span className="sr-only">{tone === "pro" ? "Pro: " : "Con: "}</span>
    {point.label}
    <span className="ml-1 font-title text-[11px] tabular-nums text-muted-foreground">
      {point.mentions}
      <span className="sr-only"> mentions</span>
    </span>
  </li>
);

/**
 * AI summary of the retail reviews. Renders nothing until the backend has
 * one (M7) and never in the wholesale-only scope.
 */
export const AiSummaryCard = ({
  summary,
  scope,
  className
}: AiSummaryCardProps) => {
  if (!summary || scope === "wholesale") return null;
  const count = summary.review_count || 0;
  const label =
    scope === "all"
      ? `AI summary of ${pluralize(count, "retail review")}`
      : `AI summary of ${pluralize(count, "review")}`;
  const points = [
    ...(summary.pros || []).map((p) => ({ p, tone: "pro" as const })),
    ...(summary.cons || []).map((p) => ({ p, tone: "con" as const }))
  ];

  return (
    <section
      aria-label={label}
      className={cn(
        "grid content-start gap-3 rounded-xl border border-neon-cyan/30 bg-gradient-to-br from-neon-cyan/10 via-neon-magenta/5 to-transparent p-5",
        className
      )}
    >
      <p className="m-0 flex items-center gap-2 font-micro5 text-base uppercase tracking-wider text-neon-cyan">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </p>
      {summary.headline && (
        <h3 className="font-body text-[15px] font-medium text-foreground">
          {summary.headline}
        </h3>
      )}
      {summary.summary && (
        <p className="m-0 font-body text-sm leading-relaxed text-muted-foreground">
          {summary.summary}
        </p>
      )}
      {points.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {points.map(({ p, tone }) => (
            <Point key={`${tone}-${p.label}`} point={p} tone={tone} />
          ))}
        </ul>
      )}
    </section>
  );
};

export default AiSummaryCard;
