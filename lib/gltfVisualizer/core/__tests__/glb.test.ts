import { describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { TextDecoder, TextEncoder } from 'util';
import { DEFAULT_LIMITS, GltfLimits } from '../limits';
import { MAX_ERRORS, MAX_JPEG_MARKERS, decodeUtf8, decodeUtf8Lossy, encodeUtf8, hasImageTrailer, imageSize, inspectGlb, jsonTooDeep, sniffImageMime } from '../glb';
import { validateManifest } from '../manifest';
import { TestGlbSpec, buildGlb, cubePrimitive, makeJpegHeader, makePng, trianglePrimitive } from '../testGlb';
import { errorPathOf, manifestCases, pathMatches } from './helpers';
import { fixtureSceneSpec } from './scenes';

const limits = (over: Partial<{ -readonly [K in keyof GltfLimits]: GltfLimits[K] }>): GltfLimits => ({ ...DEFAULT_LIMITS, ...over });
const paths = (errors: string[]) => errors.map(errorPathOf);

function expectError(bytes: Uint8Array, path: string, lim: GltfLimits = DEFAULT_LIMITS, message?: RegExp): string[] {
  const { errors } = inspectGlb(bytes, lim);
  const hit = errors.find((e) => pathMatches(e, path));
  assert.ok(hit, `no error at ${path}; got:\n  ${errors.join('\n  ')}`);
  if (message) assert.match(hit, message);
  return errors;
}

const simple = (extra: Partial<TestGlbSpec> = {}): TestGlbSpec => ({
  nodes: [{ name: 'A', mesh: 0 }],
  meshes: [{ name: 'M', primitives: [cubePrimitive(1, 0)] }],
  materials: [{ name: 'Mat' }],
  ...extra,
});

describe('a full valid scene', () => {
  const cases = manifestCases();
  const { errors, summary, stats } = inspectGlb(buildGlb(fixtureSceneSpec()));

  test('no errors; the summary equals what was built (the fixtures summary)', () => {
    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(summary, cases.summary);
  });

  test('stats', () => {
    assert.ok(stats);
    assert.deepStrictEqual(
      [stats.nodes, stats.meshes, stats.materials, stats.skins, stats.lights, stats.cameras, stats.morphTargets],
      [9, 2, 5, 1, 1, 1, 2],
    );
    // Body: cube 12 + triangle 1, once; SpeakerMesh: cube 12, instanced by Speaker and Cone.
    assert.deepStrictEqual([stats.triangles, stats.vertices, stats.drawCalls], [37, 27, 4]);
    assert.deepStrictEqual(stats.materialDrawCalls, [1, 1, 2, 0, 0]);
    assert.deepStrictEqual(stats.clips.map((c) => [c.name, c.duration, c.keyframes]), [
      ['Idle', 2, 3], ['Dance1', 1.92, 3], ['Dance2', 3.84, 3], ['Wave', 1.5, 2], ['Pump', 0.5, 3], ['Fan', 4, 3],
    ]);
    assert.equal(stats.keyframes, 17);
  });

  test('the fixture manifests validate against the inspected scene', () => {
    for (const c of cases.valid) assert.deepStrictEqual(validateManifest(c.manifest, summary, { stats }), [], c.name);
  });
});

describe('structural faults', () => {
  test('header', () => {
    expectError(buildGlb(simple({ faults: { badMagic: true } })), 'scene', DEFAULT_LIMITS, /not a GLB/);
    expectError(buildGlb(simple({ faults: { badVersion: true } })), 'scene', DEFAULT_LIMITS, /version 1/);
    expectError(buildGlb(simple({ faults: { wrongLength: true } })), 'scene', DEFAULT_LIMITS, /header says/);
    expectError(new Uint8Array(8), 'scene', DEFAULT_LIMITS, /too short/);
    const r = inspectGlb(buildGlb(simple({ faults: { badMagic: true } })));
    assert.equal(r.summary, null);
    assert.equal(r.stats, null);
  });

  test('chunks and JSON', () => {
    expectError(buildGlb(simple({ faults: { extraChunk: true } })), 'scene', DEFAULT_LIMITS, /after the BIN chunk|only one BIN/);
    const bytes = buildGlb(simple());
    const misaligned = bytes.slice();
    new DataView(misaligned.buffer).setUint32(12, new DataView(bytes.buffer).getUint32(12, true) - 1, true);
    expectError(misaligned, 'scene', DEFAULT_LIMITS, /multiple of 4/);
    // A JSON chunk that is valid UTF-8 but not an object.
    const arr = encodeUtf8('[1, 2]  ');
    const glb = new Uint8Array(20 + arr.length);
    const dv = new DataView(glb.buffer);
    dv.setUint32(0, 0x46546c67, true);
    dv.setUint32(4, 2, true);
    dv.setUint32(8, glb.length, true);
    dv.setUint32(12, arr.length, true);
    dv.setUint32(16, 0x4e4f534a, true);
    glb.set(arr, 20);
    expectError(glb, 'scene', DEFAULT_LIMITS, /not an object/);
    glb[20] = 0xc0; // overlong lead byte
    expectError(glb, 'scene', DEFAULT_LIMITS, /UTF-8/);
  });

  test('asset version, extensions', () => {
    expectError(buildGlb(simple({ editJson: (j) => (j.asset.version = '1.0') })), 'scene.asset.version');
    const draco = expectError(buildGlb(simple({ extensionsUsed: ['KHR_draco_mesh_compression'] })), 'scene.extensionsUsed', DEFAULT_LIMITS, /Draco needs a WebAssembly decoder/);
    assert.equal(draco.length, 1);
    expectError(buildGlb(simple({ extensionsUsed: ['EXT_texture_webp'] })), 'scene.extensionsUsed', DEFAULT_LIMITS, /WebP/);
    expectError(buildGlb(simple({ extensionsUsed: ['EXT_foo'] })), 'scene.extensionsUsed', DEFAULT_LIMITS, /EXT_foo: not supported/);
    expectError(buildGlb(simple({ extensionsUsed: ['KHR_texture_transform'], extensionsRequired: ['KHR_materials_unlit'] })), 'scene.extensionsRequired');
    assert.deepStrictEqual(inspectGlb(buildGlb(simple({ extensionsUsed: ['KHR_texture_transform', 'KHR_mesh_quantization'] }))).errors, []);
  });

  test('buffers, bufferViews, accessors', () => {
    expectError(buildGlb(simple({ faults: { externalBufferUri: true } })), 'scene.buffers[0].uri');
    expectError(buildGlb(simple({ editJson: (j) => j.buffers.push({ byteLength: 4 }) })), 'scene.buffers');
    expectError(buildGlb(simple({ editJson: (j) => (j.buffers[0].byteLength += 64) })), 'scene.buffers[0].byteLength');
    expectError(buildGlb(simple({ editJson: (j) => (j.bufferViews[0].byteLength += 4096) })), 'scene.bufferViews[0]');
    expectError(buildGlb(simple({ faults: { accessorOutOfBounds: 0 } })), 'scene.accessors[0]', DEFAULT_LIMITS, /bufferView 0/);
    expectError(buildGlb(simple({ editJson: (j) => (j.accessors[0].componentType = 5124) })), 'scene.accessors[0].componentType');
    expectError(buildGlb(simple({ editJson: (j) => (j.accessors[0].type = 'VEC5') })), 'scene.accessors[0].type');
    expectError(buildGlb(simple({ editJson: (j) => (j.meshes[0].primitives[0].attributes.POSITION = 99) })), 'scene.meshes[0].primitives[0].attributes.POSITION');
  });

  test('sparse accessors are bounds-checked', () => {
    const sparse = (indicesOffset: number) =>
      buildGlb(
        simple({
          editJson: (j) => {
            // Reuse the index bufferView (36 bytes) for both sparse arrays.
            const idxView = j.accessors[j.meshes[0].primitives[0].indices].bufferView;
            j.accessors[0].sparse = { count: 4, indices: { bufferView: idxView, byteOffset: indicesOffset, componentType: 5121 }, values: { bufferView: 0, byteOffset: 0 } };
          },
        }),
      );
    assert.deepStrictEqual(inspectGlb(sparse(0)).errors, []);
    expectError(sparse(34), 'scene.accessors[0].sparse.indices');
  });

  test('images: embedded, PNG/JPEG, magic, header size limits', () => {
    expectError(buildGlb(simple({ images: [{ mime: 'image/png', width: 2, height: 2 }], faults: { imageUri: true } })), 'scene.images[0].uri');
    expectError(buildGlb(simple({ images: [{ mime: 'image/png', width: 2, height: 2, declaredMime: 'image/webp' }] })), 'scene.images[0].mimeType');
    expectError(buildGlb(simple({ images: [{ mime: 'image/png', width: 2, height: 2, declaredMime: 'image/jpeg' }] })), 'scene.images[0]', DEFAULT_LIMITS, /not a JPEG/);
    expectError(buildGlb(simple({ images: [{ mime: 'image/png', width: 4096, height: 16, headerOnly: true }] })), 'scene.images[0]', DEFAULT_LIMITS, /4096×16 exceeds 2048×2048/);
    expectError(
      buildGlb(simple({ images: [{ mime: 'image/png', width: 2048, height: 2048, headerOnly: true }, { mime: 'image/jpeg', width: 2048, height: 2048 }] })),
      'scene.images',
      limits({ maxTexturePixels: 2048 * 2048 }),
      /pixels in total/,
    );
    expectError(buildGlb(simple({ editJson: (j) => (j.images = [{ mimeType: 'image/png' }]) })), 'scene.images[0]', DEFAULT_LIMITS, /bufferView/);
  });

  test('image stats from PNG IHDR and JPEG SOF', () => {
    const { errors, stats } = inspectGlb(buildGlb(simple({ images: [{ mime: 'image/png', width: 3, height: 5 }, { mime: 'image/jpeg', width: 640, height: 480 }] })));
    assert.deepStrictEqual(errors, []);
    assert.ok(stats);
    assert.deepStrictEqual(stats.images.map((i) => [i.index, i.mime, i.width, i.height]), [[0, 'image/png', 3, 5], [1, 'image/jpeg', 640, 480]]);
    assert.equal(stats.images[0].bytes, makePng(3, 5).length);
    assert.equal(stats.texturePixels, 15 + 640 * 480);
  });

  test('animations: input max required, duration limit', () => {
    const anim = (seconds: number, faults = {}) =>
      buildGlb(simple({ animations: [{ name: 'Spin', channels: [{ node: 0, path: 'translation', times: [0, seconds], values: [0, 0, 0, 1, 0, 0] }] }], faults }));
    expectError(anim(1, { noAnimationMax: true }), 'scene.animations[0].samplers[0].input', DEFAULT_LIMITS, /no max/);
    expectError(anim(121), 'scene.animations[0]', DEFAULT_LIMITS, /121 s long/);
    assert.deepStrictEqual(inspectGlb(anim(120)).errors, []);
  });
});

describe('counts against limits', () => {
  const scene = buildGlb(fixtureSceneSpec());
  const cases: [Partial<{ -readonly [K in keyof GltfLimits]: GltfLimits[K] }>, string][] = [
    [{ maxNodes: 8 }, 'scene.nodes'],
    [{ maxMeshes: 1 }, 'scene.meshes'],
    [{ maxMaterials: 4 }, 'scene.materials'],
    [{ maxTriangles: 36 }, 'scene'],
    [{ maxVertices: 26 }, 'scene'],
    [{ maxDrawCalls: 3 }, 'scene'],
    [{ maxAnimations: 5 }, 'scene.animations'],
    [{ maxKeyframes: 16 }, 'scene.animations'],
    [{ maxAnimationSeconds: 3 }, 'scene.animations[5]'],
    [{ maxMorphTargets: 1 }, 'scene.meshes[0]'],
    [{ maxSkins: 0 }, 'scene.skins'],
    [{ maxJoints: 0 }, 'scene.skins[0].joints'],
    [{ maxLights: 0 }, 'scene.extensions.KHR_lights_punctual.lights'],
    [{ maxCameras: 0 }, 'scene.cameras'],
    [{ glbMaxBytes: 100 }, 'scene'],
    [{ jsonChunkMaxBytes: 100 }, 'scene'],
  ];
  for (const [over, path] of cases) {
    test(`${Object.keys(over)[0]} → ${path}`, () => {
      expectError(scene, path, limits(over));
    });
  }
  test('exactly at the limits is fine', () => {
    const at = limits({ maxNodes: 9, maxMeshes: 2, maxMaterials: 5, maxTriangles: 37, maxVertices: 27, maxDrawCalls: 4, maxAnimations: 6, maxKeyframes: 17, maxMorphTargets: 2, maxSkins: 1, maxJoints: 1, maxLights: 1, maxCameras: 1 });
    assert.deepStrictEqual(inspectGlb(scene, at).errors, []);
  });
});

describe('triangles, vertices, draw calls', () => {
  test('modes, indices vs positions, instancing', () => {
    const strip = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 2, 0, 0], indices: [0, 1, 2, 3, 4], mode: 5, material: 0 };
    const fan = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], mode: 6 };
    const lines = { positions: [0, 0, 0, 1, 0, 0], mode: 1, material: 1 };
    const { errors, stats } = inspectGlb(
      buildGlb({
        nodes: [{ name: 'a', mesh: 0 }, { name: 'b', mesh: 0 }, { name: 'c', mesh: 0 }, { name: 'd', mesh: 1 }],
        meshes: [{ name: 'Cube', primitives: [cubePrimitive(1, 0)] }, { name: 'Mixed', primitives: [strip, fan, lines, trianglePrimitive(0)] }],
        materials: [{ name: 'A' }, { name: 'B' }],
      }),
    );
    assert.deepStrictEqual(errors, []);
    assert.ok(stats);
    // Cube ×3: 36 tris, 24 verts, 3 draws. Mixed ×1: strip 3 + fan 2 + lines 0 + triangle 1; 5+4+2+3 verts; 4 draws.
    assert.deepStrictEqual([stats.triangles, stats.vertices, stats.drawCalls], [42, 38, 7]);
    assert.deepStrictEqual(stats.materialDrawCalls, [5, 1]);
  });

  test('a mesh no node uses costs nothing', () => {
    const { stats } = inspectGlb(buildGlb({ nodes: [{ name: 'empty' }], meshes: [{ primitives: [cubePrimitive()] }] }));
    assert.ok(stats);
    assert.deepStrictEqual([stats.triangles, stats.drawCalls], [0, 0]);
  });
});

describe('image headers', () => {
  test('PNG and JPEG sizes, sniffing, bad input', () => {
    assert.deepStrictEqual(imageSize(makePng(7, 9), 'image/png'), { width: 7, height: 9 });
    assert.deepStrictEqual(imageSize(makePng(3000, 20, { headerOnly: true }), 'image/png'), { width: 3000, height: 20 });
    assert.deepStrictEqual(imageSize(makeJpegHeader(1920, 1080), 'image/jpeg'), { width: 1920, height: 1080 });
    assert.equal(imageSize(makePng(2, 2), 'image/jpeg'), null);
    assert.equal(sniffImageMime(makeJpegHeader(1, 1)), 'image/jpeg');
    assert.equal(sniffImageMime(new Uint8Array([1, 2, 3])), null);
    // Progressive (SOF2) after a DQT-like segment, with fill bytes before the marker.
    const prog = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xff, 0xc2, 0x00, 0x11, 0x08, 0x00, 0x20, 0x00, 0x40, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
    assert.deepStrictEqual(imageSize(prog, 'image/jpeg'), { width: 64, height: 32 });
    // SOS before any SOF, or a DHT (C4) only: no size.
    assert.equal(imageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02]), 'image/jpeg'), null);
    assert.equal(imageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xc4, 0x00, 0x02, 0xff, 0xd9]), 'image/jpeg'), null);
  });

  test('generated PNG is well formed (CRC of IHDR)', () => {
    const png = makePng(2, 2);
    // IHDR chunk: length 13 at 8, type at 12, data 16..29, CRC 29..33.
    assert.equal(new DataView(png.buffer).getUint32(8), 13);
    assert.equal(String.fromCharCode(png[12], png[13], png[14], png[15]), 'IHDR');
    const zlib = require('zlib') as typeof import('zlib');
    // The IDAT stream inflates to 2 rows of (filter byte + 2 RGBA pixels).
    const idatLength = new DataView(png.buffer).getUint32(33);
    const idat = png.subarray(41, 41 + idatLength);
    assert.equal(zlib.inflateSync(idat).length, 2 * (1 + 2 * 4));
  });
});

describe('UTF-8 without TextDecoder', () => {
  test('round trips and matches TextDecoder', () => {
    const s = 'Tänzer € 😀 名前 ' + 'x'.repeat(20000);
    const bytes = encodeUtf8(s);
    assert.equal(decodeUtf8(bytes), s);
    assert.deepStrictEqual(Array.from(bytes.subarray(0, 20)), Array.from(new TextEncoder().encode(s).subarray(0, 20)));
    assert.equal(decodeUtf8(bytes, 0, 1), 'T');
  });

  test('rejects invalid sequences; lossy replaces them', () => {
    for (const bad of [[0xc0, 0x80], [0xed, 0xa0, 0x80], [0xe2, 0x82], [0xf4, 0x90, 0x80, 0x80], [0x80], [0xff]]) {
      assert.equal(decodeUtf8(new Uint8Array(bad)), null, JSON.stringify(bad));
    }
    assert.equal(decodeUtf8Lossy(new Uint8Array([0x61, 0xff, 0x62])), 'a�b');
    assert.equal(decodeUtf8Lossy(new Uint8Array([0x61, 0xff, 0x62])), new TextDecoder().decode(new Uint8Array([0x61, 0xff, 0x62])));
  });
});

test('paths helper sanity', () => {
  assert.deepStrictEqual(paths(['scene.images[3]: x', 'scene: y']), ['scene.images[3]', 'scene']);
});

// ---------------------------------------------------------------------------------------------
// Work bounds against crafted files

/** A GLB from raw JSON and BIN bytes (no builder conveniences). */
function rawGlb(json: object, bin: Uint8Array): Uint8Array {
  const text = encodeUtf8(JSON.stringify(json));
  const jsonLen = (text.length + 3) & ~3;
  const binLen = (bin.length + 3) & ~3;
  const total = 12 + 8 + jsonLen + (bin.length > 0 ? 8 + binLen : 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(text, 20);
  out.fill(0x20, 20 + text.length, 20 + jsonLen);
  if (bin.length > 0) {
    dv.setUint32(20 + jsonLen, binLen, true);
    dv.setUint32(24 + jsonLen, 0x004e4942, true);
    out.set(bin, 28 + jsonLen);
  }
  return out;
}

/** A GLB whose only bufferView holds `data`, referenced by `count` images of `mime`. */
function imagesOnOneView(data: Uint8Array, count: number, mime = 'image/jpeg'): Uint8Array {
  const images: object[] = [];
  for (let i = 0; i < count; i++) images.push({ bufferView: 0, mimeType: mime });
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: data.length }],
    bufferViews: [{ buffer: 0, byteLength: data.length }],
    images,
  };
  return rawGlb(json, data);
}

/** SOI, `chain` empty APP0 segments, an SOF0 of w×h, EOI. */
function jpegChain(chain: number, w: number, h: number): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  for (let i = 0; i < chain; i++) out.push(0xff, 0xe0, 0x00, 0x02);
  out.push(0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9);
  return new Uint8Array(out);
}

const nest = (depth: number): unknown => {
  let v: unknown = [];
  for (let i = 1; i < depth; i++) v = [v];
  return v;
};

const elapsed = (fn: () => void): number => {
  const t0 = Date.now();
  fn();
  return Date.now() - t0;
};

describe('work bounds', () => {
  test('50k images on one bufferView: one count error, no header parsing', () => {
    const glb = imagesOnOneView(makeJpegHeader(8, 8), 50000);
    let result = inspectGlb(glb, limits({ jsonChunkMaxBytes: 4 << 20 }));
    const ms = elapsed(() => (result = inspectGlb(glb, limits({ jsonChunkMaxBytes: 4 << 20 }))));
    assert.deepStrictEqual(result.errors, ['scene.images: 50000 images; the limit is 16']);
    assert.ok(result.stats);
    assert.deepStrictEqual(result.stats.images, []);
    assert.ok(ms < 2000, `${ms} ms`);
  });

  test('over maxImages but under 4× the limit: only the first maxImages are inspected', () => {
    const glb = imagesOnOneView(makeJpegHeader(8, 8), 40);
    const { errors, stats } = inspectGlb(glb);
    assert.deepStrictEqual(errors, ['scene.images: 40 images; the limit is 16']);
    assert.ok(stats);
    assert.deepStrictEqual(stats.images.map((i) => i.index), Array.from({ length: 16 }, (_, i) => i));
    assert.equal(stats.texturePixels, 16 * 64);
  });

  test('a header is parsed once per bufferView (a 1 MB fill-byte run × 50k images stays fast)', () => {
    const slow = new Uint8Array(1 << 20).fill(0xff);
    slow[1] = 0xd8; // SOI, then fill bytes to the end: one parse walks the whole view
    const glb = imagesOnOneView(slow, 50000);
    let errors: string[] = [];
    const ms = elapsed(() => (errors = inspectGlb(glb, limits({ maxImages: 100000, jsonChunkMaxBytes: 4 << 20 })).errors));
    assert.ok(ms < 3000, `${ms} ms`);
    assert.equal(errors.length, MAX_ERRORS + 1);
    assert.equal(errors[0], "scene.images[0]: can't read the JPEG header");
    assert.equal(errors[MAX_ERRORS], `scene: …and ${50000 - MAX_ERRORS} more problems`);
  });

  test('the JPEG marker scan stops after MAX_JPEG_MARKERS markers', () => {
    assert.equal(MAX_JPEG_MARKERS, 512);
    assert.deepStrictEqual(imageSize(jpegChain(511, 640, 480), 'image/jpeg'), { width: 640, height: 480 }); // SOF is marker 512
    assert.equal(imageSize(jpegChain(512, 640, 480), 'image/jpeg'), null); // SOF would be marker 513
    assert.deepStrictEqual(inspectGlb(imagesOnOneView(jpegChain(100000, 64, 64), 1)).errors, ["scene.images[0]: can't read the JPEG header"]);
    assert.deepStrictEqual(inspectGlb(imagesOnOneView(jpegChain(511, 64, 64), 1)).errors, []);
  });

  test('700k empty bufferViews: one early error, the list stays bounded', () => {
    const glb = buildGlb(simple({ editJson: (j) => (j.bufferViews = new Array(700000).fill({})) }));
    let errors: string[] = [];
    const ms = elapsed(() => (errors = inspectGlb(glb, limits({ jsonChunkMaxBytes: 4 << 20 })).errors));
    assert.ok(ms < 3000, `${ms} ms`);
    assert.equal(errors[0], 'scene.bufferViews: 700000 bufferViews; the limit is 65536');
    assert.equal(errors.filter((e) => pathMatches(e, 'scene.bufferViews')).length, 1);
    assert.ok(errors.length <= MAX_ERRORS + 1, `${errors.length} errors`);
  });

  test('the error list keeps MAX_ERRORS entries, then one summary line', () => {
    const bad = (k: number) => buildGlb(simple({ editJson: (j) => (j.bufferViews = j.bufferViews.concat(new Array(k).fill({}))) }));
    assert.equal(MAX_ERRORS, 100);
    const at = inspectGlb(bad(100)).errors;
    assert.equal(at.length, 100);
    assert.ok(at.every((e) => / no such buffer$/.test(e)));
    const one = inspectGlb(bad(101)).errors;
    assert.equal(one.length, 101);
    assert.equal(one[100], 'scene: …and 1 more problem');
    const many = inspectGlb(bad(300)).errors;
    assert.equal(many.length, 101);
    assert.equal(many[100], 'scene: …and 200 more problems');
  });

  test('arrays with a limit are skipped past 4× it; the count error is the same either way', () => {
    const nodes = (k: number) => buildGlb(simple({ editJson: (j) => (j.nodes = new Array(k).fill({ name: 'N' })) }));
    const at = inspectGlb(nodes(4 * 512), DEFAULT_LIMITS);
    assert.deepStrictEqual(at.errors, ['scene.nodes: 2048 nodes; the limit is 512']);
    assert.equal(at.summary?.nodes.length, 2048);
    const over = inspectGlb(nodes(4 * 512 + 1), DEFAULT_LIMITS);
    assert.deepStrictEqual(over.errors, ['scene.nodes: 2049 nodes; the limit is 512']);
    assert.deepStrictEqual(over.summary?.nodes, []);
    assert.equal(over.stats?.nodes, 0);
    const lights = inspectGlb(buildGlb(simple({ editJson: (j) => (j.extensions = { KHR_lights_punctual: { lights: new Array(17).fill({ type: 'point' }) } }) })));
    assert.deepStrictEqual(lights.errors, ['scene.extensions.KHR_lights_punctual.lights: 17 lights; the limit is 4']);
  });

  test('arrays without a limit are capped at 65536', () => {
    for (const key of ['accessors', 'samplers', 'textures', 'scenes', 'buffers', 'extensionsUsed']) {
      const { errors } = inspectGlb(buildGlb(simple({ editJson: (j) => (j[key] = new Array(65537).fill(0)) })));
      assert.equal(errors[0], `scene.${key}: 65537 ${key}; the limit is 65536`, key);
      assert.equal(errors.filter((e) => pathMatches(e, `scene.${key}`)).length, 1, key);
    }
    const ok = inspectGlb(buildGlb(simple({ editJson: (j) => (j.textures = new Array(65536).fill({})) })));
    assert.deepStrictEqual(ok.errors, []);
  });

  test('extensionsRequired is checked in linear time', () => {
    const names = Array.from({ length: 60000 }, (_, i) => `X_${i}`);
    const glb = buildGlb(simple({ editJson: (j) => ((j.extensionsUsed = names), (j.extensionsRequired = names.concat(['Y']))) }));
    let errors: string[] = [];
    const ms = elapsed(() => (errors = inspectGlb(glb).errors));
    assert.ok(ms < 2000, `${ms} ms`);
    assert.equal(errors[errors.length - 1], 'scene: …and 59901 more problems'); // 60000 unsupported + 1 not listed, 100 kept
  });

  test('per-mesh primitives past 4 × maxDrawCalls, morph names past 4 × maxMorphTargets, samplers past 65536', () => {
    const prims = (k: number) => buildGlb(simple({ editJson: (j) => (j.meshes[0].primitives = new Array(k).fill(j.meshes[0].primitives[0])) }));
    const lim = limits({ maxDrawCalls: 2 });
    assert.deepStrictEqual(inspectGlb(prims(9), lim).errors, ['scene.meshes[0].primitives: 9 primitives; the limit is 2']);
    assert.deepStrictEqual(inspectGlb(prims(8), lim).errors, ['scene: 8 draw calls; the limit is 2']);

    const targets = (k: number) => buildGlb(simple({ editJson: (j) => (j.meshes[0].primitives[0].targets = new Array(k).fill({})) }));
    const one = limits({ maxMorphTargets: 1 });
    const four = inspectGlb(targets(4), one);
    assert.deepStrictEqual(four.errors, ['scene.meshes[0]: 4 morph targets; the limit is 1']);
    assert.deepStrictEqual(four.summary?.meshes[0].morphs, ['', '', '', '']);
    const five = inspectGlb(targets(5), one);
    assert.deepStrictEqual(five.errors, ['scene.meshes[0]: 5 morph targets; the limit is 1']);
    assert.deepStrictEqual(five.summary?.meshes[0].morphs, []);
    assert.equal(five.stats?.morphTargets, 5);

    const samplers = inspectGlb(buildGlb(simple({ editJson: (j) => (j.animations = [{ channels: [], samplers: new Array(65537).fill({}) }]) })));
    assert.deepStrictEqual(samplers.errors, ['scene.animations[0].samplers: 65537 samplers; the limit is 65536']);
  });

  test('JSON nested deeper than 100 is refused, as Ruby JSON does', () => {
    const deep = (depth: number) => buildGlb(simple({ editJson: (j) => (j.extras = nest(depth - 1)) })); // the root object is depth 1
    assert.deepStrictEqual(inspectGlb(deep(100)).errors, []);
    const refused = inspectGlb(deep(101));
    assert.deepStrictEqual(refused.errors, ['scene: JSON nested too deeply']);
    assert.equal(refused.summary, null);
    // Brackets inside strings don't count, escaped quotes don't end a string.
    assert.deepStrictEqual(inspectGlb(buildGlb(simple({ editJson: (j) => (j.extras = { s: '"\\'.repeat(3) + '['.repeat(500) }) }))).errors, []);
    assert.equal(jsonTooDeep('['.repeat(100) + ']'.repeat(100)), false);
    assert.equal(jsonTooDeep('['.repeat(101)), true); // decided before parsing: invalid JSON too
    assert.equal(jsonTooDeep('{"a":"[[[[\\"[[["}'), false);
    assert.equal(jsonTooDeep('[{}]', 1), true);
  });
});

describe('image trailers', () => {
  const cat = (a: Uint8Array, tail: number[]): Uint8Array => {
    const out = new Uint8Array(a.length + tail.length);
    out.set(a);
    out.set(tail, a.length);
    return out;
  };
  const png = makePng(4, 4);
  const jpeg = makeJpegHeader(640, 480);
  const one = (data: Uint8Array, mime: string) => inspectGlb(imagesOnOneView(data, 1, mime)).errors;

  test('complete PNG and JPEG pass and are counted', () => {
    assert.deepStrictEqual(Array.from(png.subarray(png.length - 12)), [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    assert.deepStrictEqual(Array.from(jpeg.subarray(jpeg.length - 2)), [0xff, 0xd9]);
    assert.ok(hasImageTrailer(png, 'image/png'));
    assert.ok(hasImageTrailer(jpeg, 'image/jpeg'));
    assert.ok(hasImageTrailer(makePng(3000, 20, { headerOnly: true }), 'image/png'));
    assert.deepStrictEqual(one(png, 'image/png'), []);
    const { errors, stats } = inspectGlb(imagesOnOneView(jpeg, 1));
    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(stats?.images.map((i) => [i.width, i.height]), [[640, 480]]);
  });

  test('PNG without IEND', () => {
    const msg = 'scene.images[0]: the PNG is cut short (no IEND)';
    assert.deepStrictEqual(inspectGlb(buildGlb(simple({ images: [{ mime: 'image/png', width: 4, height: 4, truncated: true }] }))).errors, [msg]);
    assert.deepStrictEqual(one(png.subarray(0, png.length - 1), 'image/png'), [msg]); // one CRC byte short
    assert.deepStrictEqual(one(png.subarray(0, png.length - 30), 'image/png'), [msg]); // inside IDAT
    const badCrc = png.slice();
    badCrc[badCrc.length - 1] ^= 1;
    assert.deepStrictEqual(one(badCrc, 'image/png'), [msg]);
    // Cut-short images add no stats or pixels.
    const { stats } = inspectGlb(imagesOnOneView(png.subarray(0, png.length - 1), 1, 'image/png'));
    assert.deepStrictEqual(stats?.images, []);
    assert.equal(stats?.texturePixels, 0);
  });

  test('JPEG without EOI', () => {
    const msg = 'scene.images[0]: the JPEG is cut short (no EOI)';
    assert.deepStrictEqual(inspectGlb(buildGlb(simple({ images: [{ mime: 'image/jpeg', width: 8, height: 8, truncated: true }] }))).errors, [msg]);
    assert.deepStrictEqual(one(makeJpegHeader(8, 8, { noEoi: true }), 'image/jpeg'), [msg]);
    assert.deepStrictEqual(one(jpeg.subarray(0, jpeg.length - 1), 'image/jpeg'), [msg]);
    assert.deepStrictEqual(one(cat(jpeg, [0x12]), 'image/jpeg'), [msg]); // junk after EOI
  });

  test('an unreadable header is reported instead of the trailer', () => {
    assert.deepStrictEqual(one(makePng(4, 4).subarray(0, 20), 'image/png'), ["scene.images[0]: can't read the PNG header"]);
  });

  test('padding: up to 3 trailing 0x00 bytes after the trailer, nothing else', () => {
    for (const k of [1, 2, 3]) {
      const zeros = new Array(k).fill(0);
      assert.deepStrictEqual(one(cat(png, zeros), 'image/png'), [], `PNG + ${k}`);
      assert.deepStrictEqual(one(cat(jpeg, zeros), 'image/jpeg'), [], `JPEG + ${k}`);
    }
    assert.deepStrictEqual(one(cat(png, [0, 0, 0, 0]), 'image/png'), ['scene.images[0]: the PNG is cut short (no IEND)']);
    assert.deepStrictEqual(one(cat(jpeg, [0, 0, 0, 0]), 'image/jpeg'), ['scene.images[0]: the JPEG is cut short (no EOI)']);
    assert.deepStrictEqual(one(cat(png, [0x20]), 'image/png'), ['scene.images[0]: the PNG is cut short (no IEND)']);
    assert.deepStrictEqual(one(cat(jpeg, [0, 0xff]), 'image/jpeg'), ['scene.images[0]: the JPEG is cut short (no EOI)']);
  });

  test('the trailer result is memoised per bufferView like the header', () => {
    const errors = inspectGlb(imagesOnOneView(makeJpegHeader(8, 8, { noEoi: true }), 3)).errors;
    assert.deepStrictEqual(errors, [0, 1, 2].map((i) => `scene.images[${i}]: the JPEG is cut short (no EOI)`));
  });
});
