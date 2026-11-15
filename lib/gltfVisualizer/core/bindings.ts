// Binding math (spec §4.1–4.2): the source catalogue, curves, the one-pole follower, combine,
// and a compiled evaluator that runs per frame without allocating (flat typed arrays, no
// closures, no per-frame objects).

import type { Range } from './limits';
import { CombineMode, CurveName, NormalizedBinding, NormalizedGltfManifest, SOURCE_NAMES, SourceName } from './manifest';

export interface SourceInfo {
  name: SourceName;
  label: string;
  /** What the app delivers. */
  range: Range;
  /** A sensible inputRange for the studio to suggest. */
  suggestedInputRange: Range;
}

/** The 20 sources in schema order; `SOURCE_INDEX[name]` is the slot in a sources vector. */
export const SOURCES: readonly SourceInfo[] = [
  { name: 'bass', label: 'Bass', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'mid', label: 'Mid', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'high', label: 'High', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'level', label: 'Level', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'beat', label: 'Beat', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'onset', label: 'Onset', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'beatPhase', label: 'Beat phase', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'barPhase', label: 'Bar phase', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'bpm', label: 'Tempo (BPM)', range: [20, 300], suggestedInputRange: [60, 180] },
  { name: 'playing', label: 'Playing', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'notePulse', label: 'Note pulse', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'note', label: 'Note (MIDI)', range: [-1, 127], suggestedInputRange: [36, 84] },
  { name: 'noteHz', label: 'Note (Hz)', range: [0, 12544], suggestedInputRange: [65, 1047] },
  { name: 'hit', label: 'Any hit', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'drums', label: 'Drums hit', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'sampler', label: 'Sampler hit', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'synth', label: 'Synth hit', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'kick', label: 'Kick', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'snare', label: 'Snare', range: [0, 1], suggestedInputRange: [0, 1] },
  { name: 'hats', label: 'Hats', range: [0, 1], suggestedInputRange: [0, 1] },
];

export const SOURCE_COUNT = SOURCE_NAMES.length;

export const SOURCE_INDEX: { readonly [K in SourceName]: number } = (() => {
  const o = {} as { [K in SourceName]: number };
  for (let i = 0; i < SOURCE_NAMES.length; i++) o[SOURCE_NAMES[i]] = i;
  return o;
})();

/** A zeroed sources vector (one slot per source, `SOURCE_INDEX` order). */
export function createSourceBuffer(): Float32Array {
  return new Float32Array(SOURCE_COUNT);
}

// ---------------------------------------------------------------------------------------------
// Curves

export const CURVE_ID: { readonly [K in CurveName]: number } = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, exp: 4, step: 5 };
const EXP4_1 = Math.exp(4) - 1;

/** Curve by numeric id (CURVE_ID); t in 0..1. */
export function curveById(id: number, t: number, steps: number): number {
  switch (id) {
    case 1:
      return t * t;
    case 2:
      return 1 - (1 - t) * (1 - t);
    case 3:
      return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    case 4:
      return (Math.exp(4 * t) - 1) / EXP4_1;
    case 5:
      return Math.min(Math.floor(t * steps), steps - 1) / (steps - 1);
    default:
      return t;
  }
}

/** Spec §4.2 curves: linear, easeIn, easeOut, easeInOut, exp, step (`steps` 2..16, default 4). */
export function curve(name: CurveName, t: number, steps = 4): number {
  return curveById(CURVE_ID[name], t, steps);
}

/**
 * One-pole follower toward `x`: τ = attack when rising, release when falling, factor
 * exp(−dt/τ); a zero τ is instant (same as the app's audioFrame.follow, in ms here).
 */
export function follow(prev: number, x: number, dtSec: number, attackMs: number, releaseMs: number): number {
  const tau = (x > prev ? attackMs : releaseMs) / 1000;
  if (tau <= 0) return x;
  if (dtSec <= 0) return prev;
  return x + (prev - x) * Math.exp(-dtSec / tau);
}

export const COMBINE_ID: { readonly [K in CombineMode]: number } = { sum: 0, max: 1, avg: 2, mul: 3 };

/**
 * Combines weighted sources: sum Σwᵢsᵢ, max, avg Σwᵢsᵢ/Σ|wᵢ| (0 when all weights are 0), mul Πwᵢsᵢ.
 * `count` defaults to values.length.
 */
export function combine(mode: CombineMode | number, values: ArrayLike<number>, weights: ArrayLike<number>, count = values.length): number {
  const id = typeof mode === 'number' ? mode : COMBINE_ID[mode];
  return combineRange(id, values, weights, null, 0, count);
}

/** Shared by `combine` and the evaluator: values[index[k]] (or values[k] when index is null). */
function combineRange(id: number, values: ArrayLike<number>, weights: ArrayLike<number>, index: ArrayLike<number> | null, start: number, count: number): number {
  let acc = id === 1 ? -Infinity : id === 3 ? 1 : 0;
  let norm = 0;
  for (let k = start; k < start + count; k++) {
    const w = weights[k];
    const v = w * values[index ? index[k] : k];
    if (id === 1) acc = v > acc ? v : acc;
    else if (id === 3) acc *= v;
    else acc += v;
    if (id === 2) norm += w < 0 ? -w : w;
  }
  if (id === 2) return norm > 0 ? acc / norm : 0;
  if (id === 1 && count === 0) return 0;
  return acc;
}

// ---------------------------------------------------------------------------------------------
// Compiled evaluator

/** Clip-target mode codes in `CompiledBindings.clipMode`. */
export const CLIP_MODE_NONE = 0;
export const CLIP_MODE_PLAY = 1;
export const CLIP_MODE_TRIGGER = 2;

/**
 * Hysteresis level below which play fades out and trigger re-arms: threshold − 0.1 (spec §4.3).
 * For thresholds ≤ 0.1 that level is unreachable (t ≥ 0), so half the threshold is used instead.
 */
export function rearmLevel(threshold: number): number {
  const level = threshold - 0.1;
  return level > 0 ? level : threshold * 0.5;
}

export class CompiledBindings {
  readonly count: number;
  /** Final t (after curve and smoothing) per binding, 0..1. */
  readonly t: Float32Array;
  /** play targets: 1 while active (t ≥ threshold, until t < rearm level). */
  readonly active: Uint8Array;
  /** trigger targets: 1 on the frame t rose through the threshold. */
  readonly fired: Uint8Array;
  readonly clipMode: Uint8Array;

  private readonly srcStart: Int32Array;
  private readonly srcCount: Int32Array;
  private readonly srcIndex: Int32Array;
  private readonly srcWeight: Float32Array;
  private readonly combineId: Uint8Array;
  private readonly in0: Float64Array;
  private readonly in1: Float64Array;
  private readonly invert: Uint8Array;
  private readonly curveId: Uint8Array;
  private readonly steps: Uint8Array;
  private readonly attack: Float64Array;
  private readonly release: Float64Array;
  private readonly out0: Float64Array;
  private readonly out1: Float64Array;
  private readonly threshold: Float64Array;
  private readonly rearm: Float64Array;
  private readonly armed: Uint8Array;
  private readonly state: Float64Array;

  constructor(bindings: readonly NormalizedBinding[]) {
    const n = bindings.length;
    this.count = n;
    let total = 0;
    for (let i = 0; i < n; i++) total += bindings[i].sources.length;
    this.t = new Float32Array(n);
    this.active = new Uint8Array(n);
    this.fired = new Uint8Array(n);
    this.clipMode = new Uint8Array(n);
    this.srcStart = new Int32Array(n);
    this.srcCount = new Int32Array(n);
    this.srcIndex = new Int32Array(total);
    this.srcWeight = new Float32Array(total);
    this.combineId = new Uint8Array(n);
    this.in0 = new Float64Array(n);
    this.in1 = new Float64Array(n);
    this.invert = new Uint8Array(n);
    this.curveId = new Uint8Array(n);
    this.steps = new Uint8Array(n);
    this.attack = new Float64Array(n);
    this.release = new Float64Array(n);
    this.out0 = new Float64Array(n);
    this.out1 = new Float64Array(n);
    this.threshold = new Float64Array(n);
    this.rearm = new Float64Array(n);
    this.armed = new Uint8Array(n);
    this.state = new Float64Array(n);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const b = bindings[i];
      this.srcStart[i] = k;
      this.srcCount[i] = b.sources.length;
      for (let j = 0; j < b.sources.length; j++, k++) {
        this.srcIndex[k] = SOURCE_INDEX[b.sources[j].source];
        this.srcWeight[k] = b.sources[j].weight;
      }
      this.combineId[i] = COMBINE_ID[b.combine];
      this.in0[i] = b.inputRange[0];
      this.in1[i] = b.inputRange[1];
      this.invert[i] = b.invert ? 1 : 0;
      this.curveId[i] = CURVE_ID[b.curve];
      this.steps[i] = b.steps;
      this.attack[i] = b.attackMs;
      this.release[i] = b.releaseMs;
      this.out0[i] = b.outputRange[0];
      this.out1[i] = b.outputRange[1];
      const tg = b.target;
      if (tg.kind === 'clip' && (tg.mode === 'play' || tg.mode === 'trigger')) {
        this.clipMode[i] = tg.mode === 'play' ? CLIP_MODE_PLAY : CLIP_MODE_TRIGGER;
        this.threshold[i] = tg.threshold;
        this.rearm[i] = rearmLevel(tg.threshold);
      }
    }
    this.reset();
  }

  /** Followers to 0, play inactive, triggers armed. */
  reset(): void {
    this.state.fill(0);
    this.t.fill(0);
    this.active.fill(0);
    this.fired.fill(0);
    this.armed.fill(1);
  }

  /** Evaluates every binding into `out[i]` (and `t[i]`, `active`, `fired`). No allocation. */
  evaluate(sources: Float32Array, dtSec: number, out: Float32Array): void {
    for (let i = 0; i < this.count; i++) {
      const raw = combineRange(this.combineId[i], sources, this.srcWeight, this.srcIndex, this.srcStart[i], this.srcCount[i]);
      let t = (raw - this.in0[i]) / (this.in1[i] - this.in0[i]);
      t = t > 0 ? (t < 1 ? t : 1) : 0; // also maps NaN to 0
      if (this.invert[i] === 1) t = 1 - t;
      t = curveById(this.curveId[i], t, this.steps[i]);
      t = follow(this.state[i], t, dtSec, this.attack[i], this.release[i]);
      this.state[i] = t;
      this.t[i] = t;
      out[i] = this.out0[i] + (this.out1[i] - this.out0[i]) * t;
      const mode = this.clipMode[i];
      if (mode === CLIP_MODE_PLAY) {
        if (this.active[i] === 0 && t >= this.threshold[i]) this.active[i] = 1;
        else if (this.active[i] === 1 && t < this.rearm[i]) this.active[i] = 0;
      } else if (mode === CLIP_MODE_TRIGGER) {
        this.fired[i] = 0;
        if (this.armed[i] === 1 && t >= this.threshold[i]) {
          this.fired[i] = 1;
          this.armed[i] = 0;
        } else if (this.armed[i] === 0 && t < this.rearm[i]) {
          this.armed[i] = 1;
        }
      }
    }
  }
}

/** Compiles a normalised manifest's bindings (or a list of them) for per-frame evaluation. */
export function compileBindings(normalized: NormalizedGltfManifest | readonly NormalizedBinding[]): CompiledBindings {
  const list = isBindingList(normalized) ? normalized : normalized.audio.bindings;
  return new CompiledBindings(list);
}

function isBindingList(v: NormalizedGltfManifest | readonly NormalizedBinding[]): v is readonly NormalizedBinding[] {
  return Array.isArray(v);
}
