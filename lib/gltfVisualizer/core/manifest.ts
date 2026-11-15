// Manifest validation (spec §4, §6.2) and normalisation. The structural checks mirror
// visualizer-gltf.schema.json by hand (no ajv at runtime): unknown keys are rejected everywhere
// and each error names the exact field. The semantic rules and name resolution against the GLB's
// SceneSummary follow. Every validator (app, web, server) must agree on fixtures/manifest-cases.json.

import { DEFAULT_LIMITS, GltfLimits, OutputKey, Range } from './limits';
import type { SceneStats, SceneSummary } from './glb';

// ---------------------------------------------------------------------------------------------
// Vocabulary (schema order)

export const SOURCE_NAMES = [
  'bass', 'mid', 'high', 'level',
  'beat', 'onset', 'beatPhase', 'barPhase', 'bpm', 'playing',
  'notePulse', 'note', 'noteHz',
  'hit', 'drums', 'sampler', 'synth',
  'kick', 'snare', 'hats',
] as const;
export type SourceName = typeof SOURCE_NAMES[number];

/** Drum voices in the app's DRUM_VOICES order: a drums note event's `note` is the index here. */
export const DRUM_VOICES = ['kick', 'snare', 'closed-hat', 'open-hat', 'clap', 'low-tom', 'high-tom', 'rim', 'mid-tom'] as const;
export type DrumVoice = typeof DRUM_VOICES[number];

export const CURVES = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'exp', 'step'] as const;
export type CurveName = typeof CURVES[number];
export const COMBINE_MODES = ['sum', 'max', 'avg', 'mul'] as const;
export type CombineMode = typeof COMBINE_MODES[number];
export const CLIP_MODES = ['speed', 'weight', 'scrub', 'play', 'trigger'] as const;
export type ClipMode = typeof CLIP_MODES[number];
export const NODE_PROPERTIES = ['position', 'rotation', 'scale', 'spin'] as const;
export type NodeProperty = typeof NODE_PROPERTIES[number];
export const AXES = ['x', 'y', 'z', 'xyz'] as const;
export type Axis = typeof AXES[number];
export const MATERIAL_PROPERTIES = ['emissiveIntensity', 'emissiveColor', 'color', 'hueShift', 'opacity', 'roughness', 'metalness'] as const;
export type MaterialProperty = typeof MATERIAL_PROPERTIES[number];
export const CAMERA_PROPERTIES = ['orbitSpeed', 'dolly'] as const;
export type CameraProperty = typeof CAMERA_PROPERTIES[number];
export const TARGET_KINDS = ['clip', 'morph', 'node', 'material', 'light', 'camera'] as const;
export type TargetKind = typeof TARGET_KINDS[number];
export type NoteMatchPart = 'synth' | 'samplerKeys' | 'keys' | 'sampler' | 'drums';

// ---------------------------------------------------------------------------------------------
// Defaults (spec §4.2–4.8; output ranges come from limits.outputDefaults)

export const DEFAULT_BACKGROUND = '#000000';
export const DEFAULT_EXPOSURE = 1;
export const DEFAULT_CAMERA = { fov: 40, distance: 1, elevation: 10, azimuth: 0, orbitSpeed: 0 };
export const DEFAULT_OUTLINE_COLOR = '#000000';
export const DEFAULT_STEPS = 4;
export const DEFAULT_THRESHOLD = 0.5;
/** Fade for play/trigger clip targets when `fadeMs` is absent. */
export const DEFAULT_CLIP_FADE_MS = 250;
/** noteClips.fadeMs when absent. */
export const DEFAULT_NOTE_FADE_MS = 250;
export const DEFAULT_AXIS: { readonly [K in NodeProperty]: Axis } = { position: 'y', rotation: 'y', scale: 'xyz', spin: 'y' };

// ---------------------------------------------------------------------------------------------
// Input shape (what creators write; matches the schema)

export interface ClipTargetConfig { kind: 'clip'; clip: string; mode: ClipMode; threshold?: number; fadeMs?: number }
export interface MorphTargetConfig { kind: 'morph'; mesh: string; morph: string | number }
export interface NodeTargetConfig { kind: 'node'; node: string; property: NodeProperty; axis?: Axis }
export interface MaterialTargetConfig { kind: 'material'; material: string; property: MaterialProperty; colors?: [string, string] }
export interface LightTargetConfig { kind: 'light'; light: string; property: 'intensity' }
export interface CameraTargetConfig { kind: 'camera'; property: CameraProperty }
export type TargetConfig = ClipTargetConfig | MorphTargetConfig | NodeTargetConfig | MaterialTargetConfig | LightTargetConfig | CameraTargetConfig;

export interface BindingConfig {
  id?: string;
  source?: SourceName;
  sources?: { source: SourceName; weight?: number }[];
  combine?: CombineMode;
  inputRange?: [number, number];
  outputRange?: [number, number];
  curve?: CurveName;
  steps?: number;
  smoothing?: { attackMs?: number; releaseMs?: number };
  invert?: boolean;
  target: TargetConfig;
}

export type NoteMatchConfig =
  | { part: 'synth' | 'samplerKeys' | 'keys'; note?: number; notes?: [number, number] }
  | { part: 'sampler'; slot?: number; slots?: [number, number] }
  | { part: 'drums'; voice?: DrumVoice; voices?: DrumVoice[] };

export interface NoteClipRuleConfig {
  match: NoteMatchConfig;
  clip: string;
  mode?: 'loop' | 'once';
  sync?: 'now' | 'beat' | 'bar';
  fadeMs?: number;
  timeScale?: number;
  clipBpm?: number;
  velocity?: { to: 'weight' | 'timeScale'; range: [number, number] };
}

export interface NoteClipsConfig {
  initial: string;
  fadeMs?: number;
  priority?: 'last' | 'velocity';
  onStop?: 'hold' | 'initial';
  returnAfterMs?: number;
  rules: NoteClipRuleConfig[];
}

export interface GltfVisualizerManifest {
  format: 1;
  type: 'gltf';
  scene: string;
  poster?: string;
  view?: {
    background?: string;
    lighting?: 'studio' | 'scene';
    exposure?: number;
    camera?: { node?: string; fov?: number; distance?: number; elevation?: number; azimuth?: number; orbitSpeed?: number };
  };
  materials?: { material: string; toon: { steps: number; outline?: { width: number; color?: string } } }[];
  audio: {
    schemaVersion: 1;
    idle?: { clips: { clip: string; timeScale?: number }[] };
    bindings?: BindingConfig[];
    noteClips?: NoteClipsConfig;
  };
  files?: unknown;
}

// ---------------------------------------------------------------------------------------------
// Normalised shape (every default filled; what the runtime and studio consume)

export interface NormalizedClipTarget { kind: 'clip'; clip: string; mode: ClipMode; threshold: number; fadeMs: number }
export interface NormalizedMorphTarget { kind: 'morph'; mesh: string; morph: string | number }
export interface NormalizedNodeTarget { kind: 'node'; node: string; property: NodeProperty; axis: Axis }
export interface NormalizedMaterialTarget { kind: 'material'; material: string; property: MaterialProperty; colors: [string, string] | null }
export interface NormalizedLightTarget { kind: 'light'; light: string; property: 'intensity' }
export interface NormalizedCameraTarget { kind: 'camera'; property: CameraProperty }
export type NormalizedTarget =
  | NormalizedClipTarget
  | NormalizedMorphTarget
  | NormalizedNodeTarget
  | NormalizedMaterialTarget
  | NormalizedLightTarget
  | NormalizedCameraTarget;

export interface NormalizedBinding {
  index: number;
  /** The config's id, or `binding-<index>`. */
  id: string;
  sources: { source: SourceName; weight: number }[];
  combine: CombineMode;
  inputRange: [number, number];
  /** [0, 1] for play/trigger targets, whose output is t itself. */
  outputRange: [number, number];
  curve: CurveName;
  steps: number;
  attackMs: number;
  releaseMs: number;
  invert: boolean;
  target: NormalizedTarget;
  /** The limits key of the target, null for play/trigger. */
  outputKey: OutputKey | null;
}

export interface NormalizedNoteMatch {
  part: NoteMatchPart;
  /** MIDI notes (keys parts) or slots (sampler), inclusive; -1 for drums. */
  lo: number;
  hi: number;
  /** Voice indices (DRUM_VOICES order) for drums, else null. */
  voices: number[] | null;
}

export interface NormalizedNoteRule {
  index: number;
  match: NormalizedNoteMatch;
  clip: string;
  mode: 'loop' | 'once';
  sync: 'now' | 'beat' | 'bar';
  fadeMs: number;
  timeScale: number;
  /** 0 = no tempo sync. */
  clipBpm: number;
  velocity: { to: 'weight' | 'timeScale'; range: [number, number] } | null;
}

export interface NormalizedNoteClips {
  initial: string;
  fadeMs: number;
  priority: 'last' | 'velocity';
  onStop: 'hold' | 'initial';
  returnAfterMs: number;
  rules: NormalizedNoteRule[];
}

export interface NormalizedMaterialOverride {
  material: string;
  steps: number;
  outline: { width: number; color: string } | null;
}

export interface NormalizedView {
  background: string;
  lighting: 'studio' | 'scene';
  exposure: number;
  camera: { node: string | null; fov: number; distance: number; elevation: number; azimuth: number; orbitSpeed: number };
}

export interface NormalizedGltfManifest {
  scene: string;
  poster: string | null;
  view: NormalizedView;
  materials: NormalizedMaterialOverride[];
  audio: {
    idle: { clip: string; timeScale: number }[];
    bindings: NormalizedBinding[];
    noteClips: NormalizedNoteClips | null;
  };
}

// ---------------------------------------------------------------------------------------------
// Helpers

type Obj = { [key: string]: unknown };
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const isInt = (v: unknown): v is number => isNum(v) && Math.floor(v) === v;
const has = (o: Obj, k: string): boolean => o[k] !== undefined; // undefined counts as absent
const quote = (vals: readonly string[]): string => vals.map((v) => `"${v}"`).join(', ');

const GLB_RE = /^[^\\/]+\.[gG][lL][bB]$/;
const POSTER_RE = /^[^\\/]+\.([pP][nN][gG]|[jJ][pP][eE]?[gG]|[wW][eE][bB][pP])$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

/** JSON Schema string lengths count code points, not UTF-16 units. */
function codePoints(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) i++;
    }
    n++;
  }
  return n;
}

type RefKind = 'clip' | 'node' | 'mesh' | 'material' | 'light' | 'camera';
interface NameRef { kind: RefKind; name: string; path: string }
interface MorphRef { mesh: string; morph: string | number; path: string }

class Ctx {
  errors: string[] = [];
  refs: NameRef[] = [];
  morphs: MorphRef[] = [];
  constructor(readonly limits: GltfLimits) {}

  err(path: string, message: string): void {
    this.errors.push(`${path}: ${message}`);
  }

  /** Object with only `allowed` keys and all `required` keys present. */
  object(v: unknown, path: string, allowed: readonly string[], required: readonly string[]): v is Obj {
    if (!isObj(v)) {
      this.err(path, 'must be an object');
      return false;
    }
    const keys = Object.keys(v);
    for (let i = 0; i < keys.length; i++) {
      if (allowed.indexOf(keys[i]) < 0 && v[keys[i]] !== undefined) this.err(sub(path, keys[i]), 'unknown key');
    }
    for (let i = 0; i < required.length; i++) if (!has(v, required[i])) this.err(sub(path, required[i]), 'required');
    return true;
  }

  num(v: unknown, path: string, min: number, max: number, integer = false): v is number {
    const ok = integer ? isInt(v) : isNum(v);
    if (!ok) {
      this.err(path, integer ? 'must be an integer' : 'must be a number');
      return false;
    }
    const x = v as number;
    if (x < min || x > max) {
      this.err(path, `must be between ${min} and ${max}`);
      return false;
    }
    return true;
  }

  oneOf<T extends string>(v: unknown, path: string, values: readonly T[]): v is T {
    if (typeof v !== 'string' || (values as readonly string[]).indexOf(v) < 0) {
      this.err(path, `must be one of ${quote(values)}`);
      return false;
    }
    return true;
  }

  name(v: unknown, path: string): v is string {
    if (typeof v !== 'string' || codePoints(v) < 1 || codePoints(v) > 128) {
      this.err(path, 'must be a name of 1 to 128 characters');
      return false;
    }
    return true;
  }

  pattern(v: unknown, path: string, re: RegExp, maxLength: number, what: string): v is string {
    if (typeof v !== 'string' || codePoints(v) > maxLength || !re.test(v)) {
      this.err(path, `must be ${what}`);
      return false;
    }
    return true;
  }

  color(v: unknown, path: string): v is string {
    return this.pattern(v, path, HEX_RE, 7, 'a colour like "#RRGGBB"');
  }

  bool(v: unknown, path: string): v is boolean {
    if (typeof v !== 'boolean') {
      this.err(path, 'must be true or false');
      return false;
    }
    return true;
  }

  /** Two numbers; `item` checks each (default: any finite number). */
  pair(v: unknown, path: string, item?: (x: unknown, p: string) => boolean): v is [number, number] {
    if (!Array.isArray(v) || v.length !== 2) {
      this.err(path, 'must be an array of 2 numbers');
      return false;
    }
    let ok = true;
    for (let i = 0; i < 2; i++) {
      const p = `${path}[${i}]`;
      if (item) ok = item(v[i], p) && ok;
      else if (!isNum(v[i])) {
        this.err(p, 'must be a number');
        ok = false;
      }
    }
    return ok;
  }

  array(v: unknown, path: string, min: number, max: number): v is unknown[] {
    if (!Array.isArray(v)) {
      this.err(path, 'must be an array');
      return false;
    }
    if (v.length < min || v.length > max) {
      this.err(path, max === Infinity ? `needs at least ${min} items` : `must have ${min} to ${max} items`);
      return false;
    }
    return true;
  }

  ref(kind: RefKind, name: string, path: string): void {
    this.refs.push({ kind, name, path });
  }
}

const sub = (path: string, key: string): string => (path ? `${path}.${key}` : key);

/** The limits key for a target, or null (play/trigger, or an unknown shape). */
export function outputKeyOf(target: { kind: string; mode?: string; property?: string }): OutputKey | null {
  switch (target.kind) {
    case 'clip':
      return target.mode === 'speed' || target.mode === 'weight' || target.mode === 'scrub' ? (`clip.${target.mode}` as OutputKey) : null;
    case 'morph':
      return 'morph';
    case 'node':
      return (NODE_PROPERTIES as readonly string[]).indexOf(target.property || '') >= 0 ? (`node.${target.property}` as OutputKey) : null;
    case 'material':
      return (MATERIAL_PROPERTIES as readonly string[]).indexOf(target.property || '') >= 0 ? (`material.${target.property}` as OutputKey) : null;
    case 'light':
      return 'light.intensity';
    case 'camera':
      return target.property === 'orbitSpeed' || target.property === 'dolly' ? (`camera.${target.property}` as OutputKey) : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Structural + semantic checks per section

const TOP_KEYS = ['format', 'type', 'scene', 'poster', 'view', 'materials', 'audio', 'files'];
const VIEW_KEYS = ['background', 'lighting', 'exposure', 'camera'];
const CAMERA_KEYS = ['node', 'fov', 'distance', 'elevation', 'azimuth', 'orbitSpeed'];
const FRAMING_KEYS = ['fov', 'distance', 'elevation', 'azimuth'];
const AUDIO_KEYS = ['schemaVersion', 'idle', 'bindings', 'noteClips'];
const BINDING_KEYS = ['id', 'source', 'sources', 'combine', 'inputRange', 'outputRange', 'curve', 'steps', 'smoothing', 'invert', 'target'];
const TARGET_KEYS: { [K in TargetKind]: { allowed: string[]; required: string[] } } = {
  clip: { allowed: ['kind', 'clip', 'mode', 'threshold', 'fadeMs'], required: ['kind', 'clip', 'mode'] },
  morph: { allowed: ['kind', 'mesh', 'morph'], required: ['kind', 'mesh', 'morph'] },
  node: { allowed: ['kind', 'node', 'property', 'axis'], required: ['kind', 'node', 'property'] },
  material: { allowed: ['kind', 'material', 'property', 'colors'], required: ['kind', 'material', 'property'] },
  light: { allowed: ['kind', 'light', 'property'], required: ['kind', 'light', 'property'] },
  camera: { allowed: ['kind', 'property'], required: ['kind', 'property'] },
};
const NOTE_CLIPS_KEYS = ['initial', 'fadeMs', 'priority', 'onStop', 'returnAfterMs', 'rules'];
const RULE_KEYS = ['match', 'clip', 'mode', 'sync', 'fadeMs', 'timeScale', 'clipBpm', 'velocity'];

function checkView(c: Ctx, v: unknown): void {
  if (!c.object(v, 'view', VIEW_KEYS, [])) return;
  if (has(v, 'background')) c.color(v.background, 'view.background');
  if (has(v, 'lighting')) c.oneOf(v.lighting, 'view.lighting', ['studio', 'scene']);
  if (has(v, 'exposure')) c.num(v.exposure, 'view.exposure', 0.25, 4);
  if (!has(v, 'camera')) return;
  const cam = v.camera;
  if (!c.object(cam, 'view.camera', CAMERA_KEYS, [])) return;
  if (has(cam, 'node') && c.name(cam.node, 'view.camera.node')) c.ref('camera', cam.node, 'view.camera.node');
  if (has(cam, 'fov')) c.num(cam.fov, 'view.camera.fov', 20, 90);
  if (has(cam, 'distance')) c.num(cam.distance, 'view.camera.distance', 0.5, 10);
  if (has(cam, 'elevation')) c.num(cam.elevation, 'view.camera.elevation', -80, 80);
  if (has(cam, 'azimuth')) c.num(cam.azimuth, 'view.camera.azimuth', -180, 180);
  if (has(cam, 'orbitSpeed')) c.num(cam.orbitSpeed, 'view.camera.orbitSpeed', -90, 90);
  if (has(cam, 'node')) {
    for (let i = 0; i < FRAMING_KEYS.length; i++) {
      const k = FRAMING_KEYS[i];
      if (has(cam, k)) c.err(`view.camera.${k}`, 'not allowed with camera.node (the glTF camera frames the scene)');
    }
  }
}

function checkMaterials(c: Ctx, v: unknown): void {
  if (!c.array(v, 'materials', 0, c.limits.maxMaterialOverrides)) return;
  const seen: { [name: string]: number } = {};
  for (let i = 0; i < v.length; i++) {
    const path = `materials[${i}]`;
    const m = v[i];
    if (!c.object(m, path, ['material', 'toon'], ['material', 'toon'])) continue;
    if (has(m, 'material') && c.name(m.material, `${path}.material`)) {
      const name = m.material;
      if (Object.prototype.hasOwnProperty.call(seen, name)) {
        c.err(`${path}.material`, name === '*' ? '"*" may appear only once' : `"${name}" already has an override (materials[${seen[name]}])`);
      } else {
        seen[name] = i;
        if (name !== '*') c.ref('material', name, `${path}.material`);
      }
    }
    if (!has(m, 'toon')) continue;
    const toon = m.toon;
    if (!c.object(toon, `${path}.toon`, ['steps', 'outline'], ['steps'])) continue;
    if (has(toon, 'steps')) c.num(toon.steps, `${path}.toon.steps`, 2, 8, true);
    if (has(toon, 'outline')) {
      const o = toon.outline;
      if (c.object(o, `${path}.toon.outline`, ['width', 'color'], ['width'])) {
        if (has(o, 'width')) c.num(o.width, `${path}.toon.outline.width`, 0.001, 0.05);
        if (has(o, 'color')) c.color(o.color, `${path}.toon.outline.color`);
      }
    }
  }
}

interface ClipUse { clip: string; mode: ClipMode; index: number }

/** Checks a target; returns its identity key for the duplicate rule, null when it can't be keyed. */
function checkTarget(c: Ctx, t: unknown, path: string, clipUses: ClipUse[], index: number): { key: string | null; mode: ClipMode | null; outputKey: OutputKey | null } | null {
  if (!isObj(t)) {
    c.err(path, 'must be an object');
    return null;
  }
  if (!c.oneOf(t.kind, `${path}.kind`, TARGET_KINDS)) return null;
  const kind = t.kind;
  const spec = TARGET_KEYS[kind];
  if (!c.object(t, path, spec.allowed, spec.required)) return null;
  let key: string | null = null;
  let mode: ClipMode | null = null;
  switch (kind) {
    case 'clip': {
      const okClip = has(t, 'clip') && c.name(t.clip, `${path}.clip`);
      const okMode = has(t, 'mode') && c.oneOf(t.mode, `${path}.mode`, CLIP_MODES);
      if (has(t, 'threshold') && c.num(t.threshold, `${path}.threshold`, 0.01, 1) && okMode && t.mode !== 'play' && t.mode !== 'trigger') {
        c.err(`${path}.threshold`, 'only on play or trigger clip targets');
      }
      if (has(t, 'fadeMs')) c.num(t.fadeMs, `${path}.fadeMs`, 0, 5000);
      if (okClip) c.ref('clip', t.clip as string, `${path}.clip`);
      if (okClip && okMode) {
        mode = t.mode as ClipMode;
        key = `clip\u0000${t.clip}\u0000${mode}`;
        clipUses.push({ clip: t.clip as string, mode, index });
      }
      break;
    }
    case 'morph': {
      const okMesh = has(t, 'mesh') && c.name(t.mesh, `${path}.mesh`);
      let okMorph = false;
      if (has(t, 'morph')) {
        if (typeof t.morph === 'string') okMorph = c.name(t.morph, `${path}.morph`);
        else okMorph = c.num(t.morph, `${path}.morph`, 0, 31, true);
      }
      if (okMesh) c.ref('mesh', t.mesh as string, `${path}.mesh`);
      if (okMesh && okMorph) {
        c.morphs.push({ mesh: t.mesh as string, morph: t.morph as string | number, path: `${path}.morph` });
        key = `morph\u0000${t.mesh}\u0000${typeof t.morph}\u0000${t.morph}`;
      }
      break;
    }
    case 'node': {
      if (has(t, 'node') && c.name(t.node, `${path}.node`)) c.ref('node', t.node, `${path}.node`);
      if (has(t, 'property')) c.oneOf(t.property, `${path}.property`, NODE_PROPERTIES);
      if (has(t, 'axis')) c.oneOf(t.axis, `${path}.axis`, AXES);
      break; // node targets add up: no identity
    }
    case 'material': {
      const okMat = has(t, 'material') && c.name(t.material, `${path}.material`);
      const okProp = has(t, 'property') && c.oneOf(t.property, `${path}.property`, MATERIAL_PROPERTIES);
      let okColors = true;
      if (has(t, 'colors')) {
        if (!Array.isArray(t.colors) || t.colors.length !== 2) {
          c.err(`${path}.colors`, 'must be an array of 2 colours');
          okColors = false;
        } else {
          for (let i = 0; i < 2; i++) okColors = c.color(t.colors[i], `${path}.colors[${i}]`) && okColors;
        }
      }
      if (okProp && okColors) {
        const needs = t.property === 'color' || t.property === 'emissiveColor';
        if (needs && !has(t, 'colors')) c.err(`${path}.colors`, `required for ${t.property} (the two colours to blend between)`);
        if (!needs && has(t, 'colors')) c.err(`${path}.colors`, `only for color and emissiveColor, not ${t.property}`);
      }
      if (okMat) c.ref('material', t.material as string, `${path}.material`);
      if (okMat && okProp) key = `material\u0000${t.material}\u0000${t.property}`;
      break;
    }
    case 'light': {
      const okLight = has(t, 'light') && c.name(t.light, `${path}.light`);
      if (has(t, 'property') && t.property !== 'intensity') c.err(`${path}.property`, 'must be "intensity"');
      if (okLight) {
        c.ref('light', t.light as string, `${path}.light`);
        key = `light\u0000${t.light}`;
      }
      break;
    }
    case 'camera': {
      if (has(t, 'property') && c.oneOf(t.property, `${path}.property`, CAMERA_PROPERTIES)) key = `camera\u0000${t.property}`;
      break;
    }
  }
  return { key, mode, outputKey: outputKeyOf(t as { kind: string; mode?: string; property?: string }) };
}

function checkBinding(c: Ctx, b: unknown, path: string, clipUses: ClipUse[], index: number): string | null {
  if (!c.object(b, path, BINDING_KEYS, ['target'])) return null;
  if (has(b, 'id')) c.pattern(b.id, `${path}.id`, ID_RE, 32, '1 to 32 letters, digits, _ or -');

  // source XOR sources; combine only with sources
  if (has(b, 'source') && has(b, 'sources')) c.err(path, 'give source or sources, not both');
  else if (!has(b, 'source') && !has(b, 'sources')) c.err(path, 'needs source or sources');
  if (has(b, 'combine') && !has(b, 'sources')) c.err(`${path}.combine`, 'only with sources');
  if (has(b, 'source')) c.oneOf(b.source, `${path}.source`, SOURCE_NAMES);
  if (has(b, 'sources') && c.array(b.sources, `${path}.sources`, 1, c.limits.maxSourcesPerBinding)) {
    for (let i = 0; i < b.sources.length; i++) {
      const sp = `${path}.sources[${i}]`;
      const s: unknown = b.sources[i];
      if (!c.object(s, sp, ['source', 'weight'], ['source'])) continue;
      if (has(s, 'source')) c.oneOf(s.source, `${sp}.source`, SOURCE_NAMES);
      if (has(s, 'weight')) c.num(s.weight, `${sp}.weight`, -4, 4);
    }
  }
  if (has(b, 'combine')) c.oneOf(b.combine, `${path}.combine`, COMBINE_MODES);

  if (has(b, 'inputRange') && c.pair(b.inputRange, `${path}.inputRange`) && b.inputRange[0] === b.inputRange[1]) {
    c.err(`${path}.inputRange`, 'the two ends must differ');
  }
  const okOut = has(b, 'outputRange') && c.pair(b.outputRange, `${path}.outputRange`);
  const okCurve = has(b, 'curve') && c.oneOf(b.curve, `${path}.curve`, CURVES);
  if (has(b, 'steps') && c.num(b.steps, `${path}.steps`, 2, 16, true) && !(okCurve && b.curve === 'step')) {
    c.err(`${path}.steps`, 'only with curve "step"');
  }
  if (has(b, 'smoothing')) {
    const s: unknown = b.smoothing;
    if (c.object(s, `${path}.smoothing`, ['attackMs', 'releaseMs'], [])) {
      if (has(s, 'attackMs')) c.num(s.attackMs, `${path}.smoothing.attackMs`, 0, 5000);
      if (has(s, 'releaseMs')) c.num(s.releaseMs, `${path}.smoothing.releaseMs`, 0, 5000);
    }
  }
  if (has(b, 'invert')) c.bool(b.invert, `${path}.invert`);

  if (!has(b, 'target')) return null;
  const t = checkTarget(c, b.target, `${path}.target`, clipUses, index);
  if (!t) return null;
  if (okOut) {
    const range = b.outputRange as [number, number];
    if (t.mode === 'play' || t.mode === 'trigger') {
      c.err(`${path}.outputRange`, `not allowed on a ${t.mode} clip target (it follows the threshold)`);
    } else if (t.outputKey) {
      const bounds = c.limits.outputBounds[t.outputKey];
      if (range[0] < bounds[0] || range[0] > bounds[1] || range[1] < bounds[0] || range[1] > bounds[1]) {
        c.err(`${path}.outputRange`, `must stay within ${bounds[0]}..${bounds[1]} for ${t.outputKey}`);
      }
    }
  }
  return t.key;
}

function checkMatch(c: Ctx, m: unknown, path: string): void {
  if (!isObj(m)) {
    c.err(path, 'must be an object');
    return;
  }
  if (!has(m, 'part')) {
    c.err(`${path}.part`, 'required');
    return;
  }
  const part = m.part;
  let one: string;
  let many: string;
  if (part === 'synth' || part === 'samplerKeys' || part === 'keys') {
    one = 'note';
    many = 'notes';
  } else if (part === 'sampler') {
    one = 'slot';
    many = 'slots';
  } else if (part === 'drums') {
    one = 'voice';
    many = 'voices';
  } else {
    c.err(`${path}.part`, `must be one of ${quote(['synth', 'samplerKeys', 'keys', 'sampler', 'drums'])}`);
    return;
  }
  if (!c.object(m, path, ['part', one, many], ['part'])) return;
  if (has(m, one) && has(m, many)) c.err(path, `give ${one} or ${many}, not both`);
  else if (!has(m, one) && !has(m, many)) c.err(path, `needs ${one} or ${many}`);
  if (part === 'drums') {
    if (has(m, 'voice')) c.oneOf(m.voice, `${path}.voice`, DRUM_VOICES);
    if (has(m, 'voices') && c.array(m.voices, `${path}.voices`, 1, DRUM_VOICES.length)) {
      const vs = m.voices;
      for (let i = 0; i < vs.length; i++) {
        if (c.oneOf(vs[i], `${path}.voices[${i}]`, DRUM_VOICES) && vs.indexOf(vs[i]) !== i) c.err(`${path}.voices[${i}]`, 'listed twice');
      }
    }
    return;
  }
  const max = part === 'sampler' ? 15 : 127;
  if (has(m, one)) c.num(m[one], `${path}.${one}`, 0, max, true);
  if (has(m, many)) {
    const r: unknown = m[many];
    if (c.pair(r, `${path}.${many}`, (x, p) => c.num(x, p, 0, max, true)) && r[0] > r[1]) {
      c.err(`${path}.${many}`, 'the first must not exceed the second');
    }
  }
}

function checkNoteClips(c: Ctx, nc: unknown, path: string): void {
  if (!c.object(nc, path, NOTE_CLIPS_KEYS, ['initial', 'rules'])) return;
  if (has(nc, 'initial') && c.name(nc.initial, `${path}.initial`)) c.ref('clip', nc.initial, `${path}.initial`);
  if (has(nc, 'fadeMs')) c.num(nc.fadeMs, `${path}.fadeMs`, 0, 5000);
  if (has(nc, 'priority')) c.oneOf(nc.priority, `${path}.priority`, ['last', 'velocity']);
  if (has(nc, 'onStop')) c.oneOf(nc.onStop, `${path}.onStop`, ['hold', 'initial']);
  if (has(nc, 'returnAfterMs')) c.num(nc.returnAfterMs, `${path}.returnAfterMs`, 0, 60000);
  if (!has(nc, 'rules') || !c.array(nc.rules, `${path}.rules`, 1, c.limits.maxNoteClipRules)) return;
  for (let i = 0; i < nc.rules.length; i++) {
    const rp = `${path}.rules[${i}]`;
    const r: unknown = nc.rules[i];
    if (!c.object(r, rp, RULE_KEYS, ['match', 'clip'])) continue;
    if (has(r, 'match')) checkMatch(c, r.match, `${rp}.match`);
    if (has(r, 'clip') && c.name(r.clip, `${rp}.clip`)) c.ref('clip', r.clip, `${rp}.clip`);
    if (has(r, 'mode')) c.oneOf(r.mode, `${rp}.mode`, ['loop', 'once']);
    if (has(r, 'sync')) c.oneOf(r.sync, `${rp}.sync`, ['now', 'beat', 'bar']);
    if (has(r, 'fadeMs')) c.num(r.fadeMs, `${rp}.fadeMs`, 0, 5000);
    if (has(r, 'timeScale')) c.num(r.timeScale, `${rp}.timeScale`, 0.1, 4);
    if (has(r, 'clipBpm')) c.num(r.clipBpm, `${rp}.clipBpm`, 20, 300);
    if (has(r, 'velocity')) {
      const v = r.velocity;
      const vp = `${rp}.velocity`;
      if (c.object(v, vp, ['to', 'range'], ['to', 'range'])) {
        const okTo = has(v, 'to') && c.oneOf(v.to, `${vp}.to`, ['weight', 'timeScale']);
        if (has(v, 'range') && c.pair(v.range, `${vp}.range`) && okTo) {
          const bounds = c.limits.velocityBounds[v.to as 'weight' | 'timeScale'];
          const range = v.range;
          if (range[0] < bounds[0] || range[0] > bounds[1] || range[1] < bounds[0] || range[1] > bounds[1]) {
            c.err(`${vp}.range`, `must stay within ${bounds[0]}..${bounds[1]} for ${v.to}`);
          }
        }
      }
    }
  }
}

function checkAudio(c: Ctx, a: unknown): void {
  if (!c.object(a, 'audio', AUDIO_KEYS, ['schemaVersion'])) return;
  if (has(a, 'schemaVersion') && a.schemaVersion !== 1) c.err('audio.schemaVersion', 'must be 1');

  // One owner per clip: idle, then noteClips, then bindings; the later claimant gets the error.
  const idleClips: string[] = [];
  const noteClipNames: string[] = [];
  if (has(a, 'idle')) {
    const idle = a.idle;
    if (c.object(idle, 'audio.idle', ['clips'], ['clips']) && has(idle, 'clips') && c.array(idle.clips, 'audio.idle.clips', 1, c.limits.maxIdleClips)) {
      for (let i = 0; i < idle.clips.length; i++) {
        const p = `audio.idle.clips[${i}]`;
        const e = idle.clips[i];
        if (!c.object(e, p, ['clip', 'timeScale'], ['clip'])) continue;
        if (has(e, 'clip') && c.name(e.clip, `${p}.clip`)) {
          c.ref('clip', e.clip, `${p}.clip`);
          idleClips.push(e.clip);
        }
        if (has(e, 'timeScale')) c.num(e.timeScale, `${p}.timeScale`, 0.1, 4);
      }
    }
  }
  if (has(a, 'noteClips')) {
    checkNoteClips(c, a.noteClips, 'audio.noteClips');
    const nc = a.noteClips;
    if (isObj(nc)) {
      const claim = (name: unknown, path: string): void => {
        if (typeof name !== 'string') return;
        if (idleClips.indexOf(name) >= 0) c.err(path, `"${name}" is already driven by audio.idle; a clip has one owner`);
        else noteClipNames.push(name);
      };
      claim(nc.initial, 'audio.noteClips.initial');
      if (Array.isArray(nc.rules)) {
        for (let i = 0; i < nc.rules.length; i++) {
          const r: unknown = nc.rules[i];
          if (isObj(r)) claim(r.clip, `audio.noteClips.rules[${i}].clip`);
        }
      }
    }
  }
  if (!has(a, 'bindings') || !c.array(a.bindings, 'audio.bindings', 0, c.limits.maxBindings)) return;
  const clipUses: ClipUse[] = [];
  const identities: { [key: string]: number } = {};
  for (let i = 0; i < a.bindings.length; i++) {
    const path = `audio.bindings[${i}]`;
    const key = checkBinding(c, a.bindings[i], path, clipUses, i);
    if (key === null) continue;
    if (Object.prototype.hasOwnProperty.call(identities, key)) {
      c.err(`${path}.target`, `the same target as audio.bindings[${identities[key]}]; each target may be bound once (node targets excepted)`);
    } else {
      identities[key] = i;
    }
  }
  // Clip bindings: not on idle / noteClips clips; on one clip only speed + weight combine.
  for (let u = 0; u < clipUses.length; u++) {
    const use = clipUses[u];
    const path = `audio.bindings[${use.index}].target`;
    if (idleClips.indexOf(use.clip) >= 0) {
      c.err(`${path}.clip`, `"${use.clip}" is already driven by audio.idle; a clip has one owner`);
      continue;
    }
    if (noteClipNames.indexOf(use.clip) >= 0) {
      c.err(`${path}.clip`, `"${use.clip}" is already driven by audio.noteClips; a clip has one owner`);
      continue;
    }
    for (let p = 0; p < u; p++) {
      const prev = clipUses[p];
      if (prev.clip !== use.clip || prev.mode === use.mode) continue; // same mode: the duplicate rule reports it
      const combinable = (prev.mode === 'speed' || prev.mode === 'weight') && (use.mode === 'speed' || use.mode === 'weight');
      if (!combinable) {
        c.err(`${path}.mode`, `"${use.clip}" already has a ${prev.mode} binding (audio.bindings[${prev.index}]); only speed and weight combine on one clip`);
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Names against the scene summary

function countOf(list: readonly string[], name: string): number {
  let n = 0;
  for (let i = 0; i < list.length; i++) if (list[i] === name) n++;
  return n;
}

const KIND_WORD: { [K in RefKind]: string } = {
  clip: 'animation',
  node: 'node',
  mesh: 'mesh',
  material: 'material',
  light: 'node',
  camera: 'node',
};

function checkNames(c: Ctx, s: SceneSummary): void {
  const meshNames = s.meshes.map((m) => m.name);
  const clipNames = s.animations.map((a) => a.name);
  const listFor = (kind: RefKind): readonly string[] =>
    kind === 'clip' ? clipNames : kind === 'mesh' ? meshNames : kind === 'material' ? s.materials : s.nodes;
  for (let i = 0; i < c.refs.length; i++) {
    const r = c.refs[i];
    const n = countOf(listFor(r.kind), r.name);
    const word = KIND_WORD[r.kind];
    if (n === 0) {
      c.err(r.path, `"${r.name}" is not ${word === 'animation' ? 'an' : 'a'} ${word} in the scene`);
    } else if (n > 1) {
      c.err(r.path, `"${r.name}" names ${n} ${word}s in the scene; rename them so it is unique`);
    } else if (r.kind === 'light' && s.lights.indexOf(r.name) < 0) {
      c.err(r.path, `node "${r.name}" carries no KHR_lights_punctual light`);
    } else if (r.kind === 'camera' && s.cameras.indexOf(r.name) < 0) {
      c.err(r.path, `node "${r.name}" carries no camera`);
    }
  }
  for (let i = 0; i < c.morphs.length; i++) {
    const m = c.morphs[i];
    if (countOf(meshNames, m.mesh) !== 1) continue; // the mesh error covers it
    const morphs = s.meshes[meshNames.indexOf(m.mesh)].morphs;
    if (typeof m.morph === 'number') {
      if (m.morph >= morphs.length) c.err(m.path, `mesh "${m.mesh}" has ${morphs.length} morph target${morphs.length === 1 ? '' : 's'}; index ${m.morph} is out of range`);
    } else {
      const n = countOf(morphs, m.morph);
      if (n === 0) c.err(m.path, `"${m.morph}" is not a morph target of "${m.mesh}"`);
      else if (n > 1) c.err(m.path, `"${m.morph}" names ${n} morph targets of "${m.mesh}"; rename them so it is unique`);
    }
  }
}

/** Outlined primitives draw twice (spec §4.7): the total must stay within maxDrawCalls. */
function checkDrawCalls(c: Ctx, materials: unknown, s: SceneSummary, stats: SceneStats): void {
  if (!Array.isArray(materials)) return;
  const named: { [name: string]: boolean } = {};
  let star = false;
  for (let i = 0; i < materials.length; i++) {
    const m = materials[i];
    if (!isObj(m) || typeof m.material !== 'string' || !isObj(m.toon)) continue;
    const outlined = m.toon.outline !== undefined;
    if (m.material === '*') star = outlined;
    else named[m.material] = outlined;
  }
  let extra = 0;
  for (let i = 0; i < s.materials.length; i++) {
    const name = s.materials[i];
    const outlined = name !== '' && Object.prototype.hasOwnProperty.call(named, name) ? named[name] : star;
    if (outlined) extra += stats.materialDrawCalls[i] || 0;
  }
  const total = stats.drawCalls + extra;
  if (extra > 0 && total > c.limits.maxDrawCalls) {
    c.err('materials', `outlines raise the draw calls to ${total}; the limit is ${c.limits.maxDrawCalls}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Public API

export interface ValidateOptions {
  limits?: GltfLimits;
  /** The inspector's stats; enables the draw-call check that includes outlines (needs a summary). */
  stats?: SceneStats | null;
}

/**
 * All problems with a manifest as "<path>: <message>" strings (empty = valid). With `summary`
 * null, names are not resolved (structural and semantic rules only).
 */
export function validateManifest(manifest: unknown, summary: SceneSummary | null, opts: ValidateOptions = {}): string[] {
  const c = new Ctx(opts.limits || DEFAULT_LIMITS);
  if (!c.object(manifest, '', TOP_KEYS, ['format', 'type', 'scene', 'audio'])) return ['manifest: must be an object'];
  const m = manifest;
  if (has(m, 'format') && m.format !== 1) c.err('format', 'must be 1');
  if (has(m, 'type') && m.type !== 'gltf') c.err('type', 'must be "gltf"');
  if (has(m, 'scene')) c.pattern(m.scene, 'scene', GLB_RE, 255, 'a .glb file name without a directory');
  if (has(m, 'poster')) c.pattern(m.poster, 'poster', POSTER_RE, 255, 'a .png, .jpg or .webp file name without a directory');
  if (has(m, 'view')) checkView(c, m.view);
  if (has(m, 'materials')) checkMaterials(c, m.materials);
  if (has(m, 'audio')) checkAudio(c, m.audio);
  if (summary) {
    checkNames(c, summary);
    if (opts.stats) checkDrawCalls(c, m.materials, summary, opts.stats);
  }
  return c.errors;
}

/** True when the manifest is a structurally valid glTF visualizer manifest (names not checked). */
export function isGltfVisualizerManifest(m: unknown): m is GltfVisualizerManifest {
  return validateManifest(m, null).length === 0;
}

const range2 = (r: Range | [number, number]): [number, number] => [r[0], r[1]];

function normalizeTarget(t: TargetConfig): NormalizedTarget {
  switch (t.kind) {
    case 'clip':
      return {
        kind: 'clip',
        clip: t.clip,
        mode: t.mode,
        threshold: t.threshold !== undefined ? t.threshold : DEFAULT_THRESHOLD,
        fadeMs: t.fadeMs !== undefined ? t.fadeMs : DEFAULT_CLIP_FADE_MS,
      };
    case 'morph':
      return { kind: 'morph', mesh: t.mesh, morph: t.morph };
    case 'node':
      return { kind: 'node', node: t.node, property: t.property, axis: t.axis || DEFAULT_AXIS[t.property] };
    case 'material':
      return { kind: 'material', material: t.material, property: t.property, colors: t.colors ? [t.colors[0], t.colors[1]] : null };
    case 'light':
      return { kind: 'light', light: t.light, property: 'intensity' };
    case 'camera':
      return { kind: 'camera', property: t.property };
  }
}

function normalizeMatch(m: NoteMatchConfig): NormalizedNoteMatch {
  if (m.part === 'drums') {
    const names: readonly string[] = m.voices ? m.voices : m.voice ? [m.voice] : [];
    return { part: 'drums', lo: -1, hi: -1, voices: names.map((v) => (DRUM_VOICES as readonly string[]).indexOf(v)) };
  }
  if (m.part === 'sampler') {
    const r = m.slots ? m.slots : [m.slot as number, m.slot as number];
    return { part: 'sampler', lo: r[0], hi: r[1], voices: null };
  }
  const r = m.notes ? m.notes : [m.note as number, m.note as number];
  return { part: m.part, lo: r[0], hi: r[1], voices: null };
}

/**
 * Fills every default (spec §4.2–4.8, limits.outputDefaults). Throws when the manifest is not
 * structurally valid; names are not resolved here.
 */
export function normalizeManifest(manifest: unknown, limits: GltfLimits = DEFAULT_LIMITS): NormalizedGltfManifest {
  const errors = validateManifest(manifest, null, { limits });
  if (errors.length > 0) throw new Error(`invalid glTF visualizer manifest: ${errors[0]}`);
  const m = manifest as GltfVisualizerManifest;
  const view = m.view || {};
  const cam = view.camera || {};
  const audio = m.audio;
  const nc = audio.noteClips;
  const noteFade = nc && nc.fadeMs !== undefined ? nc.fadeMs : DEFAULT_NOTE_FADE_MS;
  return {
    scene: m.scene,
    poster: m.poster !== undefined ? m.poster : null,
    view: {
      background: view.background || DEFAULT_BACKGROUND,
      lighting: view.lighting || 'studio',
      exposure: view.exposure !== undefined ? view.exposure : DEFAULT_EXPOSURE,
      camera: {
        node: cam.node !== undefined ? cam.node : null,
        fov: cam.fov !== undefined ? cam.fov : DEFAULT_CAMERA.fov,
        distance: cam.distance !== undefined ? cam.distance : DEFAULT_CAMERA.distance,
        elevation: cam.elevation !== undefined ? cam.elevation : DEFAULT_CAMERA.elevation,
        azimuth: cam.azimuth !== undefined ? cam.azimuth : DEFAULT_CAMERA.azimuth,
        orbitSpeed: cam.orbitSpeed !== undefined ? cam.orbitSpeed : DEFAULT_CAMERA.orbitSpeed,
      },
    },
    materials: (m.materials || []).map((o) => ({
      material: o.material,
      steps: o.toon.steps,
      outline: o.toon.outline ? { width: o.toon.outline.width, color: o.toon.outline.color || DEFAULT_OUTLINE_COLOR } : null,
    })),
    audio: {
      idle: audio.idle ? audio.idle.clips.map((c) => ({ clip: c.clip, timeScale: c.timeScale !== undefined ? c.timeScale : 1 })) : [],
      bindings: (audio.bindings || []).map((b, index) => {
        const target = normalizeTarget(b.target);
        const outputKey = outputKeyOf(b.target);
        const sm = b.smoothing || {};
        const curve = b.curve || 'linear';
        return {
          index,
          id: b.id !== undefined ? b.id : `binding-${index}`,
          sources: b.sources
            ? b.sources.map((s) => ({ source: s.source, weight: s.weight !== undefined ? s.weight : 1 }))
            : [{ source: b.source as SourceName, weight: 1 }],
          combine: b.combine || 'sum',
          inputRange: b.inputRange ? range2(b.inputRange) : [0, 1],
          outputRange: b.outputRange ? range2(b.outputRange) : outputKey ? range2(limits.outputDefaults[outputKey]) : [0, 1],
          curve,
          steps: b.steps !== undefined ? b.steps : DEFAULT_STEPS,
          attackMs: sm.attackMs !== undefined ? sm.attackMs : 0,
          releaseMs: sm.releaseMs !== undefined ? sm.releaseMs : 0,
          invert: b.invert === true,
          target,
          outputKey,
        };
      }),
      noteClips: nc
        ? {
            initial: nc.initial,
            fadeMs: noteFade,
            priority: nc.priority || 'last',
            onStop: nc.onStop || 'hold',
            returnAfterMs: nc.returnAfterMs !== undefined ? nc.returnAfterMs : 0,
            rules: nc.rules.map((r, index) => ({
              index,
              match: normalizeMatch(r.match),
              clip: r.clip,
              mode: r.mode || 'loop',
              sync: r.sync || 'now',
              fadeMs: r.fadeMs !== undefined ? r.fadeMs : noteFade,
              timeScale: r.timeScale !== undefined ? r.timeScale : 1,
              clipBpm: r.clipBpm !== undefined ? r.clipBpm : 0,
              velocity: r.velocity ? { to: r.velocity.to, range: range2(r.velocity.range) } : null,
            })),
          }
        : null,
    },
  };
}
