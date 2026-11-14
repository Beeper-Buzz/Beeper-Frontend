// visualizer manifest (spec §1.5) and the source rules for its .glsl file.
// The file holds helpers and `vec4 beeperMain(vec2 uv)` only; the host prelude
// (spec §3.6, lib/shader/source.ts) declares precision, uniforms and main.

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

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

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
