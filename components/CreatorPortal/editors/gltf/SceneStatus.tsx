// The scene's file, poster, stats and problems: what the creator picked, whether it fits the
// app's limits, and every error the validator or the loader found.

import React, { useEffect, useState } from "react";
import { Camera, Check, ImageUp, RotateCcw, X } from "lucide-react";
import { cn } from "@lib/utils";
import type { SceneStats } from "../../../../lib/gltfVisualizer/core/glb";
import { DEFAULT_LIMITS } from "../../../../lib/gltfVisualizer/core/limits";
import { errorMessage, errorPath } from "../../../../lib/gltfVisualizer/edit";
import { formatBytes } from "../../../../lib/marketplace";
import { btnGhost, numCls } from "../../kit";
import type { UploadJob } from "../../uploads";
import { panelTitle } from "./fields";

const L = DEFAULT_LIMITS;
const compact = (n: number) =>
  n >= 10000
    ? `${Math.round(n / 1000)}k`
    : n >= 1000
    ? `${(n / 1000).toFixed(1)}k`
    : String(n);

/** Upload state of a job, small. */
export const JobState: React.FC<{
  job: UploadJob;
  onRetry: (key: string) => void;
  onRemove: (key: string) => void;
}> = ({ job, onRetry, onRemove }) => (
  <span className="inline-flex shrink-0 items-center gap-1">
    {(job.status === "uploading" || job.status === "queued") && (
      <span
        className="h-1 w-16 overflow-hidden rounded bg-white/10"
        role="progressbar"
        aria-label={`Uploading ${job.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(job.progress * 100)}
      >
        <span
          className="block h-full bg-neon-cyan transition-[width]"
          style={{ width: `${Math.round(job.progress * 100)}%` }}
        />
      </span>
    )}
    {job.status === "done" && (
      <Check className="h-4 w-4 text-neon-lime" aria-label="Uploaded" />
    )}
    {job.status === "error" && (
      <button
        type="button"
        onClick={() => onRetry(job.key)}
        className="rounded p-1 text-white/60 hover:text-white"
        aria-label={`Retry ${job.name}`}
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    )}
    <button
      type="button"
      onClick={() => onRemove(job.key)}
      className="rounded p-1 text-white/60 hover:text-neon-pink"
      aria-label={`Remove ${job.name}`}
    >
      <X className="h-4 w-4" />
    </button>
  </span>
);

/** One row of the stats grid, pink when over the limit. */
const StatCell: React.FC<{
  label: string;
  value: number;
  max?: number;
  text?: string;
}> = ({ label, value, max, text }) => {
  const over = max !== undefined && value > max;
  return (
    <div className="min-w-0">
      <div className="font-mono-semibold text-[11px] text-white/60">
        {label}
      </div>
      <div
        className={cn(
          numCls,
          "truncate text-sm",
          over ? "text-neon-pink" : "text-white"
        )}
        title={
          max !== undefined ? `limit ${max.toLocaleString("en-US")}` : undefined
        }
      >
        {text || compact(value)}
        {max !== undefined && (
          <span className="text-[11px] text-white/60"> / {compact(max)}</span>
        )}
      </div>
    </div>
  );
};

export const StatsPanel: React.FC<{
  stats: SceneStats;
  drawCalls?: number | null;
}> = ({ stats, drawCalls }) => {
  const draws = drawCalls ?? stats.drawCalls;
  return (
    <section
      className="rounded-md border border-glass-border bg-white/[0.02] p-3"
      aria-label="Stats"
    >
      <h3 className={cn(panelTitle, "mb-2")}>Stats</h3>
      <div className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-4">
        <StatCell
          label="triangles"
          value={stats.triangles}
          max={L.maxTriangles}
        />
        <StatCell label="vertices" value={stats.vertices} max={L.maxVertices} />
        <StatCell label="draw calls" value={draws} max={L.maxDrawCalls} />
        <StatCell
          label="textures"
          value={stats.images.length}
          max={L.maxImages}
        />
        <StatCell
          label="clips"
          value={stats.clips.length}
          max={L.maxAnimations}
        />
        <StatCell label="morphs" value={stats.morphTargets} />
        <StatCell label="lights" value={stats.lights} max={L.maxLights} />
        <StatCell
          label="materials"
          value={stats.materials}
          max={L.maxMaterials}
        />
      </div>
      {stats.clips.length > 0 && (
        <p className="mt-2 font-mono-semibold text-[11px] leading-relaxed text-white/60">
          {stats.clips
            .map((c) => `${c.name || "(unnamed)"} ${c.duration.toFixed(2)} s`)
            .join(" · ")}
        </p>
      )}
    </section>
  );
};

/** Every problem, path first; each control shows its own too. */
export const ErrorList: React.FC<{ errors: string[] }> = ({ errors }) =>
  errors.length ? (
    <section
      className="rounded-md border border-neon-pink/30 bg-neon-pink/[0.04] p-3"
      aria-label="Problems"
    >
      <h3 className={cn(panelTitle, "mb-1.5 text-neon-pink")}>
        Problems <span className={numCls}>{errors.length}</span>
      </h3>
      <ul className="max-h-56 space-y-1 overflow-auto pr-1">
        {errors.map((e) => (
          <li
            key={e}
            className="font-body-bold text-xs leading-snug text-white/80"
          >
            {errorPath(e) && (
              <span className="mr-1 font-mono-semibold text-[11px] text-neon-pink">
                {errorPath(e)}
              </span>
            )}
            {errorMessage(e)}
          </li>
        ))}
      </ul>
    </section>
  ) : null;

/** The poster: an uploaded png/jpg/webp ≤ 2 MB, or the preview's current frame. */
export const PosterBox: React.FC<{
  job: UploadJob | null;
  url: string | null;
  canCapture: boolean;
  onPick: (file: File) => void;
  onCapture: () => void;
  onRetry: (key: string) => void;
  onRemove: (key: string) => void;
  note?: string | null;
}> = ({ job, url, canCapture, onPick, onCapture, onRetry, onRemove, note }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!job?.file) {
      setObjectUrl(null);
      return;
    }
    const u = URL.createObjectURL(job.file);
    setObjectUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [job?.file]);
  const src = objectUrl || url;
  return (
    <section
      className="rounded-md border border-glass-border bg-white/[0.02] p-3"
      aria-label="Poster"
    >
      <div className="flex items-center gap-3">
        <div className="flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded border border-glass-border bg-black">
          {src ? (
            <img
              src={src}
              alt="Poster"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageUp className="h-5 w-5 text-white/60" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={panelTitle}>Poster</h3>
          {job ? (
            <div className="mt-0.5 flex items-center gap-2">
              <span className="truncate font-body-bold text-xs text-white/80">
                {job.name}
              </span>
              <span className={cn(numCls, "text-[11px] text-white/60")}>
                {formatBytes(job.size)}
              </span>
              <JobState job={job} onRetry={onRetry} onRemove={onRemove} />
            </div>
          ) : (
            <p className="mt-0.5 font-body-bold text-xs text-white/60">
              Optional: the still shown while loading, in the Library and in
              review.
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <label className={cn(btnGhost, "cursor-pointer px-2 py-1 text-xs")}>
              <ImageUp className="h-3.5 w-3.5" aria-hidden /> Upload
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPick(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className={cn(btnGhost, "px-2 py-1 text-xs")}
              disabled={!canCapture}
              onClick={onCapture}
              title={
                canCapture
                  ? "Use the preview's current frame"
                  : "Load a scene first"
              }
            >
              <Camera className="h-3.5 w-3.5" aria-hidden /> Capture frame
            </button>
          </div>
          {note && (
            <p className="mt-1 font-body-bold text-[11px] text-neon-amber">
              {note}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
