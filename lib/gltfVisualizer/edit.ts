// Pure helpers for the 3D-scene studio: the editable config and its manifest, error paths,
// binding sources, the names a scene offers, readable summaries and camera framing.

import type { SceneSummary } from "./core/glb";
import { DEFAULT_LIMITS } from "./core/limits";
import {
  BindingConfig,
  CombineMode,
  GltfVisualizerManifest,
  NoteClipRuleConfig,
  outputKeyOf,
  SourceName,
  TargetConfig,
  TargetKind
} from "./core/manifest";

/** What the studio edits: the manifest minus the envelope and the file names. */
export interface GltfConfig {
  view?: GltfVisualizerManifest["view"];
  materials?: GltfVisualizerManifest["materials"];
  audio: GltfVisualizerManifest["audio"];
}

export const emptyGltfConfig = (): GltfConfig => ({
  audio: { schemaVersion: 1, bindings: [] }
});

const isObj = (v: unknown): v is Record<string, any> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The manifest for a config and its attached files (envelope keys first). */
export function gltfManifest(
  config: GltfConfig,
  scene: string,
  poster: string | null
): GltfVisualizerManifest {
  const out: Record<string, unknown> = { format: 1, type: "gltf", scene };
  if (poster) out.poster = poster;
  if (config.view !== undefined) out.view = config.view;
  if (config.materials !== undefined) out.materials = config.materials;
  out.audio = config.audio;
  return out as unknown as GltfVisualizerManifest;
}

/** The editable part of a stored or imported manifest (anything else is dropped). */
export function configFromManifest(m: unknown): GltfConfig {
  const c = emptyGltfConfig();
  if (!isObj(m)) return c;
  if (m.view !== undefined) c.view = m.view;
  if (m.materials !== undefined) c.materials = m.materials;
  if (isObj(m.audio)) c.audio = m.audio as GltfConfig["audio"];
  return c;
}

// ---------------------------------------------------------------------------------------------
// Errors: "<path>: <message>" (spec §6.2)

export const errorPath = (e: string): string => {
  const i = e.indexOf(": ");
  return i < 0 ? "" : e.slice(0, i);
};

export const errorMessage = (e: string): string => {
  const i = e.indexOf(": ");
  return i < 0 ? e : e.slice(i + 2);
};

/** Errors at `path` or under it (path + "." or "["); `exact` keeps only `path` itself. */
export function errorsAt(
  errors: readonly string[],
  path: string,
  exact = false
): string[] {
  return errors.filter((e) => {
    const p = errorPath(e);
    if (p === path) return true;
    return !exact && (p.startsWith(`${path}.`) || p.startsWith(`${path}[`));
  });
}

// ---------------------------------------------------------------------------------------------
// Binding sources

export interface SourceRow {
  source: SourceName;
  weight: number;
}

export function bindingSources(b: BindingConfig): SourceRow[] {
  if (Array.isArray(b.sources))
    return b.sources.map((s) => ({
      source: s.source,
      weight: s.weight === undefined ? 1 : s.weight
    }));
  return b.source ? [{ source: b.source, weight: 1 }] : [];
}

/** One unweighted row → `source`; otherwise `sources` (weight 1 left out) and `combine`. */
export function withSources(
  b: BindingConfig,
  rows: SourceRow[],
  combine?: CombineMode
): BindingConfig {
  const { source: _s, sources: _ss, combine: oldCombine, ...rest } = b;
  if (rows.length === 1 && rows[0].weight === 1)
    return { ...rest, source: rows[0].source };
  const out: BindingConfig = {
    ...rest,
    sources: rows.map((r) =>
      r.weight === 1
        ? { source: r.source }
        : { source: r.source, weight: r.weight }
    )
  };
  const c = combine || oldCombine;
  if (c && rows.length > 1) out.combine = c;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Names a scene offers

export interface TargetChoices {
  clips: string[];
  nodes: string[];
  meshes: string[];
  /** Meshes with morph targets, and their named morphs. */
  morphMeshes: { name: string; morphs: string[] }[];
  materials: string[];
  lights: string[];
  cameras: string[];
}

/** Names that appear exactly once and aren't empty: the ones a config can reference. */
const unique = (names: readonly string[]): string[] =>
  names.filter(
    (n, i) => n !== "" && names.indexOf(n) === i && names.lastIndexOf(n) === i
  );

export function targetChoices(s: SceneSummary | null): TargetChoices {
  if (!s)
    return {
      clips: [],
      nodes: [],
      meshes: [],
      morphMeshes: [],
      materials: [],
      lights: [],
      cameras: []
    };
  const meshNames = unique(s.meshes.map((m) => m.name));
  const nodes = unique(s.nodes);
  return {
    clips: unique(s.animations.map((a) => a.name)),
    nodes,
    meshes: meshNames,
    morphMeshes: s.meshes
      .filter((m) => meshNames.includes(m.name) && m.morphs.length > 0)
      .map((m) => ({ name: m.name, morphs: m.morphs })),
    materials: unique(s.materials),
    lights: s.lights.filter((n) => nodes.includes(n)),
    cameras: s.cameras.filter((n) => nodes.includes(n))
  };
}

export function defaultTarget(
  kind: TargetKind,
  c: TargetChoices
): TargetConfig {
  switch (kind) {
    case "clip":
      return { kind: "clip", clip: c.clips[0] || "", mode: "weight" };
    case "morph": {
      const m = c.morphMeshes[0];
      const named = m ? m.morphs.find((x) => x !== "") : undefined;
      return {
        kind: "morph",
        mesh: m ? m.name : "",
        morph: named !== undefined ? named : 0
      };
    }
    case "node":
      return { kind: "node", node: c.nodes[0] || "", property: "scale" };
    case "material":
      return {
        kind: "material",
        material: c.materials[0] || "",
        property: "emissiveIntensity"
      };
    case "light":
      return { kind: "light", light: c.lights[0] || "", property: "intensity" };
    case "camera":
      return { kind: "camera", property: "orbitSpeed" };
  }
}

/** A new binding: the kick on the first node's scale, or the camera orbit with no nodes. */
export function defaultBinding(
  c: TargetChoices,
  usedIds: readonly (string | undefined)[]
): BindingConfig {
  let n = 1;
  while (usedIds.includes(`b${n}`)) n++;
  return {
    id: `b${n}`,
    source: "kick",
    target: c.nodes.length
      ? defaultTarget("node", c)
      : defaultTarget("camera", c)
  };
}

// ---------------------------------------------------------------------------------------------
// Summaries (one line per binding / rule, like the wireframe and the admin review)

const fmt = (x: number) => String(Math.round(x * 1000) / 1000);

export function describeBinding(b: BindingConfig): string {
  const rows = bindingSources(b);
  let src = rows.map((r) => r.source).join("+") || "?";
  if (rows.length > 1) src += ` ${b.combine || "sum"}`;
  const t = b.target;
  if (!t || typeof t !== "object") return `${src} → ?`;
  let what: string;
  let prop: string;
  switch (t.kind) {
    case "clip":
      what = t.clip;
      prop = t.mode;
      break;
    case "morph":
      what = `${t.mesh}/${t.morph}`;
      prop = "morph";
      break;
    case "node":
      what = t.node;
      prop = `${t.property}${t.axis ? ` ${t.axis}` : ""}`;
      break;
    case "material":
      what = t.material;
      prop = t.property;
      break;
    case "light":
      what = t.light;
      prop = "intensity";
      break;
    case "camera":
      what = "camera";
      prop = t.property;
      break;
    default:
      return `${src} → ?`;
  }
  if (t.kind === "clip" && (t.mode === "play" || t.mode === "trigger")) {
    return `${src} → ${what} · ${prop} at ${fmt(
      t.threshold !== undefined ? t.threshold : 0.5
    )}`;
  }
  const key = outputKeyOf(t);
  const range =
    b.outputRange || (key ? DEFAULT_LIMITS.outputDefaults[key] : null);
  return range
    ? `${src} → ${what} · ${prop} ${fmt(range[0])} → ${fmt(range[1])}`
    : `${src} → ${what} · ${prop}`;
}

export function describeRule(r: NoteClipRuleConfig): string {
  const m = r.match;
  let who = "?";
  const span = (lo: number, hi: number) =>
    lo === hi ? `${lo}` : `${lo}–${hi}`;
  if (m.part === "drums") {
    const vs = m.voices || (m.voice ? [m.voice] : []);
    who = `drums ${vs.join(", ")}`;
  } else if (m.part === "sampler") {
    const r2 = m.slots || (m.slot !== undefined ? [m.slot, m.slot] : null);
    who = r2
      ? `pad${r2[0] === r2[1] ? "" : "s"} ${span(r2[0] + 1, r2[1] + 1)}`
      : "pads";
  } else {
    const label = m.part === "samplerKeys" ? "sampler keys" : m.part;
    const r2 = m.notes || (m.note !== undefined ? [m.note, m.note] : null);
    who = r2 ? `${label} ${span(r2[0], r2[1])}` : label;
  }
  let s = `${who} → ${r.clip} ${r.mode || "loop"}`;
  if (r.sync && r.sync !== "now") s += ` · ${r.sync}`;
  if (r.clipBpm) s += ` · ${r.clipBpm} bpm`;
  return s;
}

// ---------------------------------------------------------------------------------------------
// Misc

/** A copy with item `i` moved by `delta` (no-op at the ends). */
export function moveItem<T>(list: readonly T[], i: number, delta: number): T[] {
  const out = list.slice();
  const j = i + delta;
  if (i < 0 || i >= out.length || j < 0 || j >= out.length) return out;
  const [x] = out.splice(i, 1);
  out.splice(j, 0, x);
  return out;
}

interface V3 {
  x: number;
  y: number;
  z: number;
}

const clampTo = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));
const round = (x: number, places: number) => {
  const k = Math.pow(10, places);
  return Math.round(x * k) / k;
};

/**
 * view.camera framing from a camera looking at the scene centre (the inspect camera): the rig
 * places its camera at fitted × distance from the centre, so the new distance factor is the
 * configured one scaled by the ratio of the two cameras' distances.
 */
export function cameraFromView(
  pos: V3,
  center: V3,
  rigDistance: number,
  configuredDistance: number
): { distance: number; elevation: number; azimuth: number } {
  const dx = pos.x - center.x;
  const dy = pos.y - center.y;
  const dz = pos.z - center.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
  const deg = 180 / Math.PI;
  return {
    distance: round(
      clampTo((configuredDistance * d) / (rigDistance || 1), 0.5, 10),
      2
    ),
    elevation: round(
      clampTo(Math.asin(clampTo(dy / d, -1, 1)) * deg, -80, 80),
      1
    ),
    azimuth: round(clampTo(Math.atan2(dx, dz) * deg, -180, 180), 1)
  };
}
