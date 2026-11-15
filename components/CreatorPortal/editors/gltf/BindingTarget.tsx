// A binding's target (spec §4.3): kind, then the scene names and properties that kind takes.

import React from "react";
import { DEFAULT_LIMITS } from "../../../../lib/gltfVisualizer/core/limits";
import {
  AXES,
  Axis,
  BindingConfig,
  CAMERA_PROPERTIES,
  CameraProperty,
  CLIP_MODES,
  ClipMode,
  DEFAULT_AXIS,
  DEFAULT_CLIP_FADE_MS,
  DEFAULT_THRESHOLD,
  MATERIAL_PROPERTIES,
  MaterialProperty,
  NODE_PROPERTIES,
  NodeProperty,
  NodeTargetConfig,
  outputKeyOf,
  TARGET_KINDS,
  TargetConfig,
  TargetKind
} from "../../../../lib/gltfVisualizer/core/manifest";
import {
  defaultTarget,
  errorsAt,
  TargetChoices
} from "../../../../lib/gltfVisualizer/edit";
import {
  ColorField,
  FieldErrors,
  miniLabel,
  NumField,
  Option,
  Select
} from "./fields";

const KIND_LABEL: Record<TargetKind, string> = {
  clip: "Animation clip",
  morph: "Morph target",
  node: "Node",
  material: "Material",
  light: "Light",
  camera: "Camera"
};

const missing = (v: string) => (v ? `${v} (not in scene)` : "Pick one");
/** Option value for an unnamed morph, by index. */
const IDX = "\u0001";

/** play / trigger clip targets follow the threshold and take no outputRange. */
export const isTriggerLike = (t: TargetConfig | undefined): boolean =>
  !!t && t.kind === "clip" && (t.mode === "play" || t.mode === "trigger");

export const outputPlaceholder = (
  t: TargetConfig | undefined
): [number, number] | null => {
  const key = t && typeof t === "object" ? outputKeyOf(t) : null;
  if (!key) return null;
  const r = DEFAULT_LIMITS.outputDefaults[key];
  return [r[0], r[1]];
};

export const outputHint = (t: TargetConfig | undefined): string | undefined => {
  const key = t && typeof t === "object" ? outputKeyOf(t) : null;
  if (!key) return undefined;
  const b = DEFAULT_LIMITS.outputBounds[key];
  return `Within ${b[0]} to ${b[1]}`;
};

const Labelled: React.FC<{
  label: string;
  errors: readonly string[];
  path: string;
  children: React.ReactNode;
}> = ({ label, errors, path, children }) => (
  <label className="block min-w-0">
    <span className={miniLabel}>{label}</span>
    {children}
    <FieldErrors errors={errors} path={path} />
  </label>
);

export const BindingTarget: React.FC<{
  binding: BindingConfig;
  index: number;
  onChange: (b: BindingConfig) => void;
  errors: readonly string[];
  choices: TargetChoices;
}> = ({ binding: b, index: i, onChange, errors, choices }) => {
  const t = b.target;
  const p = `audio.bindings[${i}].target`;
  const bad = (k: string) => errorsAt(errors, `${p}.${k}`).length > 0;
  const kind: TargetKind =
    t && (TARGET_KINDS as readonly string[]).includes(t.kind) ? t.kind : "node";

  const setTarget = (next: TargetConfig, dropOutput = false) => {
    const nb: BindingConfig = { ...b, target: next };
    if (dropOutput || isTriggerLike(next)) delete nb.outputRange;
    onChange(nb);
  };

  const fields: React.ReactNode[] = [];
  const sel = (
    key: string,
    label: string,
    value: string,
    options: readonly Option[],
    onPick: (v: string) => void
  ) =>
    fields.push(
      <Labelled key={key} label={label} errors={errors} path={`${p}.${key}`}>
        <Select
          label={`Binding ${i + 1} ${label}`}
          value={value}
          options={options}
          invalid={bad(key)}
          missingLabel={missing}
          onChange={onPick}
        />
      </Labelled>
    );

  if (t && t.kind === "clip") {
    sel("clip", "Clip", t.clip, choices.clips, (v) =>
      setTarget({ ...t, clip: v })
    );
    sel("mode", "Mode", t.mode, CLIP_MODES, (v) => {
      const mode = v as ClipMode;
      const next = { ...t, mode };
      if (mode !== "play" && mode !== "trigger") {
        delete next.threshold;
        delete next.fadeMs;
      }
      setTarget(next, true);
    });
    if (t.mode === "play" || t.mode === "trigger") {
      fields.push(
        <NumField
          key="threshold"
          label="Threshold"
          value={t.threshold}
          placeholder={String(DEFAULT_THRESHOLD)}
          onCommit={(v) => {
            const next = { ...t, threshold: v };
            if (v === undefined) delete next.threshold;
            setTarget(next);
          }}
          errors={errors}
          path={`${p}.threshold`}
        />,
        <NumField
          key="fadeMs"
          label="Fade"
          unit="ms"
          value={t.fadeMs}
          placeholder={String(DEFAULT_CLIP_FADE_MS)}
          onCommit={(v) => {
            const next = { ...t, fadeMs: v };
            if (v === undefined) delete next.fadeMs;
            setTarget(next);
          }}
          errors={errors}
          path={`${p}.fadeMs`}
        />
      );
    }
  } else if (t && t.kind === "morph") {
    sel(
      "mesh",
      "Mesh",
      t.mesh,
      choices.morphMeshes.map((m) => m.name),
      (v) => {
        const m = choices.morphMeshes.find((x) => x.name === v);
        const named = m ? m.morphs.find((x) => x !== "") : undefined;
        setTarget({ ...t, mesh: v, morph: named !== undefined ? named : 0 });
      }
    );
    const morphs =
      choices.morphMeshes.find((m) => m.name === t.mesh)?.morphs || [];
    sel(
      "morph",
      "Morph",
      typeof t.morph === "number" ? `${IDX}${t.morph}` : t.morph,
      morphs.map((m, j) =>
        m === ""
          ? { value: `${IDX}${j}`, label: `#${j} (unnamed)` }
          : { value: m, label: m }
      ),
      (v) =>
        setTarget({
          ...t,
          morph: v.startsWith(IDX) ? Number(v.slice(IDX.length)) : v
        })
    );
  } else if (t && t.kind === "node") {
    sel("node", "Node", t.node, choices.nodes, (v) =>
      setTarget({ ...t, node: v })
    );
    sel("property", "Property", t.property, NODE_PROPERTIES, (v) =>
      setTarget({ ...t, property: v as NodeProperty }, true)
    );
    sel(
      "axis",
      "Axis",
      t.axis || "",
      [
        { value: "", label: `Default (${DEFAULT_AXIS[t.property] || "y"})` },
        ...AXES.map((a) => ({ value: a, label: a }))
      ],
      (v) => {
        const next: NodeTargetConfig = { ...t, axis: v as Axis };
        if (!v) delete next.axis;
        setTarget(next);
      }
    );
  } else if (t && t.kind === "material") {
    sel("material", "Material", t.material, choices.materials, (v) =>
      setTarget({ ...t, material: v })
    );
    sel("property", "Property", t.property, MATERIAL_PROPERTIES, (v) => {
      const property = v as MaterialProperty;
      const next = { ...t, property };
      if (property === "color" || property === "emissiveColor") {
        if (!next.colors) next.colors = ["#000000", "#FFFFFF"];
      } else delete next.colors;
      setTarget(next, true);
    });
    if (t.property === "color" || t.property === "emissiveColor") {
      const colors = t.colors || ["#000000", "#FFFFFF"];
      fields.push(
        <div key="colors" className="col-span-2 min-w-0">
          <span className={miniLabel}>Colours (low → high)</span>
          <div className="grid grid-cols-2 gap-1.5">
            {([0, 1] as const).map((k) => (
              <ColorField
                key={k}
                label={`Binding ${i + 1} colour ${k === 0 ? "low" : "high"}`}
                value={colors[k]}
                invalid={bad(`colors[${k}]`)}
                onChange={(c) => {
                  const next: [string, string] = [colors[0], colors[1]];
                  next[k] = c;
                  setTarget({ ...t, colors: next });
                }}
              />
            ))}
          </div>
          <FieldErrors errors={errors} path={`${p}.colors`} />
        </div>
      );
    }
  } else if (t && t.kind === "light") {
    sel("light", "Light", t.light, choices.lights, (v) =>
      setTarget({ ...t, light: v })
    );
  } else if (t && t.kind === "camera") {
    sel("property", "Property", t.property, CAMERA_PROPERTIES, (v) =>
      setTarget({ ...t, property: v as CameraProperty }, true)
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-4">
        <Labelled label="Target" errors={errors} path={`${p}.kind`}>
          <Select
            label={`Binding ${i + 1} target kind`}
            value={kind}
            options={TARGET_KINDS.map((k) => ({
              value: k,
              label: KIND_LABEL[k]
            }))}
            invalid={bad("kind")}
            onChange={(v) =>
              setTarget(defaultTarget(v as TargetKind, choices), true)
            }
          />
        </Labelled>
        {fields}
      </div>
    </div>
  );
};
