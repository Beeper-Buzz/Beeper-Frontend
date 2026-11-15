// A small plot of a binding's curve over 0..1, with a live dot at the binding's current t.

import React, { useMemo, useRef } from "react";
import { cn } from "@lib/utils";
import { curve } from "../../../../lib/gltfVisualizer/core/bindings";
import type { CurveName } from "../../../../lib/gltfVisualizer/core/manifest";
import { useEveryFrame } from "./live";

const W = 96;
const H = 56;
const PAD = 4;
const SAMPLES = 48;

const x = (t: number) => PAD + t * (W - 2 * PAD);
const y = (v: number) => H - PAD - v * (H - 2 * PAD);

export const CurveGraph: React.FC<{
  name: CurveName;
  steps?: number;
  invert?: boolean;
  /** The binding's current t (0..1), read every frame; null hides the dot. */
  readT?: (() => number) | null;
  className?: string;
}> = ({ name, steps = 4, invert, readT, className }) => {
  const n = Number.isFinite(steps) && steps >= 2 ? Math.round(steps) : 4;
  const points = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const v = curve(name, invert ? 1 - t : t, n);
      pts.push(`${x(t).toFixed(1)},${y(v).toFixed(1)}`);
    }
    return pts.join(" ");
  }, [name, n, invert]);

  const dot = useRef<SVGCircleElement | null>(null);
  useEveryFrame(() => {
    const el = dot.current;
    if (!el) return;
    if (!readT) {
      el.setAttribute("visibility", "hidden");
      return;
    }
    // t is already curved and smoothed; place it on the output axis.
    const v = readT();
    const t = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
    el.setAttribute("visibility", "visible");
    el.setAttribute("cx", x(1).toFixed(1));
    el.setAttribute("cy", y(t).toFixed(1));
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn(
        "h-14 w-24 shrink-0 rounded border border-glass-border bg-black/40",
        className
      )}
      role="img"
      aria-label={`${name} curve${invert ? ", inverted" : ""}`}
    >
      <line
        x1={x(0)}
        y1={y(0)}
        x2={x(1)}
        y2={y(0)}
        stroke="rgba(255,255,255,0.15)"
      />
      <line
        x1={x(0)}
        y1={y(0)}
        x2={x(0)}
        y2={y(1)}
        stroke="rgba(255,255,255,0.15)"
      />
      <polyline
        points={points}
        fill="none"
        stroke="#00FFFF"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        ref={dot}
        r="3"
        fill="#FF00FF"
        visibility="hidden"
        cx={x(1)}
        cy={y(0)}
      />
    </svg>
  );
};
