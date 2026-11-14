// WebGL1 runner for the visualizer editor's live preview. Same prelude and
// uniforms as the app's ShaderScene (spec §3.6). Browser only.
//
// A slow shader can hang a GPU: like the app's watchdog, three frames in a
// row over 50 ms stop the preview.

import { buildPreviewShader, VERTEX_SHADER } from "./source";

export interface AudioFrame {
  bass: number;
  mid: number;
  high: number;
  level: number;
  beat: number;
  beatPhase: number;
}

export interface ParamSpec {
  name: string;
  min: number;
  max: number;
  default: number;
  drive?: string;
}

export type CompileResult = { ok: true } | { ok: false; error: string };

const SLOW_FRAME_MS = 50;
const SLOW_FRAMES = 3;

/** Synthetic music for the preview: a 4/4 pulse at `bpm` with moving bands. */
export function syntheticFrame(t: number, bpm = 120): AudioFrame {
  const beatLen = 60 / bpm;
  const phase = (t % beatLen) / beatLen;
  const beat = Math.max(0, 1 - phase * 4); // decays over a quarter beat
  const bass = 0.35 + 0.6 * Math.exp(-phase * 5);
  const mid = 0.4 + 0.3 * Math.sin(t * 1.3) * Math.sin(t * 0.37);
  const high = 0.3 + 0.25 * Math.abs(Math.sin(t * 7.1 + Math.sin(t * 2.0)));
  const level = Math.min(1, (bass + mid + high) / 2.2);
  return { bass, mid, high, level, beat, beatPhase: phase };
}

/** A driven param moves from its default toward max with its band. */
export function paramValue(
  p: ParamSpec,
  frame: AudioFrame,
  manual?: number
): number {
  const base = manual ?? p.default;
  if (!p.drive) return base;
  const band = (frame as unknown as Record<string, number>)[p.drive] ?? 0;
  return base + (p.max - base) * Math.max(0, Math.min(1, band));
}

export class ShaderRunner {
  private gl: WebGLRenderingContext | null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private raf = 0;
  private start = 0;
  private slow = 0;
  private uniforms = new Map<string, WebGLUniformLocation | null>();
  params: ParamSpec[] = [];
  manual: Record<string, number> = {};
  bpm = 120;
  onStall?: () => void;
  onFrame?: (frame: AudioFrame) => void;

  constructor(private canvas: HTMLCanvasElement) {
    this.gl =
      (canvas.getContext("webgl", {
        antialias: false,
        alpha: false
      }) as WebGLRenderingContext | null) || null;
  }

  get supported(): boolean {
    return !!this.gl;
  }

  compile(source: string, params: ParamSpec[]): CompileResult {
    const gl = this.gl;
    if (!gl)
      return { ok: false, error: "WebGL isn't available in this browser." };
    let fragSrc: string;
    try {
      fragSrc = buildPreviewShader(source, params);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    const vs = this.shader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.shader(gl.FRAGMENT_SHADER, fragSrc);
    if (typeof fs === "string") {
      if (typeof vs !== "string") gl.deleteShader(vs);
      return { ok: false, error: fs };
    }
    if (typeof vs === "string") return { ok: false, error: vs };
    const prog = gl.createProgram();
    if (!prog) return { ok: false, error: "Couldn't create a GL program." };
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) || "Link failed.";
      gl.deleteProgram(prog);
      return { ok: false, error: log };
    }
    if (this.program) gl.deleteProgram(this.program);
    this.program = prog;
    this.params = params;
    this.uniforms.clear();
    if (!this.buffer) {
      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
    }
    this.slow = 0;
    return { ok: true };
  }

  play(): void {
    if (!this.gl || !this.program || this.raf) return;
    this.start = performance.now() - this.start;
    const loop = () => {
      const t0 = performance.now();
      this.draw((t0 - this.start) / 1000);
      // Approximates GPU time: finish() blocks until the frame is done.
      this.gl?.finish();
      const dt = performance.now() - t0;
      this.slow = dt > SLOW_FRAME_MS ? this.slow + 1 : 0;
      if (this.slow >= SLOW_FRAMES) {
        this.stop();
        this.onStall?.();
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    if (!this.raf) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.start = performance.now() - this.start;
  }

  get playing(): boolean {
    return this.raf !== 0;
  }

  dispose(): void {
    this.stop();
    const gl = this.gl;
    if (!gl) return;
    if (this.program) gl.deleteProgram(this.program);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    this.program = null;
    this.buffer = null;
  }

  private loc(name: string) {
    if (!this.uniforms.has(name) && this.gl && this.program) {
      this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.uniforms.get(name) ?? null;
  }

  private draw(t: number) {
    const gl = this.gl;
    if (!gl || !this.program) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);
    const f = syntheticFrame(t, this.bpm);
    this.onFrame?.(f);
    gl.uniform1f(this.loc("uTime"), t);
    gl.uniform2f(this.loc("uResolution"), w, h);
    gl.uniform1f(this.loc("uBass"), f.bass);
    gl.uniform1f(this.loc("uMid"), f.mid);
    gl.uniform1f(this.loc("uHigh"), f.high);
    gl.uniform1f(this.loc("uLevel"), f.level);
    gl.uniform1f(this.loc("uBeat"), f.beat);
    gl.uniform1f(this.loc("uBeatPhase"), f.beatPhase);
    for (const p of this.params) {
      gl.uniform1f(
        this.loc(`uP_${p.name}`),
        paramValue(p, f, this.manual[p.name])
      );
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private shader(type: number, src: string): WebGLShader | string {
    const gl = this.gl as WebGLRenderingContext;
    const s = gl.createShader(type);
    if (!s) return "Couldn't create a shader.";
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s) || "Compile failed.";
      gl.deleteShader(s);
      return log.trim();
    }
    return s;
  }
}
