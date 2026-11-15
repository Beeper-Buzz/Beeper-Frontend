// What the studio's panels share while the preview runs: the demo groove (sources, transport,
// manual triggers), the current rig (binding outputs, for meters) and the preview's handle
// (poster capture, camera from view). Meters read values once per animation frame through one
// shared loop and write the DOM directly, so a running preview doesn't re-render React.

import React, { createContext, useContext, useEffect, useRef } from "react";
import { cn } from "@lib/utils";
import type { Rig } from "../../../../lib/gltfVisualizer/core/rig";
import type {
  DemoGroove,
  GrooveEvent
} from "../../../../lib/gltfVisualizer/demoGroove";
import type { GrooveSound } from "./grooveSound";

export interface PreviewHandle {
  /** The current frame as a JPEG, or null when there's no frame. */
  capturePoster(): Promise<Blob | null>;
  /** view.camera framing from the inspect camera; null when not inspecting. */
  cameraFromView(): {
    distance: number;
    elevation: number;
    azimuth: number;
  } | null;
}

export interface StudioLive {
  groove: DemoGroove;
  /** Optional sound for the groove's events (off until the creator turns it on). */
  sound: GrooveSound;
  rigRef: React.MutableRefObject<Rig | null>;
  previewRef: React.MutableRefObject<PreviewHandle | null>;
  /** The groove's note-ons since the preview's last frame (the rig offers them to its rules). */
  drainEvents(): GrooveEvent[];
}

export const LiveContext = createContext<StudioLive | null>(null);

export function useLive(): StudioLive {
  const live = useContext(LiveContext);
  if (!live) throw new Error("useLive outside the 3D scene studio");
  return live;
}

// One requestAnimationFrame loop for every meter on the page.
const subscribers = new Set<() => void>();
let frame = 0;
const loop = () => {
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch {
      // a meter must never break the others
    }
  });
  frame = subscribers.size ? requestAnimationFrame(loop) : 0;
};

/** Calls `fn` once per animation frame while mounted. */
export function useEveryFrame(fn: () => void): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const sub = () => ref.current();
    subscribers.add(sub);
    if (!frame && typeof requestAnimationFrame !== "undefined")
      frame = requestAnimationFrame(loop);
    return () => {
      subscribers.delete(sub);
    };
  }, []);
}

const clamp01 = (x: number) => (x > 0 ? (x < 1 ? x : 1) : 0);

/** A thin horizontal bar showing `read()` (0..1, or scaled by min/max). */
export const LiveMeter: React.FC<{
  read: () => number;
  min?: number;
  max?: number;
  label: string;
  className?: string;
  barClassName?: string;
}> = ({ read, min = 0, max = 1, label, className, barClassName }) => {
  const bar = useRef<HTMLDivElement | null>(null);
  useEveryFrame(() => {
    const el = bar.current;
    if (!el) return;
    const v = read();
    const t = max !== min ? clamp01((v - min) / (max - min)) : 0;
    el.style.transform = `scaleX(${Number.isFinite(t) ? t : 0})`;
  });
  return (
    <div
      className={cn(
        "h-1.5 overflow-hidden rounded-full bg-white/10",
        className
      )}
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      <div
        ref={bar}
        className={cn(
          "h-full w-full origin-left rounded-full bg-neon-cyan will-change-transform",
          barClassName
        )}
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
};

/** A number that follows `read()` every frame. */
export const LiveNumber: React.FC<{
  read: () => number;
  digits?: number;
  className?: string;
}> = ({ read, digits = 2, className }) => {
  const el = useRef<HTMLSpanElement | null>(null);
  useEveryFrame(() => {
    if (!el.current) return;
    const v = read();
    const text = Number.isFinite(v) ? v.toFixed(digits) : "—";
    if (el.current.textContent !== text) el.current.textContent = text;
  });
  return (
    <span ref={el} className={cn("font-mono-semibold tabular-nums", className)}>
      —
    </span>
  );
};
