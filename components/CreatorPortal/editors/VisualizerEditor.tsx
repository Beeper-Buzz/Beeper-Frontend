import React, { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@lib/utils";
import type {
  DraftFile,
  ProductDraft
} from "../../../lib/creator/productDraft";
import {
  checkShaderSource,
  MAX_VIZ_PARAMS,
  VIZ_DRIVES,
  VIZ_PARAM_NAME_RE,
  VizParamDraft
} from "../../../lib/manifests/visualizer";
import { extensionOf } from "../../../lib/upload/directUpload";
import { btnGhost, inputCls, labelCls, numCls, selectCls } from "../kit";
import { ShaderPreview } from "./ShaderPreview";

const small = cn(inputCls, "px-2 py-1.5 text-[13px]");

const CONTRACT = `// Your file defines this; the host adds precision, uniforms and main().
// uTime  uResolution  uBass uMid uHigh uLevel (0..1)  uBeat  uBeatPhase
// uP_<name> for each parameter below
vec4 beeperMain(vec2 uv) {
  float r = length(uv - 0.5);
  float ring = smoothstep(0.02, 0.0, abs(r - 0.2 - 0.15 * uBass));
  return vec4(vec3(0.0, 1.0, 1.0) * ring + uBeat * 0.1, 1.0);
}`;

export const VisualizerEditor: React.FC<{
  draft: ProductDraft;
  setDraft: (fn: (d: ProductDraft) => ProductDraft) => void;
  files: DraftFile[];
  sourceFor: (f: DraftFile) => Blob | string | null;
}> = ({ draft, setDraft, files, sourceFor }) => {
  const glsl = files.filter(
    (f) => extensionOf(f.name) === "glsl" && f.status !== "error"
  );
  const current = glsl.find((f) => f.name === draft.shader) || glsl[0] || null;
  const [source, setSource] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const src = current ? sourceFor(current) : null;
  const currentKey = current?.key || null;
  useEffect(() => {
    let alive = true;
    setLoadError(null);
    if (!src) {
      setSource(null);
      if (currentKey) setLoadError("Re-upload this file to preview it here.");
      return;
    }
    (typeof src === "string"
      ? fetch(src).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.text();
        })
      : src.text()
    )
      .then((t) => alive && setSource(t))
      .catch(() => {
        if (!alive) return;
        setSource(null);
        setLoadError("Couldn't read the shader file.");
      });
    return () => {
      alive = false;
    };
  }, [src, currentKey]);

  const sourceErrors = useMemo(
    () => (source ? checkShaderSource(source) : []),
    [source]
  );

  // Only well-formed params reach the GPU.
  const previewParams = useMemo(
    () =>
      draft.vizParams
        .filter(
          (p, i, all) =>
            VIZ_PARAM_NAME_RE.test(p.name) &&
            all.findIndex((q) => q.name === p.name) === i &&
            Number.isFinite(p.min) &&
            Number.isFinite(p.max) &&
            Number.isFinite(p.default)
        )
        .map((p) => ({ ...p })),
    [draft.vizParams]
  );

  const setParam = (i: number, patch: Partial<VizParamDraft>) =>
    setDraft((d) => ({
      ...d,
      vizParams: d.vizParams.map((p, j) => (j === i ? { ...p, ...patch } : p))
    }));

  const numIn = (v: string) => (v.trim() === "" ? NaN : Number(v));

  return (
    <div className="space-y-4">
      {glsl.length > 1 && (
        <div className="sm:max-w-xs">
          <label htmlFor="viz-shader" className={labelCls}>
            Shader file
          </label>
          <select
            id="viz-shader"
            className={selectCls}
            value={current?.name || ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, shader: e.target.value }))
            }
          >
            {glsl.map((f) => (
              <option key={f.key} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <ShaderPreview
            source={sourceErrors.length ? null : source}
            params={previewParams}
          />
          {loadError && (
            <p className="mt-2 font-body text-xs text-white/50">{loadError}</p>
          )}
          {sourceErrors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {sourceErrors.map((e) => (
                <li key={e} className="font-body text-xs text-neon-pink">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={labelCls}>
              Parameters{" "}
              <span className={numCls}>
                {draft.vizParams.length}/{MAX_VIZ_PARAMS}
              </span>
            </span>
            <button
              type="button"
              className={cn(btnGhost, "px-2 py-1 text-xs")}
              disabled={draft.vizParams.length >= MAX_VIZ_PARAMS}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  vizParams: [
                    ...d.vizParams,
                    {
                      name: `param${d.vizParams.length + 1}`,
                      label: "",
                      min: 0,
                      max: 1,
                      default: 0.5
                    }
                  ]
                }))
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {draft.vizParams.length === 0 && (
            <p className="font-body text-xs text-white/45">
              Parameters become <code className="text-white/70">uP_name</code>{" "}
              uniforms. Give one a drive to move it with the music.
            </p>
          )}
          {draft.vizParams.map((p, i) => {
            const bad = !VIZ_PARAM_NAME_RE.test(p.name);
            return (
              <div
                key={i}
                className="grid grid-cols-6 gap-1.5 rounded-md border border-glass-border p-2"
              >
                <input
                  aria-label={`Parameter ${i + 1} name`}
                  className={cn(
                    small,
                    "col-span-3 font-mono-semibold",
                    bad && "border-neon-pink/60"
                  )}
                  value={p.name}
                  maxLength={24}
                  onChange={(e) => setParam(i, { name: e.target.value })}
                />
                <input
                  aria-label={`Parameter ${i + 1} label`}
                  placeholder="Label"
                  className={cn(small, "col-span-2")}
                  value={p.label || ""}
                  onChange={(e) => setParam(i, { label: e.target.value })}
                />
                <button
                  type="button"
                  className="justify-self-end rounded p-1 text-white/40 hover:text-neon-pink"
                  aria-label={`Remove parameter ${p.name}`}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      vizParams: d.vizParams.filter((_, j) => j !== i)
                    }))
                  }
                >
                  <X className="h-4 w-4" />
                </button>
                {(["min", "default", "max"] as const).map((k) => (
                  <input
                    key={k}
                    aria-label={`Parameter ${i + 1} ${k}`}
                    title={k}
                    placeholder={k}
                    type="number"
                    step="any"
                    className={cn(small, numCls, "col-span-1 min-w-0")}
                    value={Number.isFinite(p[k]) ? p[k] : ""}
                    onChange={(e) =>
                      setParam(i, { [k]: numIn(e.target.value) })
                    }
                  />
                ))}
                <select
                  aria-label={`Parameter ${i + 1} drive`}
                  className={cn(
                    selectCls,
                    "col-span-3 px-2 py-1.5 text-[13px]"
                  )}
                  value={p.drive || ""}
                  onChange={(e) =>
                    setParam(i, { drive: e.target.value || undefined })
                  }
                >
                  <option value="">No drive</option>
                  {VIZ_DRIVES.map((d) => (
                    <option key={d} value={d}>
                      Driven by {d}
                    </option>
                  ))}
                </select>
                {bad && (
                  <p className="col-span-6 font-body text-[11px] text-neon-pink">
                    Start with a lowercase letter; letters and digits only, up
                    to 24.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <details className="rounded-md border border-glass-border">
        <summary className="cursor-pointer px-3 py-2 font-body text-sm text-white/70">
          What the .glsl file contains
        </summary>
        <pre className="overflow-auto border-t border-glass-border p-3 font-mono-semibold text-[11px] leading-relaxed text-white/70">
          {CONTRACT}
        </pre>
        <p className="px-3 pb-3 font-body text-xs text-white/45">
          GLSL ES 1.00, up to 64 KB, no textures. No precision, uniform,
          attribute or varying declarations, no main() and no #version,
          #extension or #include.
        </p>
      </details>
    </div>
  );
};
