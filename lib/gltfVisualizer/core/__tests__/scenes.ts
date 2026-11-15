// Test scenes. fixtureSceneSpec() builds a GLB whose inspector summary equals the `summary` of
// fixtures/manifest-cases.json, so the fixture manifests drive both the inspector and the rig.

import { TestGlbSpec, cubePrimitive, trianglePrimitive } from '../testGlb';

const ROT_Y_90: number[] = [0, Math.SQRT1_2, 0, Math.SQRT1_2];

/** Rotation track about Y from identity to 90° and back over `duration` seconds. */
function wiggle(node: number, duration: number): { node: number; path: 'rotation'; times: number[]; values: number[] } {
  return { node, path: 'rotation', times: [0, duration / 2, duration], values: [0, 0, 0, 1, ...ROT_Y_90, 0, 0, 0, 1] };
}

function morphed(material: number, base: ReturnType<typeof cubePrimitive>) {
  const n = base.positions.length;
  const smile: number[] = [];
  const blink: number[] = [];
  for (let i = 0; i < n; i++) {
    smile.push(i % 3 === 1 ? 0.1 : 0);
    blink.push(i % 3 === 0 ? -0.05 : 0);
  }
  return { ...base, material, targets: [smile, blink], skinned: true };
}

export function fixtureSceneSpec(): TestGlbSpec {
  return {
    nodes: [
      { name: 'Root', children: [1, 3, 5, 6, 7, 8] },
      { name: 'Dancer', mesh: 0, skin: 0, children: [2] },
      { name: 'Hips', translation: [0, 0.5, 0] },
      { name: 'Speaker', mesh: 1, translation: [1.5, 0, 0], children: [4] },
      { name: 'Cone', mesh: 1, translation: [0, 0.5, 0.2], scale: [0.5, 0.5, 0.5] },
      { name: 'KeyLight', light: 0, translation: [1, 2, 2] },
      { name: 'Cam', camera: 0, translation: [0, 1, 4] },
      { name: 'Dup' },
      { name: 'Dup' },
    ],
    meshes: [
      { name: 'Body', primitives: [morphed(0, cubePrimitive(1)), morphed(1, trianglePrimitive())], targetNames: ['Smile', 'Blink'] },
      { name: 'SpeakerMesh', primitives: [cubePrimitive(0.8, 2)] },
    ],
    materials: [
      { name: 'Skin', color: [0.9, 0.6, 0.5, 1] },
      { name: 'Outfit', color: [0.2, 0.4, 0.9, 1], emissive: [0.1, 0, 0] },
      { name: 'Neon', color: [1, 1, 1, 1], emissive: [1, 0.2, 0.6], roughness: 0.4, metallic: 0.1 },
      { name: 'Dup' },
      { name: 'Dup' },
    ],
    skins: [{ joints: [2] }],
    lights: [{ type: 'point', intensity: 3, name: 'Key' }],
    cameras: [{ yfov: 0.7, znear: 0.05, zfar: 100 }],
    animations: [
      { name: 'Idle', channels: [wiggle(2, 2)] },
      { name: 'Dance1', channels: [wiggle(2, 1.92)] },
      { name: 'Dance2', channels: [wiggle(2, 3.84)] },
      { name: 'Wave', channels: [{ node: 2, path: 'translation', times: [0, 1.5], values: [0, 0.5, 0, 0, 0.8, 0] }] },
      { name: 'Pump', channels: [{ node: 4, path: 'scale', times: [0, 0.25, 0.5], values: [0.5, 0.5, 0.5, 0.6, 0.6, 0.6, 0.5, 0.5, 0.5] }] },
      { name: 'Fan', channels: [wiggle(3, 4)] },
    ],
  };
}

/** A small scene for rig tests: a static node, an animated node, morphs, a light, a camera. */
export function rigSceneSpec(): TestGlbSpec {
  return {
    nodes: [
      { name: 'Root', children: [1, 2, 3, 4, 5] },
      { name: 'Body', mesh: 0 },
      { name: 'Cone', mesh: 1, translation: [0, 1, 0] },
      { name: 'Mover', mesh: 1, translation: [2, 0, 0] },
      { name: 'KeyLight', light: 0, translation: [0, 3, 3] },
      { name: 'Cam', camera: 0, translation: [0, 0.5, 6] },
    ],
    meshes: [
      { name: 'BodyMesh', primitives: [{ ...cubePrimitive(1, 0), targets: [new Array(24).fill(0.1), new Array(24).fill(-0.1)] }], targetNames: ['Smile', 'Blink'] },
      { name: 'Box', primitives: [cubePrimitive(0.5, 1)] },
    ],
    materials: [
      { name: 'Skin', color: [0.9, 0.6, 0.5, 1], emissive: [0.2, 0.1, 0] },
      { name: 'Neon', color: [1, 0, 0, 1], emissive: [1, 0, 0], roughness: 0.5, metallic: 0 },
    ],
    lights: [{ type: 'point', intensity: 4 }],
    cameras: [{ yfov: 0.6 }],
    animations: [
      { name: 'Move', channels: [{ node: 3, path: 'translation', times: [0, 1], values: [2, 0, 0, 3, 0, 0] }] },
      { name: 'Idle', channels: [wiggle(1, 2)] },
      { name: 'Dance1', channels: [{ node: 1, path: 'scale', times: [0, 1], values: [1, 1, 1, 2, 2, 2] }] },
      { name: 'Wave', channels: [{ node: 1, path: 'translation', times: [0, 1], values: [0, 0, 0, 0, 1, 0] }] },
      { name: 'Pump', channels: [{ node: 2, path: 'scale', times: [0, 0.5], values: [1, 1, 1, 1.5, 1.5, 1.5] }] },
    ],
  };
}
