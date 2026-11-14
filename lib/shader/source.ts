// The shader host prelude (spec §3.6), shared contract with the app's
// ShaderScene: GLSL ES 1.00, the creator's file supplies only
// `vec4 beeperMain(vec2 uv)` (uv 0..1). Param uniform names come only from
// validated manifest names, never from free text.

import { VIZ_PARAM_NAME_RE } from "../manifests/visualizer";

export const PRELUDE_UNIFORMS = [
  "uTime",
  "uResolution",
  "uBass",
  "uMid",
  "uHigh",
  "uLevel",
  "uBeat",
  "uBeatPhase"
];

export const PRELUDE = `precision mediump float;
uniform float uTime;
uniform vec2 uResolution;
uniform float uBass, uMid, uHigh, uLevel;
uniform float uBeat;
uniform float uBeatPhase;
`;

/** Lines before the creator's code, so compile errors can be mapped back. */
export const preludeLineCount = (paramCount: number): number =>
  PRELUDE.split("\n").length - 1 + paramCount + 1;

export function buildPreviewShader(
  source: string,
  params: { name: string }[]
): string {
  for (const p of params) {
    if (!VIZ_PARAM_NAME_RE.test(p.name)) {
      throw new Error(`invalid param name: ${p.name}`);
    }
  }
  const paramDecls = params
    .map((p) => `uniform float uP_${p.name};\n`)
    .join("");
  return `${PRELUDE}${paramDecls}#line 1
${source}
void main() {
  gl_FragColor = beeperMain(gl_FragCoord.xy / uResolution);
}
`;
}

export const VERTEX_SHADER = `attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;
