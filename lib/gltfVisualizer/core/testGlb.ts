// A tiny GLB builder for tests (both repos use it): scenes described as plain data, real PNGs
// (stored deflate, CRC and Adler computed here), header-only JPEGs, and switches that inject the
// faults the inspector must catch. No Node or DOM APIs, so it also runs under Jest/Hermes.

import { encodeUtf8 } from './glb';

export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export interface TestPrimitive {
  /** xyz triplets. */
  positions: number[];
  normals?: number[];
  indices?: number[];
  /** glTF primitive mode (default 4, triangles). */
  mode?: number;
  material?: number;
  /** Morph targets: position deltas, each the length of `positions`. */
  targets?: number[][];
  /** Adds JOINTS_0 (every vertex on joint 0) and WEIGHTS_0 (1, 0, 0, 0) for skinned meshes. */
  skinned?: boolean;
}

export interface TestMesh {
  name?: string;
  primitives: TestPrimitive[];
  /** Written to extras.targetNames. */
  targetNames?: string[];
  weights?: number[];
}

export interface TestNode {
  name?: string;
  mesh?: number;
  children?: number[];
  translation?: Vec3;
  rotation?: Vec4;
  scale?: Vec3;
  skin?: number;
  camera?: number;
  /** Index into `lights` (KHR_lights_punctual). */
  light?: number;
}

export interface TestMaterial {
  name?: string;
  color?: Vec4;
  emissive?: Vec3;
  metallic?: number;
  roughness?: number;
}

export interface TestChannel {
  node: number;
  path: 'translation' | 'rotation' | 'scale' | 'weights';
  /** Keyframe times in seconds; the last one sets the clip duration. */
  times: number[];
  values: number[];
}

export interface TestAnimation {
  name?: string;
  channels: TestChannel[];
}

export interface TestSkin {
  joints: number[];
  skeleton?: number;
}

export interface TestLight {
  name?: string;
  type: 'point' | 'directional' | 'spot';
  intensity?: number;
  color?: Vec3;
}

export interface TestCamera {
  name?: string;
  yfov?: number;
  znear?: number;
  zfar?: number;
}

export interface TestImage {
  mime: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
  /** PNG without pixel data (IHDR + IEND), for huge fake sizes; JPEGs are always header-only. */
  headerOnly?: boolean;
  /** Leave off the trailer (PNG IEND chunk, JPEG EOI), as a truncated file would. */
  truncated?: boolean;
  /** Declared mimeType when it should differ from the bytes. */
  declaredMime?: string;
}

export interface TestGlbFaults {
  badMagic?: boolean;
  badVersion?: boolean;
  /** Header length one word longer than the file. */
  wrongLength?: boolean;
  /** buffers[0].uri = "scene.bin". */
  externalBufferUri?: boolean;
  /** images[0] by uri instead of bufferView. */
  imageUri?: boolean;
  /** Raises this accessor's count past its bufferView. */
  accessorOutOfBounds?: number;
  /** Drops min/max from animation input accessors. */
  noAnimationMax?: boolean;
  /** A third chunk after BIN. */
  extraChunk?: boolean;
}

export interface TestGlbSpec {
  nodes: TestNode[];
  meshes?: TestMesh[];
  materials?: TestMaterial[];
  animations?: TestAnimation[];
  skins?: TestSkin[];
  lights?: TestLight[];
  cameras?: TestCamera[];
  /** Embedded images (not referenced by any texture, so loaders skip decoding them). */
  images?: TestImage[];
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  faults?: TestGlbFaults;
  /** Last-moment edit of the glTF JSON. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editJson?: (json: any) => void;
}

// ---------------------------------------------------------------------------------------------
// Checksums and images

let crcTable: Uint32Array | null = null;

export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

const u32be = (v: number): number[] => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];

function pngChunk(type: string, data: number[] | Uint8Array): number[] {
  const body = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i);
  body.set(data, 4);
  return [...u32be(data.length), ...Array.from(body), ...u32be(crc32(body))];
}

/** A valid RGBA PNG (stored deflate blocks) ending in IEND; header-only when `headerOnly`, no IEND when `noIend`. */
export function makePng(width: number, height: number, opts: { headerOnly?: boolean; rgba?: Vec4; noIend?: boolean } = {}): Uint8Array {
  const out: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  out.push(...pngChunk('IHDR', [...u32be(width), ...u32be(height), 8, 6, 0, 0, 0]));
  if (!opts.headerOnly) {
    const rgba = opts.rgba || [255, 0, 128, 255];
    const raw = new Uint8Array(height * (1 + width * 4));
    for (let y = 0, o = 0; y < height; y++) {
      raw[o++] = 0; // filter: none
      for (let x = 0; x < width; x++) for (let c = 0; c < 4; c++) raw[o++] = rgba[c];
    }
    const z: number[] = [0x78, 0x01];
    for (let pos = 0; pos < raw.length || pos === 0; ) {
      const len = Math.min(65535, raw.length - pos);
      const last = pos + len >= raw.length ? 1 : 0;
      z.push(last, len & 0xff, len >>> 8, ~len & 0xff, (~len >>> 8) & 0xff);
      for (let i = 0; i < len; i++) z.push(raw[pos + i]);
      pos += len;
      if (last) break;
    }
    z.push(...u32be(adler32(raw)));
    out.push(...pngChunk('IDAT', z));
  }
  if (!opts.noIend) out.push(...pngChunk('IEND', []));
  return new Uint8Array(out);
}

/** SOI, APP0, a valid SOF0, then EOI unless `noEoi` (header parsing only; no scan data, not decodable). */
export function makeJpegHeader(width: number, height: number, opts: { noEoi?: boolean } = {}): Uint8Array {
  const bytes = new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ]);
  return opts.noEoi ? bytes.subarray(0, bytes.length - 2) : bytes;
}

// ---------------------------------------------------------------------------------------------
// Geometry helpers

/** One triangle in the XY plane. */
export function trianglePrimitive(material?: number): TestPrimitive {
  return { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], material };
}

/** An indexed cube (8 vertices, 12 triangles) centred on the origin. */
export function cubePrimitive(size = 1, material?: number): TestPrimitive {
  const h = size / 2;
  const positions: number[] = [];
  const normals: number[] = [];
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? h : -h;
    const y = i & 2 ? h : -h;
    const z = i & 4 ? h : -h;
    positions.push(x, y, z);
    const l = Math.sqrt(3) * h;
    normals.push(x / l, y / l, z / l);
  }
  const indices = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5];
  return { positions, normals, indices, material };
}

// ---------------------------------------------------------------------------------------------
// Builder

const FLOAT = 5126;
const UBYTE = 5121;
const USHORT = 5123;
const UINT = 5125;

function floatBytes(values: number[]): Uint8Array {
  const f = new Float32Array(values);
  return new Uint8Array(f.buffer, f.byteOffset, f.byteLength);
}

function minMax(values: number[], size: number): { min: number[]; max: number[] } {
  const min: number[] = [];
  const max: number[] = [];
  for (let c = 0; c < size; c++) {
    min.push(Infinity);
    max.push(-Infinity);
  }
  for (let i = 0; i < values.length; i++) {
    const c = i % size;
    if (values[i] < min[c]) min[c] = values[i];
    if (values[i] > max[c]) max[c] = values[i];
  }
  return { min, max };
}

const TYPE_SIZE: { [type: string]: number } = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** Builds a GLB from `spec`. */
export function buildGlb(spec: TestGlbSpec): Uint8Array {
  const faults = spec.faults || {};
  const parts: Uint8Array[] = [];
  let binLength = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const views: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accessors: any[] = [];

  const addView = (data: Uint8Array): number => {
    const pad = (4 - (binLength % 4)) % 4;
    if (pad) {
      parts.push(new Uint8Array(pad));
      binLength += pad;
    }
    views.push({ buffer: 0, byteOffset: binLength, byteLength: data.length });
    parts.push(data);
    binLength += data.length;
    return views.length - 1;
  };
  const addFloats = (values: number[], type: string, withBounds: boolean): number => {
    const size = TYPE_SIZE[type];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acc: any = { bufferView: addView(floatBytes(values)), componentType: FLOAT, count: values.length / size, type };
    if (withBounds) {
      const b = minMax(values, size);
      acc.min = b.min;
      acc.max = b.max;
    }
    accessors.push(acc);
    return accessors.length - 1;
  };
  const addIndices = (values: number[]): number => {
    const max = Math.max(...values);
    let data: Uint8Array;
    let type: number;
    if (max < 256) {
      data = Uint8Array.from(values);
      type = UBYTE;
    } else if (max < 65536) {
      const a = Uint16Array.from(values);
      data = new Uint8Array(a.buffer);
      type = USHORT;
    } else {
      const a = Uint32Array.from(values);
      data = new Uint8Array(a.buffer);
      type = UINT;
    }
    accessors.push({ bufferView: addView(data), componentType: type, count: values.length, type: 'SCALAR' });
    return accessors.length - 1;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = { asset: { version: '2.0', generator: 'gltf-visualizer testGlb' } };
  const used: string[] = (spec.extensionsUsed || []).slice();

  json.meshes = (spec.meshes || []).map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mesh: any = {
      primitives: m.primitives.map((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prim: any = { attributes: { POSITION: addFloats(p.positions, 'VEC3', true) } };
        if (p.normals) prim.attributes.NORMAL = addFloats(p.normals, 'VEC3', false);
        if (p.skinned) {
          const count = p.positions.length / 3;
          accessors.push({ bufferView: addView(new Uint8Array(count * 4)), componentType: UBYTE, count, type: 'VEC4' });
          prim.attributes.JOINTS_0 = accessors.length - 1;
          const w: number[] = [];
          for (let i = 0; i < count; i++) w.push(1, 0, 0, 0);
          prim.attributes.WEIGHTS_0 = addFloats(w, 'VEC4', false);
        }
        if (p.indices) prim.indices = addIndices(p.indices);
        if (p.mode !== undefined) prim.mode = p.mode;
        if (p.material !== undefined) prim.material = p.material;
        if (p.targets) prim.targets = p.targets.map((t) => ({ POSITION: addFloats(t, 'VEC3', true) }));
        return prim;
      }),
    };
    if (m.name !== undefined) mesh.name = m.name;
    if (m.targetNames) mesh.extras = { targetNames: m.targetNames };
    if (m.weights) mesh.weights = m.weights;
    return mesh;
  });

  json.materials = (spec.materials || []).map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mat: any = {
      pbrMetallicRoughness: {
        baseColorFactor: m.color || [1, 1, 1, 1],
        metallicFactor: m.metallic !== undefined ? m.metallic : 0,
        roughnessFactor: m.roughness !== undefined ? m.roughness : 1,
      },
    };
    if (m.name !== undefined) mat.name = m.name;
    if (m.emissive) mat.emissiveFactor = m.emissive;
    return mat;
  });

  if (spec.lights && spec.lights.length > 0 && used.indexOf('KHR_lights_punctual') < 0) used.push('KHR_lights_punctual');
  json.nodes = spec.nodes.map((n) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node: any = {};
    if (n.name !== undefined) node.name = n.name;
    if (n.mesh !== undefined) node.mesh = n.mesh;
    if (n.children) node.children = n.children;
    if (n.translation) node.translation = n.translation;
    if (n.rotation) node.rotation = n.rotation;
    if (n.scale) node.scale = n.scale;
    if (n.skin !== undefined) node.skin = n.skin;
    if (n.camera !== undefined) node.camera = n.camera;
    if (n.light !== undefined) node.extensions = { KHR_lights_punctual: { light: n.light } };
    return node;
  });
  const children = new Set<number>();
  spec.nodes.forEach((n) => (n.children || []).forEach((c) => children.add(c)));
  json.scenes = [{ nodes: spec.nodes.map((_n, i) => i).filter((i) => !children.has(i)) }];
  json.scene = 0;

  if (spec.skins) {
    json.skins = spec.skins.map((s) => {
      const ibm: number[] = [];
      for (let j = 0; j < s.joints.length; j++) ibm.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skin: any = { joints: s.joints, inverseBindMatrices: addFloats(ibm, 'MAT4', false) };
      if (s.skeleton !== undefined) skin.skeleton = s.skeleton;
      return skin;
    });
  }
  if (spec.cameras) {
    json.cameras = spec.cameras.map((c) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cam: any = { type: 'perspective', perspective: { yfov: c.yfov !== undefined ? c.yfov : 0.8, znear: c.znear !== undefined ? c.znear : 0.05 } };
      if (c.zfar !== undefined) cam.perspective.zfar = c.zfar;
      if (c.name !== undefined) cam.name = c.name;
      return cam;
    });
  }
  if (spec.lights && spec.lights.length > 0) {
    json.extensions = {
      KHR_lights_punctual: {
        lights: spec.lights.map((l) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const light: any = { type: l.type, intensity: l.intensity !== undefined ? l.intensity : 1 };
          if (l.color) light.color = l.color;
          if (l.name !== undefined) light.name = l.name;
          if (l.type === 'spot') light.spot = {};
          return light;
        }),
      },
    };
  }

  json.animations = (spec.animations || []).map((a) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const samplers: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channels: any[] = [];
    a.channels.forEach((ch) => {
      const input = addFloats(ch.times, 'SCALAR', !faults.noAnimationMax);
      const type = ch.path === 'rotation' ? 'VEC4' : ch.path === 'weights' ? 'SCALAR' : 'VEC3';
      const output = addFloats(ch.values, type, false);
      samplers.push({ input, output, interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: ch.node, path: ch.path } });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anim: any = { samplers, channels };
    if (a.name !== undefined) anim.name = a.name;
    return anim;
  });

  if (spec.images) {
    json.images = spec.images.map((img, i) => {
      const bytes =
        img.mime === 'image/png'
          ? makePng(img.width, img.height, { headerOnly: img.headerOnly, noIend: img.truncated })
          : makeJpegHeader(img.width, img.height, { noEoi: img.truncated });
      const mimeType = img.declaredMime || img.mime;
      if (faults.imageUri && i === 0) return { uri: 'texture.png', mimeType };
      return { bufferView: addView(bytes), mimeType };
    });
  }

  if (faults.accessorOutOfBounds !== undefined) accessors[faults.accessorOutOfBounds].count += 1000;

  json.accessors = accessors;
  json.bufferViews = views;
  if (binLength > 0) {
    json.buffers = [{ byteLength: binLength }];
    if (faults.externalBufferUri) json.buffers[0].uri = 'scene.bin';
  }
  if (used.length > 0) json.extensionsUsed = used;
  if (spec.extensionsRequired) json.extensionsRequired = spec.extensionsRequired;
  for (const key of ['meshes', 'materials', 'animations', 'accessors', 'bufferViews']) {
    if (Array.isArray(json[key]) && json[key].length === 0) delete json[key];
  }
  if (spec.editJson) spec.editJson(json);

  // Assemble: header, JSON chunk (space-padded), BIN chunk (zero-padded).
  const text = encodeUtf8(JSON.stringify(json));
  const jsonLength = Math.ceil(text.length / 4) * 4;
  const binPadded = Math.ceil(binLength / 4) * 4;
  const extra = faults.extraChunk ? 8 + 4 : 0;
  const total = 12 + 8 + jsonLength + (binLength > 0 ? 8 + binPadded : 0) + extra;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, faults.badMagic ? 0x46546c68 : 0x46546c67, true);
  dv.setUint32(4, faults.badVersion ? 1 : 2, true);
  dv.setUint32(8, faults.wrongLength ? total + 4 : total, true);
  dv.setUint32(12, jsonLength, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(text, 20);
  for (let i = 20 + text.length; i < 20 + jsonLength; i++) out[i] = 0x20;
  let o = 20 + jsonLength;
  if (binLength > 0) {
    dv.setUint32(o, binPadded, true);
    dv.setUint32(o + 4, 0x004e4942, true);
    o += 8;
    for (let i = 0; i < parts.length; i++) {
      out.set(parts[i], o);
      o += parts[i].length;
    }
    o = 20 + jsonLength + 8 + binPadded;
  }
  if (faults.extraChunk) {
    dv.setUint32(o, 4, true);
    dv.setUint32(o + 4, 0x12345678, true);
  }
  return out;
}

/** The ArrayBuffer GLTFLoader.parse wants, holding exactly `bytes`. */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}
