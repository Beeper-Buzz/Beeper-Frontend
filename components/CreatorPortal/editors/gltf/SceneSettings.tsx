// Idle clips (§4.4), toon material overrides (§4.7) and the view (§4.8). Each editor writes a
// minimal manifest: unset fields and empty objects are left out so the defaults apply.

import React from "react";
import { Crosshair, Plus, RotateCcw, X } from "lucide-react";
import { cn } from "@lib/utils";
import { DEFAULT_LIMITS } from "../../../../lib/gltfVisualizer/core/limits";
import {
  DEFAULT_BACKGROUND,
  DEFAULT_CAMERA,
  DEFAULT_EXPOSURE,
  DEFAULT_OUTLINE_COLOR
} from "../../../../lib/gltfVisualizer/core/manifest";
import type {
  GltfConfig,
  TargetChoices
} from "../../../../lib/gltfVisualizer/edit";
import { btnGhost, numCls } from "../../kit";
import {
  ColorField,
  FieldErrors,
  hasErrors,
  IconButton,
  miniLabel,
  newRowId,
  NumField,
  Segmented,
  Select,
  useRowIds
} from "./fields";

const missing = (v: string) => `${v || "—"} (not in scene)`;
const addBtn = cn(btnGhost, "px-2 py-1 font-body-bold text-xs");

/** Drops undefined values; null when nothing is left. */
function compact<T extends object>(o: T): T | undefined {
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    out[k] = v;
    n++;
  }
  return n ? (out as T) : undefined;
}

// ---------------------------------------------------------------------------------------------
// Idle

type Idle = NonNullable<GltfConfig["audio"]["idle"]>;

export const IdleEditor: React.FC<{
  idle: Idle | undefined;
  onChange: (next: Idle | undefined) => void;
  errors: readonly string[];
  choices: TargetChoices;
}> = ({ idle, onChange, errors, choices }) => {
  const clips = idle?.clips || [];
  const { ids, track } = useRowIds(clips);
  const set = (next: Idle["clips"], nextIds: string[] = ids) => {
    track(next, nextIds);
    onChange(next.length ? { clips: next } : undefined);
  };
  return (
    <div className="space-y-2">
      <h3 className="sr-only">Idle</h3>
      <p className="font-body-bold text-xs text-white/60">
        Idle clips loop from load whatever the music (a fan, breathing). If
        nothing names a clip, the first animation loops.
      </p>
      <FieldErrors errors={errors} path="audio.idle" exact />
      <FieldErrors errors={errors} path="audio.idle.clips" exact />
      {clips.map((c, i) => {
        const path = `audio.idle.clips[${i}]`;
        return (
          <div
            key={ids[i]}
            className="grid grid-cols-[1fr_6rem_auto] items-end gap-2"
          >
            <label className="block min-w-0">
              <span className={miniLabel}>Clip</span>
              <Select
                label={`Idle clip ${i + 1}`}
                value={c.clip}
                options={choices.clips}
                invalid={hasErrors(errors, `${path}.clip`)}
                missingLabel={missing}
                onChange={(v) =>
                  set(clips.map((x, j) => (j === i ? { ...x, clip: v } : x)))
                }
              />
            </label>
            <NumField
              label="Speed"
              unit="×"
              value={c.timeScale}
              placeholder="1"
              onCommit={(v) =>
                set(
                  clips.map((x, j) =>
                    j === i ? (compact({ ...x, timeScale: v }) as typeof x) : x
                  )
                )
              }
            />
            <IconButton
              label={`Remove idle clip ${i + 1}`}
              className="mb-0.5 hover:text-neon-pink"
              onClick={() =>
                set(
                  clips.filter((_, j) => j !== i),
                  ids.filter((_, j) => j !== i)
                )
              }
            >
              <X className="h-4 w-4" />
            </IconButton>
            <FieldErrors
              errors={errors}
              path={path}
              className="col-span-3 -mt-1"
            />
          </div>
        );
      })}
      <button
        type="button"
        className={addBtn}
        disabled={
          clips.length >= DEFAULT_LIMITS.maxIdleClips || !choices.clips.length
        }
        onClick={() =>
          set(
            [...clips, { clip: choices.clips[0] || "" }],
            [...ids, newRowId()]
          )
        }
      >
        <Plus className="h-3.5 w-3.5" /> Add idle clip
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Materials (toon)

type Materials = NonNullable<GltfConfig["materials"]>;
type MaterialOverride = Materials[number];

export const MaterialsEditor: React.FC<{
  materials: GltfConfig["materials"];
  onChange: (next: GltfConfig["materials"] | undefined) => void;
  errors: readonly string[];
  choices: TargetChoices;
}> = ({ materials, onChange, errors, choices }) => {
  const list = materials || [];
  const { ids, track } = useRowIds(list);
  const set = (next: Materials, nextIds: string[] = ids) => {
    track(next, nextIds);
    onChange(next.length ? next : undefined);
  };
  const patch = (i: number, m: MaterialOverride) =>
    set(list.map((x, j) => (j === i ? m : x)));
  const options = [
    { value: "*", label: "All materials" },
    ...choices.materials
  ];
  return (
    <div className="space-y-2">
      <h3 className="sr-only">Toon materials</h3>
      <p className="font-body-bold text-xs text-white/60">
        Banded cel shading, with an optional ink outline. A named material wins
        over “All materials”.
      </p>
      <FieldErrors errors={errors} path="materials" exact />
      {list.map((m, i) => {
        const path = `materials[${i}]`;
        const outline = m.toon?.outline;
        return (
          <div
            key={ids[i]}
            className={cn(
              "space-y-2 rounded-md border p-2",
              hasErrors(errors, path)
                ? "border-neon-pink/40"
                : "border-glass-border"
            )}
          >
            <div className="grid grid-cols-[1fr_5rem_auto] items-end gap-2">
              <label className="block min-w-0">
                <span className={miniLabel}>Material</span>
                <Select
                  label={`Override ${i + 1} material`}
                  value={m.material}
                  options={options}
                  invalid={hasErrors(errors, `${path}.material`)}
                  missingLabel={missing}
                  onChange={(v) => patch(i, { ...m, material: v })}
                />
              </label>
              <NumField
                label="Steps"
                value={m.toon?.steps}
                placeholder="3"
                onCommit={(v) =>
                  patch(i, { ...m, toon: { ...m.toon, steps: v ?? NaN } })
                }
              />
              <IconButton
                label={`Remove override ${i + 1}`}
                className="mb-0.5 hover:text-neon-pink"
                onClick={() =>
                  set(
                    list.filter((_, j) => j !== i),
                    ids.filter((_, j) => j !== i)
                  )
                }
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <label className="flex items-center gap-2 font-body-bold text-xs text-white/70">
              <input
                type="checkbox"
                className="accent-neon-cyan"
                checked={!!outline}
                onChange={(e) =>
                  patch(i, {
                    ...m,
                    toon: compact({
                      ...m.toon,
                      outline: e.target.checked ? { width: 0.006 } : undefined
                    }) as MaterialOverride["toon"]
                  })
                }
              />
              Outline
            </label>
            {outline && (
              <div className="grid grid-cols-2 gap-2">
                <NumField
                  label="Width"
                  unit="× radius"
                  value={outline.width}
                  hint="0.001–0.05 of the scene's radius"
                  onCommit={(v) =>
                    patch(i, {
                      ...m,
                      toon: {
                        ...m.toon,
                        outline: { ...outline, width: v ?? NaN }
                      }
                    })
                  }
                />
                <label className="block min-w-0">
                  <span className={miniLabel}>Colour</span>
                  <ColorField
                    label={`Override ${i + 1} outline colour`}
                    value={outline.color}
                    placeholder={DEFAULT_OUTLINE_COLOR}
                    invalid={hasErrors(errors, `${path}.toon.outline.color`)}
                    onChange={(v) =>
                      patch(i, {
                        ...m,
                        toon: {
                          ...m.toon,
                          outline: compact({
                            ...outline,
                            color: v || undefined
                          }) as typeof outline
                        }
                      })
                    }
                  />
                </label>
              </div>
            )}
            <FieldErrors errors={errors} path={path} />
          </div>
        );
      })}
      <button
        type="button"
        className={addBtn}
        disabled={list.length >= DEFAULT_LIMITS.maxMaterialOverrides}
        onClick={() =>
          set(
            [
              ...list,
              {
                material: list.some((x) => x.material === "*")
                  ? choices.materials.find(
                      (n) => !list.some((x) => x.material === n)
                    ) || ""
                  : "*",
                toon: { steps: 3 }
              }
            ],
            [...ids, newRowId()]
          )
        }
      >
        <Plus className="h-3.5 w-3.5" /> Add toon override
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// View

type View = NonNullable<GltfConfig["view"]>;
type Camera = NonNullable<View["camera"]>;
type Framing = "fov" | "distance" | "elevation" | "azimuth" | "orbitSpeed";

const SLIDERS: {
  field: Framing;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  {
    field: "fov",
    label: "Field of view",
    min: 20,
    max: 90,
    step: 1,
    unit: "°"
  },
  {
    field: "distance",
    label: "Distance",
    min: 0.5,
    max: 10,
    step: 0.05,
    unit: "×"
  },
  {
    field: "elevation",
    label: "Elevation",
    min: -80,
    max: 80,
    step: 1,
    unit: "°"
  },
  {
    field: "azimuth",
    label: "Azimuth",
    min: -180,
    max: 180,
    step: 1,
    unit: "°"
  }
];
const ORBIT = {
  label: "Orbit",
  min: -90,
  max: 90,
  step: 1,
  unit: "°/s"
};

const Slider: React.FC<{
  label: string;
  value: number | undefined;
  def: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number | undefined) => void;
  errors: readonly string[];
  path: string;
}> = ({ label, value, def, min, max, step, unit, onChange, errors, path }) => {
  const shown = value ?? def;
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-1">
        <span className={miniLabel}>{label}</span>
        <span className="flex items-center gap-1">
          <span
            className={cn(
              numCls,
              "text-[11px]",
              value === undefined ? "text-white/60" : "text-white"
            )}
          >
            {+shown.toFixed(2)}
            {unit}
          </span>
          {value !== undefined && (
            <IconButton
              label={`Reset ${label}`}
              className="h-5 w-5"
              onClick={() => onChange(undefined)}
            >
              <RotateCcw className="h-3 w-3" />
            </IconButton>
          )}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(shown) ? shown : def}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-neon-cyan"
      />
      <FieldErrors errors={errors} path={path} />
    </div>
  );
};

export const ViewEditor: React.FC<{
  view: GltfConfig["view"];
  onChange: (next: GltfConfig["view"] | undefined) => void;
  errors: readonly string[];
  choices: TargetChoices;
  onCameraFromView?: () => void;
  canCameraFromView: boolean;
}> = ({
  view,
  onChange,
  errors,
  choices,
  onCameraFromView,
  canCameraFromView
}) => {
  const v: View = view || {};
  const cam: Camera = v.camera || {};
  const setView = (next: View) => onChange(compact(next));
  const setCam = (next: Camera) => setView({ ...v, camera: compact(next) });
  const nodeMode = cam.node !== undefined;
  const hasCameras = choices.cameras.length > 0;

  return (
    <div className="space-y-3">
      <h3 className="sr-only">View</h3>
      <FieldErrors errors={errors} path="view" exact />
      <FieldErrors errors={errors} path="view.camera" exact />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className={miniLabel}>Background</span>
          <ColorField
            label="Background colour"
            value={v.background}
            placeholder={DEFAULT_BACKGROUND}
            invalid={hasErrors(errors, "view.background")}
            onChange={(c) => setView({ ...v, background: c || undefined })}
          />
          <FieldErrors errors={errors} path="view.background" />
        </label>
        <div className="min-w-0">
          <span className={miniLabel}>Lighting</span>
          <Segmented
            label="Lighting"
            value={v.lighting || "studio"}
            options={[
              { value: "studio", label: "Studio" },
              { value: "scene", label: "The scene's lights" }
            ]}
            onChange={(l) =>
              setView({ ...v, lighting: l === "studio" ? undefined : "scene" })
            }
          />
          <p className="mt-1 font-body-bold text-[11px] text-white/60">
            {v.lighting === "scene"
              ? "Only the GLB's KHR_lights_punctual lights, plus a faint ambient."
              : "Key, rim and sky lights around the scene."}
          </p>
        </div>
      </div>
      <Slider
        label="Exposure"
        value={v.exposure}
        def={DEFAULT_EXPOSURE}
        min={0.25}
        max={4}
        step={0.05}
        unit="×"
        errors={errors}
        path="view.exposure"
        onChange={(x) => setView({ ...v, exposure: x })}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Camera"
          value={nodeMode ? "node" : "framing"}
          options={
            hasCameras || nodeMode
              ? [
                  { value: "framing", label: "Framing" },
                  { value: "node", label: "glTF camera" }
                ]
              : [{ value: "framing", label: "Framing" }]
          }
          onChange={(m) =>
            m === "node"
              ? setCam({
                  node: choices.cameras[0] || "",
                  orbitSpeed: cam.orbitSpeed
                })
              : setCam({ ...cam, node: undefined })
          }
        />
        {!nodeMode && (
          <button
            type="button"
            className={cn(btnGhost, "px-2 py-1 font-body-bold text-xs")}
            disabled={!canCameraFromView || !onCameraFromView}
            title={
              canCameraFromView
                ? "Use the inspect camera's angle and distance"
                : "Turn on Inspect in the preview, frame the shot, then press this"
            }
            onClick={onCameraFromView}
          >
            <Crosshair className="h-3.5 w-3.5" /> Camera from view
          </button>
        )}
      </div>
      {nodeMode ? (
        <label className="block">
          <span className={miniLabel}>Camera node</span>
          <Select
            label="Camera node"
            value={cam.node || ""}
            options={choices.cameras}
            invalid={hasErrors(errors, "view.camera.node")}
            missingLabel={missing}
            onChange={(n) => setCam({ ...cam, node: n })}
          />
          <FieldErrors errors={errors} path="view.camera.node" />
        </label>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {SLIDERS.map(({ field, ...s }) => (
            <Slider
              key={field}
              {...s}
              value={cam[field]}
              def={DEFAULT_CAMERA[field]}
              errors={errors}
              path={`view.camera.${field}`}
              onChange={(x) => setCam({ ...cam, [field]: x })}
            />
          ))}
        </div>
      )}
      <Slider
        {...ORBIT}
        value={cam.orbitSpeed}
        def={DEFAULT_CAMERA.orbitSpeed}
        errors={errors}
        path="view.camera.orbitSpeed"
        onChange={(x) => setCam({ ...cam, orbitSpeed: x })}
      />
    </div>
  );
};
