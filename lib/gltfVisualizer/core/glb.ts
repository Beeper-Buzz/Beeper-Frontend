// GLB inspection (spec §6.3): structure, self-containment, limits, and the scene summary the
// manifest validator resolves names against. Pure TS over a Uint8Array: no DOM, no Node, no
// TextDecoder (Hermes may lack it), so the app, the web studio and tests run the same checks.
// The Ruby inspector in beeper-admin ports this file; keep the two in step.

import { DEFAULT_LIMITS, GltfLimits } from './limits';

/** The names a config can reference. Duplicates are kept so ambiguity is detectable; unnamed → "". */
export interface SceneSummary {
  nodes: string[];
  /** `morphs` has one entry per morph target (names from `extras.targetNames`, "" when unnamed). */
  meshes: { name: string; morphs: string[] }[];
  materials: string[];
  animations: { name: string; duration: number }[];
  /** Names of nodes carrying a KHR_lights_punctual light. */
  lights: string[];
  /** Names of nodes carrying a camera. */
  cameras: string[];
}

export interface ImageStat {
  index: number;
  mime: string;
  width: number;
  height: number;
  bytes: number;
}

export interface ClipStat {
  name: string;
  duration: number;
  keyframes: number;
}

export interface SceneStats {
  bytes: number;
  nodes: number;
  meshes: number;
  materials: number;
  skins: number;
  lights: number;
  cameras: number;
  /** Morph targets summed over meshes. */
  morphTargets: number;
  /** Triangles drawn: per primitive by mode, × the nodes instancing its mesh. */
  triangles: number;
  /** POSITION counts × instances. */
  vertices: number;
  /** Primitives × instances (outlines not included; the manifest validator adds them). */
  drawCalls: number;
  /** Draw calls per glTF material index, so outline draw calls can be counted. */
  materialDrawCalls: number[];
  images: ImageStat[];
  texturePixels: number;
  clips: ClipStat[];
  keyframes: number;
}

export interface GlbInspection {
  errors: string[];
  /** null when the file is not a readable GLB (header, chunks or JSON). */
  summary: SceneSummary | null;
  stats: SceneStats | null;
}

const MAGIC_GLTF = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"

const COMPONENT_SIZES: { [type: number]: number } = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COMPONENTS: { [type: string]: number } = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const INDEX_SIZES: { [type: number]: number } = { 5121: 1, 5123: 2, 5125: 4 };

// Work bounds against crafted files (the Ruby inspector uses the same numbers and messages).
/** Errors kept; any beyond are summarised by one final "scene: …and N more problem(s)". */
export const MAX_ERRORS = 100;
/** An array with a limit is skipped (treated as empty) when longer than this × its limit. */
export const SKIP_FACTOR = 4;
/** Length cap, and skip, for arrays the limits don't bound (accessors, bufferViews, …). */
export const MAX_UNBOUNDED_ARRAY = 65536;
/** JSON arrays/objects nested deeper than this are refused (Ruby JSON's max_nesting default). */
export const MAX_JSON_DEPTH = 100;
/** Markers a JPEG header scan reads before giving up. */
export const MAX_JPEG_MARKERS = 512;

type Json = { [key: string]: unknown };

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const nameOf = (o: unknown): string => (isObj(o) && typeof o.name === 'string' ? o.name : '');
const mb = (n: number): string => `${(n / 1048576).toFixed(1)} MB`;

// ---------------------------------------------------------------------------------------------
// UTF-8

function utf8(bytes: Uint8Array, start: number, end: number, fatal: boolean): string | null {
  const parts: string[] = [];
  let units: number[] = [];
  let i = start;
  while (i < end) {
    const b0 = bytes[i];
    let cp = -1;
    let len = 1;
    if (b0 < 0x80) {
      cp = b0;
    } else if (b0 >= 0xc2 && b0 <= 0xdf) {
      len = 2;
      const b1 = i + 1 < end ? bytes[i + 1] : 0;
      if ((b1 & 0xc0) === 0x80) cp = ((b0 & 0x1f) << 6) | (b1 & 0x3f);
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      len = 3;
      const b1 = i + 1 < end ? bytes[i + 1] : 0;
      const b2 = i + 2 < end ? bytes[i + 2] : 0;
      const lo = b0 === 0xe0 ? 0xa0 : 0x80; // no overlongs
      const hi = b0 === 0xed ? 0x9f : 0xbf; // no surrogates
      if (b1 >= lo && b1 <= hi && (b2 & 0xc0) === 0x80) cp = ((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f);
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      len = 4;
      const b1 = i + 1 < end ? bytes[i + 1] : 0;
      const b2 = i + 2 < end ? bytes[i + 2] : 0;
      const b3 = i + 3 < end ? bytes[i + 3] : 0;
      const lo = b0 === 0xf0 ? 0x90 : 0x80;
      const hi = b0 === 0xf4 ? 0x8f : 0xbf; // ≤ U+10FFFF
      if (b1 >= lo && b1 <= hi && (b2 & 0xc0) === 0x80 && (b3 & 0xc0) === 0x80) {
        cp = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      }
    }
    if (cp < 0) {
      if (fatal) return null;
      cp = 0xfffd;
      len = 1;
    }
    i += len;
    if (cp > 0xffff) {
      cp -= 0x10000;
      units.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      units.push(cp);
    }
    // Flush in slices: fromCharCode.apply has an argument-count ceiling.
    if (units.length >= 8192) {
      parts.push(String.fromCharCode.apply(null, units));
      units = [];
    }
  }
  if (units.length > 0) parts.push(String.fromCharCode.apply(null, units));
  return parts.join('');
}

/** Strict UTF-8 → string; null on any invalid sequence. Does not need TextDecoder. */
export function decodeUtf8(bytes: Uint8Array, start = 0, end = bytes.length): string | null {
  return utf8(bytes, start, end, true);
}

/** Lenient UTF-8 → string (invalid bytes become U+FFFD), for a TextDecoder shim. */
export function decodeUtf8Lossy(bytes: Uint8Array, start = 0, end = bytes.length): string {
  return utf8(bytes, start, end, false) as string;
}

/** string → UTF-8 bytes (lone surrogates become U+FFFD). Does not need TextEncoder. */
export function encodeUtf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let cp = s.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < s.length) {
      const lo = s.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      } else {
        cp = 0xfffd;
      }
    } else if (cp >= 0xd800 && cp <= 0xdfff) {
      cp = 0xfffd;
    }
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return new Uint8Array(out);
}

// ---------------------------------------------------------------------------------------------
// Image headers

/** 'image/png' | 'image/jpeg' from the magic bytes, else null. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

const isJpegSof = (m: number): boolean =>
  (m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf);

/**
 * Pixel size from a PNG IHDR or the first JPEG SOFn, without decoding. null when the bytes
 * don't match `mime` or the header can't be read.
 */
export function imageSize(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  if (sniffImageMime(bytes) !== mime) return null;
  const n = bytes.length;
  if (mime === 'image/png') {
    // Signature (8), then the IHDR chunk: length (4), "IHDR", width (4, BE), height (4, BE).
    if (n < 24 || bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) return null;
    const w = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
    const h = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
    return w > 0 && h > 0 ? { width: w, height: h } : null;
  }
  if (mime === 'image/jpeg') {
    let i = 2;
    let markers = 0;
    while (i + 1 < n) {
      if (bytes[i] !== 0xff) return null;
      if (++markers > MAX_JPEG_MARKERS) return null; // a crafted marker chain can't run long
      let m = bytes[i + 1];
      while (m === 0xff && i + 2 < n) {
        i++; // fill bytes
        m = bytes[i + 1];
      }
      i += 2;
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) continue; // no length field
      if (m === 0xd9 || m === 0xda) return null; // end of image / scan data before any SOF
      if (i + 2 > n) return null;
      const len = (bytes[i] << 8) | bytes[i + 1];
      if (len < 2) return null;
      if (isJpegSof(m)) {
        if (i + 7 > n) return null;
        const h = (bytes[i + 3] << 8) | bytes[i + 4];
        const w = (bytes[i + 5] << 8) | bytes[i + 6];
        return w > 0 && h > 0 ? { width: w, height: h } : null;
      }
      i += len;
    }
  }
  return null;
}

const PNG_IEND = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
/** 0x00 bytes tolerated after an image's trailer (padding some exporters leave in the view). */
export const MAX_IMAGE_PADDING = 3;

/**
 * True when the bytes end with the format's trailer once up to MAX_IMAGE_PADDING trailing 0x00
 * bytes are dropped: PNG, a whole IEND chunk (00 00 00 00 "IEND" AE 42 60 82); JPEG, EOI (FF D9).
 * Both trailers end in a non-zero byte, so dropping zeros first is unambiguous. A truncated
 * image still has a readable header but decodes blank in some loaders (stb_image).
 */
export function hasImageTrailer(bytes: Uint8Array, mime: string): boolean {
  let end = bytes.length;
  for (let k = 0; k < MAX_IMAGE_PADDING && end > 0 && bytes[end - 1] === 0; k++) end--;
  if (mime === 'image/png') {
    if (end < PNG_IEND.length) return false;
    for (let i = 0; i < PNG_IEND.length; i++) if (bytes[end - PNG_IEND.length + i] !== PNG_IEND[i]) return false;
    return true;
  }
  if (mime === 'image/jpeg') return end >= 2 && bytes[end - 2] === 0xff && bytes[end - 1] === 0xd9;
  return false;
}

// ---------------------------------------------------------------------------------------------
// GLB

/**
 * True when JSON text nests arrays/objects deeper than `max`. A string-aware bracket scan run
 * before JSON.parse, so the result doesn't depend on the parser (Ruby mirrors it exactly):
 * outside strings '[' and '{' add one and ']' and '}' subtract one; '"' opens a string, inside
 * which a backslash skips the next character and '"' closes it. The outermost value is depth 1.
 */
export function jsonTooDeep(text: string, max: number = MAX_JSON_DEPTH): boolean {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (c === 0x5c) i++; // backslash
      else if (c === 0x22) inString = false;
    } else if (c === 0x22) {
      inString = true;
    } else if (c === 0x5b || c === 0x7b) {
      if (++depth > max) return true;
    } else if (c === 0x5d || c === 0x7d) {
      depth--;
    }
  }
  return false;
}

/** Inspects a GLB per spec §6.3. Errors are "<path>: <message>" with paths under `scene`. */
export function inspectGlb(bytes: Uint8Array, limits: GltfLimits = DEFAULT_LIMITS): GlbInspection {
  const errors: string[] = [];
  const fatal = (message: string): GlbInspection => {
    errors.push(`scene: ${message}`);
    return { errors, summary: null, stats: null };
  };
  const n = bytes.length;
  if (n > limits.glbMaxBytes) return fatal(`the file is ${mb(n)}; the limit is ${mb(limits.glbMaxBytes)}`);
  if (n < 20) return fatal('not a GLB file (too short); export glTF Binary (.glb)');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (o: number): number => dv.getUint32(o, true);
  if (u32(0) !== MAGIC_GLTF) return fatal('not a GLB file (no glTF magic); export glTF Binary (.glb)');
  if (u32(4) !== 2) return fatal(`GLB version ${u32(4)}; only version 2 is supported`);
  if (u32(8) !== n) return fatal(`the header says ${u32(8)} bytes but the file has ${n}`);

  const jsonLength = u32(12);
  if (u32(16) !== CHUNK_JSON) return fatal('the first chunk is not JSON');
  if (jsonLength % 4 !== 0) return fatal('the JSON chunk length is not a multiple of 4');
  if (20 + jsonLength > n) return fatal('the JSON chunk runs past the end of the file');
  if (jsonLength > limits.jsonChunkMaxBytes) {
    return fatal(`the JSON chunk is ${mb(jsonLength)}; the limit is ${mb(limits.jsonChunkMaxBytes)}`);
  }
  const text = decodeUtf8(bytes, 20, 20 + jsonLength);
  if (text === null) return fatal('the JSON chunk is not valid UTF-8');
  if (jsonTooDeep(text)) return fatal('JSON nested too deeply');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return fatal('the JSON chunk is not valid JSON');
  }
  if (!isObj(parsed)) return fatal('the JSON chunk is not an object');
  const json = parsed;

  let binStart = 0;
  let binLength = 0;
  let offset = 20 + jsonLength;
  if (offset < n) {
    if (offset + 8 > n) return fatal('a truncated chunk follows the JSON chunk');
    const length = u32(offset);
    if (u32(offset + 4) !== CHUNK_BIN) return fatal('only one BIN chunk may follow the JSON chunk');
    if (offset + 8 + length > n) return fatal('the BIN chunk runs past the end of the file');
    binStart = offset + 8;
    binLength = length;
    offset += 8 + length;
    if (offset !== n) return fatal('unexpected data after the BIN chunk');
  }

  let dropped = 0;
  const err = (path: string, message: string): void => {
    if (errors.length < MAX_ERRORS) errors.push(`${path}: ${message}`);
    else dropped++;
  };
  // Over SKIP_FACTOR × limit (or MAX_UNBOUNDED_ARRAY without one): one "<n> <noun>; the limit is
  // <limit>" error and the array counts as empty from then on, so nothing iterates it.
  const capped = (path: string, noun: string, v: unknown[], limit: number | null): unknown[] => {
    if (v.length <= (limit === null ? MAX_UNBOUNDED_ARRAY : SKIP_FACTOR * limit)) return v;
    err(path, `${v.length} ${noun}; the limit is ${limit === null ? MAX_UNBOUNDED_ARRAY : limit}`);
    return [];
  };
  const arrayOf = (key: string, limit: number | null = null): unknown[] => {
    const v = json[key];
    if (v === undefined) return [];
    if (!Array.isArray(v)) {
      err(`scene.${key}`, 'must be an array');
      return [];
    }
    return capped(`scene.${key}`, key, v, limit);
  };
  // Arrays inspected only for their length.
  for (const key of ['samplers', 'textures', 'scenes']) {
    const v = json[key];
    if (Array.isArray(v)) capped(`scene.${key}`, key, v, null);
  }

  // asset + extensions
  if (!isObj(json.asset) || json.asset.version !== '2.0') err('scene.asset.version', 'must be "2.0"');
  const used = arrayOf('extensionsUsed');
  for (let i = 0; i < used.length; i++) {
    const e = used[i];
    if (typeof e !== 'string') {
      err(`scene.extensionsUsed[${i}]`, 'must be a string');
    } else if (limits.allowedExtensions.indexOf(e) < 0) {
      const why = own(limits.rejectedExtensions, e) ? limits.rejectedExtensions[e] : `not supported (allowed: ${limits.allowedExtensions.join(', ')})`;
      err('scene.extensionsUsed', `${e}: ${why}`);
    }
  }
  const usedSet: { [name: string]: boolean } = Object.create(null); // linear, not used.indexOf per entry
  for (let i = 0; i < used.length; i++) if (typeof used[i] === 'string') usedSet[used[i] as string] = true;
  const required = arrayOf('extensionsRequired');
  for (let i = 0; i < required.length; i++) {
    const r = required[i];
    if (typeof r !== 'string' || !usedSet[r]) err('scene.extensionsRequired', `${String(r)} is not listed in extensionsUsed`);
  }

  // buffers: one, no uri, inside the BIN chunk
  const buffers = arrayOf('buffers');
  if (buffers.length > 1) err('scene.buffers', `${buffers.length} buffers; a GLB has one, its BIN chunk`);
  let bufferLength = 0;
  for (let i = 0; i < buffers.length; i++) {
    const b = buffers[i];
    if (!isObj(b)) {
      err(`scene.buffers[${i}]`, 'must be an object');
      continue;
    }
    if (b.uri !== undefined) err(`scene.buffers[${i}].uri`, 'external and data-URI buffers are not allowed; export GLB');
    if (i !== 0) continue;
    if (!isInt(b.byteLength) || b.byteLength < 0) err('scene.buffers[0].byteLength', 'must be a non-negative integer');
    else if (b.byteLength > binLength) err('scene.buffers[0].byteLength', `${b.byteLength} exceeds the BIN chunk (${binLength} bytes)`);
    else bufferLength = b.byteLength;
  }

  // bufferViews inside the buffer
  const views = arrayOf('bufferViews');
  const viewOk: boolean[] = [];
  const viewStart: number[] = []; // offset in `bytes`
  const viewLength: number[] = [];
  const viewStride: number[] = [];
  for (let i = 0; i < views.length; i++) {
    const v = views[i];
    const path = `scene.bufferViews[${i}]`;
    viewOk.push(false);
    viewStart.push(0);
    viewLength.push(0);
    viewStride.push(0);
    if (!isObj(v)) {
      err(path, 'must be an object');
      continue;
    }
    const off = v.byteOffset === undefined ? 0 : v.byteOffset;
    if (v.buffer !== 0 || buffers.length === 0) {
      err(`${path}.buffer`, 'no such buffer');
    } else if (!isInt(off) || off < 0) {
      err(`${path}.byteOffset`, 'must be a non-negative integer');
    } else if (!isInt(v.byteLength) || v.byteLength < 1) {
      err(`${path}.byteLength`, 'must be a positive integer');
    } else if (v.byteStride !== undefined && (!isInt(v.byteStride) || v.byteStride < 4 || v.byteStride > 252 || v.byteStride % 4 !== 0)) {
      err(`${path}.byteStride`, 'must be a multiple of 4 between 4 and 252');
    } else if (off + v.byteLength > bufferLength) {
      err(path, `bytes ${off}..${off + v.byteLength} lie outside the buffer (${bufferLength} bytes)`);
    } else {
      viewOk[i] = true;
      viewStart[i] = binStart + off;
      viewLength[i] = v.byteLength;
      viewStride[i] = isInt(v.byteStride) ? v.byteStride : 0;
    }
  }

  // accessors inside their bufferViews (sparse too). Element size has no matrix column padding.
  const accessors = arrayOf('accessors');
  const accCount: number[] = [];
  const viewRange = (path: string, view: unknown, start: number, end: number): void => {
    if (!isInt(view) || view < 0 || view >= views.length) err(`${path}.bufferView`, 'no such bufferView');
    else if (viewOk[view] && end > viewLength[view]) err(path, `needs bytes ${start}..${end} of bufferView ${view}, which has ${viewLength[view]}`);
  };
  for (let i = 0; i < accessors.length; i++) {
    const a = accessors[i];
    const path = `scene.accessors[${i}]`;
    accCount.push(-1);
    if (!isObj(a)) {
      err(path, 'must be an object');
      continue;
    }
    const cs = typeof a.componentType === 'number' && own(COMPONENT_SIZES, String(a.componentType)) ? COMPONENT_SIZES[a.componentType] : 0;
    const nc = typeof a.type === 'string' && own(TYPE_COMPONENTS, a.type) ? TYPE_COMPONENTS[a.type] : 0;
    if (cs === 0) err(`${path}.componentType`, 'must be one of 5120, 5121, 5122, 5123, 5125, 5126');
    if (nc === 0) err(`${path}.type`, 'must be one of SCALAR, VEC2, VEC3, VEC4, MAT2, MAT3, MAT4');
    if (!isInt(a.count) || a.count < 1) err(`${path}.count`, 'must be a positive integer');
    if (cs === 0 || nc === 0 || !isInt(a.count) || a.count < 1) continue;
    const count = a.count;
    const element = cs * nc;
    if (a.bufferView !== undefined) {
      const off = a.byteOffset === undefined ? 0 : a.byteOffset;
      if (!isInt(off) || off < 0) {
        err(`${path}.byteOffset`, 'must be a non-negative integer');
        continue;
      }
      const view = a.bufferView;
      const stride = isInt(view) && view >= 0 && view < views.length && viewStride[view] > 0 ? viewStride[view] : element;
      viewRange(path, view, off, off + stride * (count - 1) + element);
    }
    if (a.sparse !== undefined) {
      const s = a.sparse;
      const sp = `${path}.sparse`;
      if (!isObj(s) || !isInt(s.count) || s.count < 1 || s.count > count) {
        err(`${sp}.count`, `must be an integer from 1 to the accessor count (${count})`);
      } else {
        const ind = s.indices;
        const val = s.values;
        const isz = isObj(ind) && typeof ind.componentType === 'number' && own(INDEX_SIZES, String(ind.componentType)) ? INDEX_SIZES[ind.componentType] : 0;
        if (!isObj(ind) || isz === 0) {
          err(`${sp}.indices`, 'needs a bufferView and an unsigned componentType');
        } else {
          const off = ind.byteOffset === undefined ? 0 : ind.byteOffset;
          if (!isInt(off) || off < 0) err(`${sp}.indices.byteOffset`, 'must be a non-negative integer');
          else viewRange(`${sp}.indices`, ind.bufferView, off, off + s.count * isz);
        }
        if (!isObj(val)) {
          err(`${sp}.values`, 'needs a bufferView');
        } else {
          const off = val.byteOffset === undefined ? 0 : val.byteOffset;
          if (!isInt(off) || off < 0) err(`${sp}.values.byteOffset`, 'must be a non-negative integer');
          else viewRange(`${sp}.values`, val.bufferView, off, off + s.count * element);
        }
      }
    }
    accCount[i] = count;
  }
  const accessorCount = (ref: unknown): number => (isInt(ref) && ref >= 0 && ref < accCount.length ? accCount[ref] : -1);

  // images: embedded PNG/JPEG, header dimensions within the limits. Past maxImages only the count
  // error is reported; headers are read once per bufferView, in place.
  const images = arrayOf('images', limits.maxImages);
  if (images.length > limits.maxImages) err('scene.images', `${images.length} images; the limit is ${limits.maxImages}`);
  const imageStats: ImageStat[] = [];
  const headers: ({ mime: string | null; size: { width: number; height: number } | null; complete: boolean } | undefined)[] = [];
  let texturePixels = 0;
  const inspected = Math.min(images.length, limits.maxImages);
  for (let i = 0; i < inspected; i++) {
    const img = images[i];
    const path = `scene.images[${i}]`;
    if (!isObj(img)) {
      err(path, 'must be an object');
      continue;
    }
    if (img.uri !== undefined) {
      err(`${path}.uri`, 'images must be embedded in the GLB (bufferView), not referenced by uri');
      continue;
    }
    const view = img.bufferView;
    if (!isInt(view) || view < 0 || view >= views.length) {
      err(path, 'needs a bufferView');
      continue;
    }
    const mime = img.mimeType;
    if (typeof mime !== 'string' || limits.imageMimeTypes.indexOf(mime) < 0) {
      err(`${path}.mimeType`, `${String(mime)}; textures must be ${limits.imageMimeTypes.join(' or ')}`);
      continue;
    }
    if (!viewOk[view]) continue; // its bufferView already has an error
    let head = headers[view];
    if (head === undefined) {
      const data = bytes.subarray(viewStart[view], viewStart[view] + viewLength[view]);
      const sniffed = sniffImageMime(data);
      head = {
        mime: sniffed,
        size: sniffed === null ? null : imageSize(data, sniffed),
        complete: sniffed !== null && hasImageTrailer(data, sniffed),
      };
      headers[view] = head;
    }
    const kind = mime === 'image/png' ? 'PNG' : 'JPEG';
    if (head.mime !== mime) {
      err(path, `the bytes are not a ${kind} (mimeType says ${mime})`);
      continue;
    }
    const size = head.size;
    if (size === null) {
      err(path, `can't read the ${kind} header`);
      continue;
    }
    if (!head.complete) {
      err(path, `the ${kind} is cut short (no ${kind === 'PNG' ? 'IEND' : 'EOI'})`);
      continue;
    }
    if (size.width > limits.maxTextureSize || size.height > limits.maxTextureSize) {
      err(path, `${size.width}×${size.height} exceeds ${limits.maxTextureSize}×${limits.maxTextureSize}`);
    }
    texturePixels += size.width * size.height;
    imageStats.push({ index: i, mime, width: size.width, height: size.height, bytes: viewLength[view] });
  }
  if (texturePixels > limits.maxTexturePixels) {
    err('scene.images', `${texturePixels} pixels in total; the limit is ${limits.maxTexturePixels}`);
  }

  // scene graph counts
  const nodes = arrayOf('nodes', limits.maxNodes);
  const meshes = arrayOf('meshes', limits.maxMeshes);
  const materials = arrayOf('materials', limits.maxMaterials);
  const skins = arrayOf('skins', limits.maxSkins);
  const cameras = arrayOf('cameras', limits.maxCameras);
  const animations = arrayOf('animations', limits.maxAnimations);
  const lightsExt = isObj(json.extensions) && isObj(json.extensions.KHR_lights_punctual) ? json.extensions.KHR_lights_punctual : null;
  const lights =
    lightsExt && Array.isArray(lightsExt.lights) ? capped('scene.extensions.KHR_lights_punctual.lights', 'lights', lightsExt.lights, limits.maxLights) : [];
  if (nodes.length > limits.maxNodes) err('scene.nodes', `${nodes.length} nodes; the limit is ${limits.maxNodes}`);
  if (meshes.length > limits.maxMeshes) err('scene.meshes', `${meshes.length} meshes; the limit is ${limits.maxMeshes}`);
  if (materials.length > limits.maxMaterials) err('scene.materials', `${materials.length} materials; the limit is ${limits.maxMaterials}`);
  if (skins.length > limits.maxSkins) err('scene.skins', `${skins.length} skins; the limit is ${limits.maxSkins}`);
  for (let i = 0; i < skins.length; i++) {
    const s = skins[i];
    const joints = isObj(s) && Array.isArray(s.joints) ? s.joints.length : 0;
    if (joints > limits.maxJoints) err(`scene.skins[${i}].joints`, `${joints} joints; the limit is ${limits.maxJoints}`);
  }
  if (cameras.length > limits.maxCameras) err('scene.cameras', `${cameras.length} cameras; the limit is ${limits.maxCameras}`);
  if (lights.length > limits.maxLights) {
    err('scene.extensions.KHR_lights_punctual.lights', `${lights.length} lights; the limit is ${limits.maxLights}`);
  }

  // meshes: per-mesh triangles / vertices / primitives, morph targets
  const meshTriangles: number[] = [];
  const meshVertices: number[] = [];
  const meshPrimitiveMaterials: number[][] = []; // material index per primitive (-1 none)
  const meshSummaries: { name: string; morphs: string[] }[] = [];
  let morphTargets = 0;
  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m];
    const path = `scene.meshes[${m}]`;
    let tris = 0;
    let verts = 0;
    let targets = 0;
    const mats: number[] = [];
    const prims = isObj(mesh) && Array.isArray(mesh.primitives) ? capped(`${path}.primitives`, 'primitives', mesh.primitives, limits.maxDrawCalls) : [];
    if (!isObj(mesh) || !Array.isArray(mesh.primitives)) err(`${path}.primitives`, 'must be an array');
    for (let p = 0; p < prims.length; p++) {
      const prim = prims[p];
      const pp = `${path}.primitives[${p}]`;
      if (!isObj(prim) || !isObj(prim.attributes)) {
        err(`${pp}.attributes`, 'must be an object');
        mats.push(-1);
        continue;
      }
      const position = prim.attributes.POSITION;
      let positions = 0;
      if (position !== undefined) {
        positions = accessorCount(position);
        if (positions < 0) {
          err(`${pp}.attributes.POSITION`, 'no such accessor');
          positions = 0;
        }
      }
      let drawn = positions;
      if (prim.indices !== undefined) {
        drawn = accessorCount(prim.indices);
        if (drawn < 0) {
          err(`${pp}.indices`, 'no such accessor');
          drawn = 0;
        }
      }
      const mode = prim.mode === undefined ? 4 : prim.mode;
      if (mode === 4) tris += Math.floor(drawn / 3);
      else if (mode === 5 || mode === 6) tris += Math.max(drawn - 2, 0);
      verts += positions;
      if (Array.isArray(prim.targets)) targets = Math.max(targets, prim.targets.length);
      let mat = -1;
      if (prim.material !== undefined) {
        if (isInt(prim.material) && prim.material >= 0 && prim.material < materials.length) mat = prim.material;
        else err(`${pp}.material`, 'no such material');
      }
      mats.push(mat);
    }
    if (targets > limits.maxMorphTargets) err(path, `${targets} morph targets; the limit is ${limits.maxMorphTargets}`);
    morphTargets += targets;
    const extras = isObj(mesh) && isObj(mesh.extras) ? mesh.extras : null;
    const targetNames = extras && Array.isArray(extras.targetNames) ? extras.targetNames : [];
    const morphs: string[] = [];
    // Names are listed only up to SKIP_FACTOR × the limit; past the limit the error above stands.
    if (targets <= SKIP_FACTOR * limits.maxMorphTargets) {
      for (let t = 0; t < targets; t++) morphs.push(typeof targetNames[t] === 'string' ? (targetNames[t] as string) : '');
    }
    meshSummaries.push({ name: nameOf(mesh), morphs });
    meshTriangles.push(tris);
    meshVertices.push(verts);
    meshPrimitiveMaterials.push(mats);
  }

  // nodes: instancing, lights, cameras, skins
  const instances: number[] = meshes.map(() => 0);
  const lightNodes: string[] = [];
  const cameraNodes: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const path = `scene.nodes[${i}]`;
    if (!isObj(node)) {
      err(path, 'must be an object');
      continue;
    }
    if (node.mesh !== undefined) {
      if (isInt(node.mesh) && node.mesh >= 0 && node.mesh < meshes.length) instances[node.mesh]++;
      else err(`${path}.mesh`, 'no such mesh');
    }
    if (node.camera !== undefined) {
      if (isInt(node.camera) && node.camera >= 0 && node.camera < cameras.length) cameraNodes.push(nameOf(node));
      else err(`${path}.camera`, 'no such camera');
    }
    if (node.skin !== undefined && !(isInt(node.skin) && node.skin >= 0 && node.skin < skins.length)) err(`${path}.skin`, 'no such skin');
    const ext = isObj(node.extensions) && isObj(node.extensions.KHR_lights_punctual) ? node.extensions.KHR_lights_punctual : null;
    if (ext) {
      if (isInt(ext.light) && ext.light >= 0 && ext.light < lights.length) lightNodes.push(nameOf(node));
      else err(`${path}.extensions.KHR_lights_punctual.light`, 'no such light');
    }
  }

  let triangles = 0;
  let vertices = 0;
  let drawCalls = 0;
  const materialDrawCalls: number[] = materials.map(() => 0);
  for (let m = 0; m < meshes.length; m++) {
    const k = instances[m];
    triangles += meshTriangles[m] * k;
    vertices += meshVertices[m] * k;
    const mats = meshPrimitiveMaterials[m];
    drawCalls += mats.length * k;
    for (let p = 0; p < mats.length; p++) if (mats[p] >= 0) materialDrawCalls[mats[p]] += k;
  }
  if (triangles > limits.maxTriangles) err('scene', `${triangles} triangles; the limit is ${limits.maxTriangles}`);
  if (vertices > limits.maxVertices) err('scene', `${vertices} vertices; the limit is ${limits.maxVertices}`);
  if (drawCalls > limits.maxDrawCalls) err('scene', `${drawCalls} draw calls; the limit is ${limits.maxDrawCalls}`);

  // animations: input max (required by glTF) gives the duration; keyframes = Σ input counts
  if (animations.length > limits.maxAnimations) err('scene.animations', `${animations.length} animations; the limit is ${limits.maxAnimations}`);
  const clips: ClipStat[] = [];
  let keyframes = 0;
  for (let i = 0; i < animations.length; i++) {
    const anim = animations[i];
    const path = `scene.animations[${i}]`;
    const samplers = isObj(anim) && Array.isArray(anim.samplers) ? capped(`${path}.samplers`, 'samplers', anim.samplers, null) : [];
    let duration = 0;
    let keys = 0;
    for (let j = 0; j < samplers.length; j++) {
      const s = samplers[j];
      const sp = `${path}.samplers[${j}].input`;
      const input = isObj(s) ? s.input : undefined;
      const count = accessorCount(input);
      if (count < 0) {
        err(sp, 'no such accessor');
        continue;
      }
      keys += count;
      const acc = accessors[input as number] as Json;
      const max = acc.max;
      if (!Array.isArray(max) || typeof max[0] !== 'number' || !isFinite(max[0])) {
        err(sp, `accessor ${String(input)} has no max (glTF requires min/max on animation inputs)`);
      } else {
        duration = Math.max(duration, max[0]);
      }
    }
    if (duration > limits.maxAnimationSeconds) err(path, `${duration} s long; the limit is ${limits.maxAnimationSeconds} s`);
    clips.push({ name: nameOf(anim), duration, keyframes: keys });
    keyframes += keys;
  }
  if (keyframes > limits.maxKeyframes) err('scene.animations', `${keyframes} keyframes; the limit is ${limits.maxKeyframes}`);

  const summary: SceneSummary = {
    nodes: nodes.map(nameOf),
    meshes: meshSummaries,
    materials: materials.map(nameOf),
    animations: clips.map((c) => ({ name: c.name, duration: c.duration })),
    lights: lightNodes,
    cameras: cameraNodes,
  };
  const stats: SceneStats = {
    bytes: n,
    nodes: nodes.length,
    meshes: meshes.length,
    materials: materials.length,
    skins: skins.length,
    lights: lights.length,
    cameras: cameras.length,
    morphTargets,
    triangles,
    vertices,
    drawCalls,
    materialDrawCalls,
    images: imageStats,
    texturePixels,
    clips,
    keyframes,
  };
  if (dropped > 0) errors.push(`scene: …and ${dropped} more problem${dropped === 1 ? '' : 's'}`);
  return { errors, summary, stats };
}
