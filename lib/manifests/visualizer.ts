// visualizer manifest (spec §1.5) and the source rules for its .glsl file.
// The file holds helpers and `vec4 beeperMain(vec2 uv)` only; the host prelude
// (spec §3.6, lib/shader/source.ts) declares precision, uniforms and main.
//
// A visualizer is either a shader (no `type`, or "shader") or a 3D scene
// (`type: "gltf"`, specs/2026-11-15-creator-gltf-visualizers-design.md): one
// .glb plus an optional poster, checked by the shared core in lib/gltfVisualizer.

import type { SceneStats, SceneSummary } from "../gltfVisualizer/core/glb";
import { DEFAULT_LIMITS } from "../gltfVisualizer/core/limits";
import {
  GltfVisualizerManifest,
  validateManifest
} from "../gltfVisualizer/core/manifest";
import { GltfConfig, gltfManifest } from "../gltfVisualizer/edit";

export type VizSceneType = "shader" | "gltf";

/** A stored visualizer manifest's scene type. */
export const vizSceneTypeOf = (m: unknown): VizSceneType =>
  typeof m === "object" &&
  m !== null &&
  (m as { type?: unknown }).type === "gltf"
    ? "gltf"
    : "shader";

/** What the studio knows about the picked GLB (the inspector, plus loader errors). */
export interface GltfSceneCheck {
  errors: string[];
  summary: SceneSummary | null;
  stats: SceneStats | null;
}

const ext = (name: string) => (name.split(".").pop() || "").toLowerCase();
const POSTER_EXTS = ["png", "jpg", "jpeg", "webp"];
const MB = 1024 * 1024;

/** The file types each kind of visualizer is made of; anything else is a leftover. */
export const VIZ_FILE_EXTS: Record<VizSceneType, readonly string[]> = {
  shader: ["glsl", "json"],
  gltf: ["glb", ...POSTER_EXTS]
};

/** A file that belongs to the other kind of visualizer (left over from switching type). */
export const strayFileError = (name: string, type: VizSceneType): string =>
  `files: ${name} isn't part of a ${
    type === "gltf" ? "3D scene" : "shader"
  }; remove it`;

/**
 * The glTF manifest for the attached files (the .glb is `scene`, an image is
 * `poster`) and every problem with it: file rules, the inspector's GLB errors,
 * then the shared validator (names resolve once the scene is inspected).
 */
export function buildGltfVisualizer(
  draft: { config: GltfConfig },
  attached: { name: string; size: number }[],
  scene: GltfSceneCheck | null
): { manifest: GltfVisualizerManifest; errors: string[] } {
  const glbs = attached.filter((f) => ext(f.name) === "glb");
  const posters = attached.filter((f) => POSTER_EXTS.includes(ext(f.name)));
  const others = attached.filter(
    (f) => ext(f.name) !== "glb" && !POSTER_EXTS.includes(ext(f.name))
  );
  const fileErrors: string[] = [];
  if (!glbs.length)
    fileErrors.push(
      "scene: add a .glb file (in Blender: File → Export → glTF Binary)"
    );
  else if (glbs.length > 1)
    fileErrors.push("scene: attach one .glb file; remove the others");
  if (posters.length > 1)
    fileErrors.push("poster: attach one poster image; remove the others");
  for (const p of posters)
    if (p.size > DEFAULT_LIMITS.posterMaxBytes)
      fileErrors.push(
        `poster: ${p.name} is over the ${
          DEFAULT_LIMITS.posterMaxBytes / MB
        } MB limit`
      );
  for (const f of others) fileErrors.push(strayFileError(f.name, "gltf"));

  const manifest = gltfManifest(
    draft.config,
    glbs[0]?.name || "",
    posters[0]?.name || null
  );
  let checks = validateManifest(manifest, scene?.summary || null, {
    stats: scene?.stats || null
  });
  // No .glb yet: the file rule above says it better than the name pattern.
  if (!glbs.length) checks = checks.filter((e) => !e.startsWith("scene: "));
  const errors: string[] = [];
  for (const e of [...(scene?.errors || []), ...fileErrors, ...checks])
    if (!errors.includes(e)) errors.push(e);
  return { manifest, errors };
}

export const VIZ_PARAM_NAME_RE = /^[a-z][a-zA-Z0-9]{0,23}$/;
export const VIZ_DRIVES = ["bass", "mid", "high", "level", "beat"] as const;
export type VizDrive = (typeof VIZ_DRIVES)[number];
export const MAX_VIZ_PARAMS = 8;
export const SHADER_MAX_BYTES = 64 * 1024;

export interface VizParam {
  name: string;
  label: string;
  min: number;
  max: number;
  default: number;
  drive?: VizDrive;
}

export interface VisualizerManifest {
  format: 1;
  shader: string;
  params: VizParam[];
}

export interface VizParamDraft {
  name: string;
  label?: string;
  min: number;
  max: number;
  default: number;
  drive?: string;
}

const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function buildVisualizer(
  draft: { shader: string; params: VizParamDraft[] },
  attachedFiles: string[]
): { manifest: VisualizerManifest; errors: string[] } {
  const errors: string[] = [];
  for (const name of attachedFiles)
    if (!VIZ_FILE_EXTS.shader.includes(ext(name)))
      errors.push(strayFileError(name, "shader"));
  if (!draft.shader || !/\.glsl$/i.test(draft.shader)) {
    errors.push("add a .glsl shader file");
  } else if (!attachedFiles.includes(draft.shader)) {
    errors.push(`file "${draft.shader}" is not attached`);
  }
  if (draft.params.length > MAX_VIZ_PARAMS) {
    errors.push(`params must have at most ${MAX_VIZ_PARAMS} entries`);
  }
  const names = new Set<string>();
  const params: VizParam[] = draft.params.map((p, i) => {
    const at = `params[${i}]`;
    if (!VIZ_PARAM_NAME_RE.test(p.name || "")) {
      errors.push(`${at}.name invalid`);
    } else if (names.has(p.name)) {
      errors.push(`${at}.name "${p.name}" is used twice`);
    }
    names.add(p.name);
    if (!num(p.min) || !num(p.max) || !num(p.default)) {
      errors.push(`${at} min, max and default must be numbers`);
    } else if (p.min >= p.max) {
      errors.push(`${at}.min must be below max`);
    } else if (p.default < p.min || p.default > p.max) {
      errors.push(`${at}.default must be within min..max`);
    }
    if (p.drive && !(VIZ_DRIVES as readonly string[]).includes(p.drive)) {
      errors.push(`${at}.drive invalid`);
    }
    const out: VizParam = {
      name: p.name,
      label: (p.label || "").trim() || p.name,
      min: p.min,
      max: p.max,
      default: p.default
    };
    if (p.drive) out.drive = p.drive as VizDrive;
    return out;
  });
  return { manifest: { format: 1, shader: draft.shader, params }, errors };
}

// One pass, so whichever comment opens first wins: "// a /*" is a line
// comment and "/* // */" a block comment. An unterminated block comment runs
// to the end of the file. Line breaks inside block comments are kept.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*/g, (m) =>
    m.startsWith("//") ? " " : m.replace(/[^\n]/g, " ")
  );

const FORBIDDEN: [RegExp, string][] = [
  [/#\s*version\b/, "#version not allowed"],
  [/#\s*extension\b/, "#extension not allowed"],
  [/#\s*include\b/, "#include not allowed"],
  [
    /\bprecision\s+(lowp|mediump|highp)\b/,
    "precision declarations not allowed"
  ],
  [/\buniform\b/, "uniform declarations not allowed"],
  [/\battribute\b/, "attribute declarations not allowed"],
  [/\bvarying\b/, "varying declarations not allowed"],
  [/\bvoid\s+main\s*\(/, "void main not allowed (the host provides main)"]
];

/** The server's checks (spec §1.5), so creators see them before uploading. */
export function checkShaderSource(src: string): string[] {
  const errors: string[] = [];
  const bytes =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(src).length
      : src.length;
  if (bytes > SHADER_MAX_BYTES) errors.push("shader too large (max 64 KB)");
  const code = stripComments(src);
  for (const [re, msg] of FORBIDDEN) if (re.test(code)) errors.push(msg);
  if (!/\bvec4\s+beeperMain\s*\(\s*vec2\s+\w+\s*\)/.test(code)) {
    errors.push("shader must define beeperMain");
  }
  return errors;
}
