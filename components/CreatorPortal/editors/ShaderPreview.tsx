import React, { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@lib/utils";
import { ShaderRunner, ParamSpec } from "../../../lib/shader/preview";
import { numCls } from "../kit";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Live WebGL1 preview with the app's prelude and uniforms. The music is
 * simulated (a pulse at the chosen tempo), so drives can be checked without
 * audio. With Reduce Motion it draws one still frame until you press play;
 * it pauses off screen, and recompiles when the browser restores a lost GPU
 * context.
 */
export const ShaderPreview: React.FC<{
  source: string | null;
  params: ParamSpec[];
}> = ({ source, params }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runnerRef = useRef<ShaderRunner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [manual, setManual] = useState<Record<string, number>>({});
  const [supported, setSupported] = useState(true);
  const [lost, setLost] = useState(false);
  // Bumped when a lost context comes back, to compile again.
  const [contextEpoch, setContextEpoch] = useState(0);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const runner = new ShaderRunner(canvas);
    runnerRef.current = runner;
    setSupported(runner.supported);
    runner.onStall = () => {
      setStalled(true);
      setPlaying(false);
    };
    const onLost = (e: Event) => {
      e.preventDefault(); // lets the browser restore it
      runner.contextLost();
      setPlaying(false);
      setLost(true);
    };
    const onRestored = () => {
      setLost(false);
      setContextEpoch((n) => n + 1);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      try {
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
        runner.dispose();
      } catch {
        // never throw from cleanup
      }
      runnerRef.current = null;
    };
  }, []);

  // Compile when the source or the params change, or the context comes back.
  useEffect(() => {
    const runner = runnerRef.current;
    if (!runner || !runner.supported || lost) return;
    runner.stop();
    setStalled(false);
    if (!source) {
      setError(null);
      setPlaying(false);
      return;
    }
    runner.manual = manual;
    runner.bpm = bpm;
    const res = runner.compile(source, JSON.parse(paramsKey));
    if (!res.ok) {
      setError(res.error);
      setPlaying(false);
      return;
    }
    setError(null);
    if (prefersReducedMotion()) {
      runner.drawStill();
      setPlaying(false);
    } else {
      runner.play();
      setPlaying(true);
    }
    // manual and bpm are pushed by their own effect below.
  }, [source, paramsKey, contextEpoch, lost]);

  useEffect(() => {
    const r = runnerRef.current;
    if (!r) return;
    r.bpm = bpm;
    r.manual = manual;
    // Paused: show the new settings on a still frame.
    if (!r.playing) r.drawStill();
  }, [bpm, manual]);

  // Pause off screen.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      const r = runnerRef.current;
      if (!r) return;
      if (!entry.isIntersecting && r.playing) {
        r.stop();
        setPlaying(false);
      }
    });
    io.observe(canvas);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const r = runnerRef.current;
    if (!r || error || lost) return;
    if (r.playing) {
      r.stop();
      setPlaying(false);
    } else {
      setStalled(false);
      r.play();
      setPlaying(true);
    }
  };

  const overlay = !supported
    ? "WebGL isn't available in this browser, so there's no live preview."
    : lost
    ? "The graphics card dropped the preview. It comes back on its own; if it doesn't, reload the page."
    : !source
    ? "Add a .glsl file to see it here."
    : stalled
    ? "The preview stopped: frames took over 50 ms. The app would fall back to its default scene. Simplify the shader and press play."
    : error
    ? "The shader didn't compile. See the log below."
    : null;

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-md border border-glass-border bg-black">
        <canvas
          ref={canvasRef}
          className="block aspect-video w-full"
          aria-label="Visualizer preview"
        />
        {overlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center font-body-bold text-sm text-white/80">
            {overlay}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!source || !!error || !supported || lost}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-glass-border text-neon-cyan hover:border-neon-cyan/60 disabled:opacity-30"
          aria-label={playing ? "Pause preview" : "Play preview"}
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        <label className="flex items-center gap-2 font-title-condensed text-xs text-white/70">
          Tempo
          <input
            type="range"
            min={60}
            max={180}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-24 accent-neon-cyan"
          />
          <span className={`${numCls} w-14 text-white/80`}>{bpm} BPM</span>
        </label>
      </div>

      {params.length > 0 && (
        <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {params.map((p) => {
            const v = manual[p.name] ?? p.default;
            const valid =
              Number.isFinite(p.min) && Number.isFinite(p.max) && p.min < p.max;
            return (
              <label
                key={p.name}
                className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-2 font-title-condensed text-xs text-white/70"
              >
                <span className="truncate">
                  {p.name}
                  {p.drive && (
                    <span className="text-neon-magenta"> · {p.drive}</span>
                  )}
                </span>
                <input
                  type="range"
                  min={valid ? p.min : 0}
                  max={valid ? p.max : 1}
                  step={valid ? (p.max - p.min) / 200 : 0.01}
                  value={v}
                  disabled={!valid}
                  onChange={(e) =>
                    setManual((m) => ({
                      ...m,
                      [p.name]: Number(e.target.value)
                    }))
                  }
                  className="w-full accent-neon-cyan"
                />
                <span className={cn(numCls, "text-right text-white/80")}>
                  {Number.isFinite(v) ? +v.toFixed(2) : "—"}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {error && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-neon-pink/30 bg-neon-pink/[0.05] p-2 font-mono-semibold text-xs text-neon-pink">
          {error}
        </pre>
      )}
    </div>
  );
};
