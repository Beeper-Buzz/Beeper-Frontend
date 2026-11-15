import { describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { TextDecoder, TextEncoder } from 'util';
import { DEFAULT_LIMITS, GltfLimits } from '../limits';
import { decodeUtf8, decodeUtf8Lossy, encodeUtf8, imageSize, inspectGlb, sniffImageMime } from '../glb';
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
