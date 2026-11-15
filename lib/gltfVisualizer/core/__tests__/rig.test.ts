// Rig tests: GLBs from testGlb, parsed by three's GLTFLoader in Node (see helpers.ts for how the
// ESM loader is loaded under CommonJS), driven frame by frame.
import { describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as THREE from 'three';
import { SOURCE_INDEX, createSourceBuffer } from '../bindings';
import { GltfVisualizerManifest, normalizeManifest } from '../manifest';
import { PendingNote, TransportState, compileNoteRules, offerNoteEvent } from '../noteClips';
import { GltfLike, Rig, createRig } from '../rig';
import { TestGlbSpec, buildGlb } from '../testGlb';
import { manifestCases, parseGlb } from './helpers';
import { fixtureSceneSpec, rigSceneSpec } from './scenes';

type Audio = Partial<GltfVisualizerManifest['audio']>;
type Extra = Partial<Pick<GltfVisualizerManifest, 'view' | 'materials'>>;

async function rigFor(audio: Audio, extra: Extra = {}, spec: TestGlbSpec = rigSceneSpec()): Promise<{ rig: Rig; gltf: GltfLike }> {
  const gltf = await parseGlb(buildGlb(spec));
  const n = normalizeManifest({ format: 1, type: 'gltf', scene: 's.glb', audio: { schemaVersion: 1, ...audio }, ...extra });
  return { rig: createRig(gltf, n), gltf };
}

const stopped = (): TransportState => ({ playing: false, bpm: 120, beatPhase: 0, barPhase: 0 });
const node = (gltf: GltfLike, name: string): THREE.Object3D => {
  const o = gltf.scene.getObjectByName(name);
  assert.ok(o, name);
  return o;
};
const mesh = (gltf: GltfLike, name: string) => node(gltf, name) as THREE.Mesh;
const close = (a: number, b: number, eps = 1e-5) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const action = (rig: Rig, gltf: GltfLike, clip: string): THREE.AnimationAction => {
  const c = gltf.animations.find((a) => a.name === clip);
  assert.ok(c && rig.mixer);
  const a = rig.mixer.existingAction(c);
  assert.ok(a, `action for ${clip}`);
  return a;
};
const src = createSourceBuffer();
const set = (name: keyof typeof SOURCE_INDEX, v: number) => (src[SOURCE_INDEX[name]] = v);
const reset = () => src.fill(0);

describe('fixture manifests on the fixture scene', () => {
  for (const c of manifestCases().valid) {
    test(`builds and runs: ${c.name}`, async () => {
      const gltf = await parseGlb(buildGlb(fixtureSceneSpec()));
      const rig = createRig(gltf, normalizeManifest(c.manifest));
      const pending = new PendingNote('velocity');
      const nc = normalizeManifest(c.manifest).audio.noteClips;
      const tables = compileNoteRules(nc);
      const t: TransportState = { playing: true, bpm: 128, beatPhase: 0, barPhase: 0 };
      for (let i = 0; i < 120; i++) {
        for (let s = 0; s < src.length; s++) src[s] = (Math.sin(i * 0.3 + s) + 1) / 2;
        set('note', 60);
        t.beatPhase = (i * 0.07) % 1;
        t.barPhase = (i * 0.0175) % 1;
        if (i % 20 === 0) offerNoteEvent(tables, pending, i % 40 === 0 ? 'synth' : 'sampler', i % 40 === 0 ? 50 : 15, 90, true);
        rig.update(1 / 60, src, t, pending);
      }
      const p = rig.camera.position;
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
      reset();
      rig.dispose();
    });
  }

  test('dancer: toon everywhere, an outline on the skinned Skin primitive', async () => {
    const dancer = manifestCases().valid.find((c) => c.name === 'dancer example');
    assert.ok(dancer);
    const gltf = await parseGlb(buildGlb(fixtureSceneSpec()));
    const rig = createRig(gltf, normalizeManifest(dancer.manifest));
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.userData.outline) meshes.push(o as THREE.Mesh);
    });
    assert.equal(meshes.length, 4);
    for (const m of meshes) assert.equal((m.material as THREE.Material).type, 'MeshToonMaterial');
    assert.equal(rig.outlineCount, 1);
    assert.equal(rig.drawCalls, 5);
    const body = meshes.find((m) => (m as THREE.SkinnedMesh).isSkinnedMesh && m.children.some((c) => c.userData.outline)) as THREE.SkinnedMesh;
    assert.ok(body);
    const outline = body.children.find((c) => c.userData.outline) as THREE.SkinnedMesh;
    assert.equal(outline.isSkinnedMesh, true);
    assert.equal(outline.skeleton, body.skeleton);
    assert.ok(outline.bindMatrix.equals(body.bindMatrix));
    assert.equal(outline.geometry, body.geometry);
    assert.equal(outline.morphTargetInfluences, body.morphTargetInfluences);
    assert.equal((outline.material as THREE.Material).side, THREE.BackSide);
  });
});

describe('node offsets', () => {
  test('scale offset applied and removed; no drift on a static node', async () => {
    const { rig, gltf } = await rigFor({
      bindings: [
        { source: 'kick', outputRange: [1, 2], target: { kind: 'node', node: 'Cone', property: 'scale' } },
        { source: 'snare', outputRange: [0, 1], target: { kind: 'node', node: 'Cone', property: 'position', axis: 'xyz' } },
        { source: 'hats', outputRange: [0, 90], target: { kind: 'node', node: 'Cone', property: 'rotation', axis: 'x' } },
      ],
    });
    const cone = node(gltf, 'Cone');
    reset();
    set('kick', 1);
    rig.update(1 / 60, src, stopped(), null);
    assert.deepStrictEqual(cone.scale.toArray(), [2, 2, 2]);
    set('kick', 0);
    rig.update(1 / 60, src, stopped(), null);
    assert.deepStrictEqual(cone.scale.toArray(), [1, 1, 1]);
    for (let i = 0; i < 100; i++) {
      set('kick', (i * 7) % 10 / 10);
      set('snare', (i * 3) % 10 / 10);
      set('hats', (i * 5) % 10 / 10);
      rig.update(1 / 60, src, stopped(), null);
    }
    set('hats', 1);
    rig.update(1 / 60, src, stopped(), null);
    close(new THREE.Euler().setFromQuaternion(cone.quaternion).x, Math.PI / 2);
    reset();
    rig.update(1 / 60, src, stopped(), null);
    assert.deepStrictEqual(cone.scale.toArray(), [1, 1, 1]);
    assert.deepStrictEqual(cone.position.toArray(), [0, 1, 0]);
    assert.deepStrictEqual(cone.quaternion.toArray(), [0, 0, 0, 1]);
  });

  test('offsets ride on an animated track without drift', async () => {
    const audio: Audio = { idle: { clips: [{ clip: 'Move' }] } };
    const ref = await rigFor(audio);
    const { rig, gltf } = await rigFor({ ...audio, bindings: [{ source: 'bass', outputRange: [0, 1], target: { kind: 'node', node: 'Mover', property: 'position', axis: 'x' } }] });
    const mover = node(gltf, 'Mover');
    const refMover = node(ref.gltf, 'Mover');
    reset();
    for (let i = 0; i < 100; i++) {
      const bass = (i * 13) % 10 / 10;
      set('bass', bass);
      rig.update(1 / 60, src, stopped(), null);
      ref.rig.update(1 / 60, src, stopped(), null);
      close(mover.position.x, refMover.position.x + bass);
    }
    set('bass', 0);
    rig.update(1 / 60, src, stopped(), null);
    ref.rig.update(1 / 60, src, stopped(), null);
    close(mover.position.x, refMover.position.x, 1e-6);
    assert.ok(refMover.position.x > 2 && refMover.position.x < 3);
  });

  test('spin accumulates degrees per second and holds its angle', async () => {
    const { rig, gltf } = await rigFor({ bindings: [{ source: 'high', outputRange: [0, 90], target: { kind: 'node', node: 'Cone', property: 'spin' } }] });
    const cone = node(gltf, 'Cone');
    reset();
    set('high', 1);
    for (let i = 0; i < 60; i++) rig.update(1 / 60, src, stopped(), null);
    close(new THREE.Euler().setFromQuaternion(cone.quaternion, 'YXZ').y, Math.PI / 2, 1e-4);
    set('high', 0);
    for (let i = 0; i < 10; i++) rig.update(1 / 60, src, stopped(), null);
    close(new THREE.Euler().setFromQuaternion(cone.quaternion, 'YXZ').y, Math.PI / 2, 1e-4);
  });
});

describe('morphs, materials, lights, camera', () => {
  test('morph influence by name and index', async () => {
    const { rig, gltf } = await rigFor({
      bindings: [
        { source: 'notePulse', target: { kind: 'morph', mesh: 'BodyMesh', morph: 'Blink' } },
        { source: 'bass', outputRange: [0, 0.5], target: { kind: 'morph', mesh: 'BodyMesh', morph: 0 } },
      ],
    });
    reset();
    set('notePulse', 0.7);
    set('bass', 1);
    rig.update(1 / 60, src, stopped(), null);
    const infl = mesh(gltf, 'Body').morphTargetInfluences as number[];
    close(infl[1], 0.7);
    close(infl[0], 0.5);
  });

  test('material outputs: emissive, colour lerp, hue shift, opacity, roughness/metalness', async () => {
    const { rig, gltf } = await rigFor({
      bindings: [
        { source: 'bass', outputRange: [0, 5], target: { kind: 'material', material: 'Neon', property: 'emissiveIntensity' } },
        { source: 'mid', target: { kind: 'material', material: 'Skin', property: 'color', colors: ['#000000', '#ffffff'] } },
        { source: 'high', outputRange: [0, 120], target: { kind: 'material', material: 'Neon', property: 'hueShift' } },
        { source: 'level', target: { kind: 'material', material: 'Skin', property: 'opacity' } },
        { source: 'level', target: { kind: 'material', material: 'Neon', property: 'roughness' } },
        { source: 'kick', target: { kind: 'material', material: 'Neon', property: 'metalness' } },
      ],
    });
    const neon = mesh(gltf, 'Cone').material as THREE.MeshStandardMaterial;
    const skin = mesh(gltf, 'Body').material as THREE.MeshStandardMaterial;
    assert.equal(skin.transparent, true);
    reset();
    set('bass', 1);
    set('mid', 0.5);
    set('high', 1);
    set('level', 0.25);
    set('kick', 1);
    rig.update(1 / 60, src, stopped(), null);
    close(neon.emissiveIntensity, 5);
    close(skin.color.r, 0.5);
    close(skin.color.g, 0.5);
    // Authored red rotated by 120° → green.
    assert.ok(neon.color.g > 0.9 && neon.color.r < 0.05 && neon.color.b < 0.05, neon.color.getHexString());
    assert.ok(neon.emissive.g > 0.9 && neon.emissive.r < 0.05, neon.emissive.getHexString());
    close(skin.opacity, 0.25);
    close(neon.roughness, 0.25);
    close(neon.metalness, 1);
    assert.equal(mesh(gltf, 'Mover').material, neon); // instances share the material
  });

  test('light intensity = authored × out', async () => {
    const { rig, gltf } = await rigFor({ bindings: [{ source: 'level', outputRange: [0, 2], target: { kind: 'light', light: 'KeyLight', property: 'intensity' } }] });
    let light: THREE.Light | undefined;
    node(gltf, 'KeyLight').traverse((o) => {
      if ((o as THREE.Light).isLight) light = o as THREE.Light;
    });
    assert.ok(light);
    reset();
    set('level', 1);
    rig.update(1 / 60, src, stopped(), null);
    close(light.intensity, 8);
  });

  test('auto framing, orbit and dolly', async () => {
    const { rig } = await rigFor(
      { bindings: [{ source: 'level', outputRange: [1, 2], target: { kind: 'camera', property: 'dolly' } }] },
      { view: { camera: { orbitSpeed: 90, elevation: 0, azimuth: 0, fov: 40 } } },
    );
    reset();
    rig.update(0, src, stopped(), null);
    const c = rig.center;
    const before = rig.camera.position.clone().sub(c);
    close(before.x, 0);
    const fitted = rig.radius / Math.sin((40 * Math.PI) / 360);
    close(before.length(), fitted, 1e-4);
    for (let i = 0; i < 10; i++) rig.update(0.1, src, stopped(), null);
    const after = rig.camera.position.clone().sub(c);
    close(Math.atan2(after.x, after.z), Math.PI / 2, 1e-4);
    set('level', 1);
    rig.update(0, src, stopped(), null);
    close(rig.camera.position.clone().sub(c).length(), fitted * 2, 1e-4);
    // Looks at the centre.
    const dir = new THREE.Vector3();
    rig.camera.getWorldDirection(dir);
    close(dir.dot(c.clone().sub(rig.camera.position).normalize()), 1, 1e-6);
    rig.setAspect(0.5);
    rig.update(0, src, stopped(), null);
    assert.ok(rig.camera.position.clone().sub(c).length() > fitted * 2);
  });

  test('glTF camera node', async () => {
    const { rig } = await rigFor({}, { view: { camera: { node: 'Cam' } } });
    rig.update(1 / 60, src, stopped(), null);
    close(rig.camera.position.y, 0.5);
    close(rig.camera.position.z, 6);
    close(rig.camera.fov, (0.6 * 180) / Math.PI, 1e-4);
  });

  test('background, exposure, studio vs scene lighting', async () => {
    const studio = await rigFor({}, { view: { background: '#102030', exposure: 1.5 } });
    assert.equal(studio.rig.background.getHexString(), '102030');
    assert.equal(studio.rig.exposure, 1.5);
    const names: string[] = [];
    studio.rig.root.children.forEach((o) => names.push(o.type));
    assert.ok(names.includes('HemisphereLight') && names.filter((n) => n === 'DirectionalLight').length === 2);
    const scene = await rigFor({}, { view: { lighting: 'scene' } });
    assert.deepStrictEqual(scene.rig.root.children.map((o) => o.type).filter((t) => t.endsWith('Light')), ['AmbientLight']);
  });
});

describe('toon and outlines', () => {
  test('MeshToonMaterial with a steps-texel NearestFilter gradient; outline hull', async () => {
    const { rig, gltf } = await rigFor(
      { bindings: [{ source: 'bass', target: { kind: 'material', material: 'Skin', property: 'roughness' } }, { source: 'kick', outputRange: [0, 3], target: { kind: 'material', material: 'Neon', property: 'emissiveIntensity' } }] },
      { materials: [{ material: 'Skin', toon: { steps: 3, outline: { width: 0.02, color: '#ff0000' } } }, { material: '*', toon: { steps: 2 } }] },
    );
    const body = mesh(gltf, 'Body');
    const toon = body.material as THREE.MeshToonMaterial;
    assert.equal(toon.type, 'MeshToonMaterial');
    const grad = toon.gradientMap as THREE.DataTexture;
    assert.equal(grad.image.width, 3);
    assert.equal(grad.magFilter, THREE.NearestFilter);
    assert.equal(grad.minFilter, THREE.NearestFilter);
    assert.ok(toon.color.r > toon.color.b); // authored skin colour kept
    close(toon.emissive.r, new THREE.Color().setRGB(0.2, 0.1, 0).r);
    const neon = mesh(gltf, 'Cone').material as THREE.MeshToonMaterial;
    assert.equal(neon.type, 'MeshToonMaterial');
    assert.equal((neon.gradientMap as THREE.DataTexture).image.width, 2);
    assert.equal(mesh(gltf, 'Mover').material, neon);

    assert.equal(rig.outlineCount, 1);
    assert.equal(rig.drawCalls, 4);
    const outline = body.children.find((c) => c.userData.outline) as THREE.Mesh;
    assert.ok(outline);
    assert.equal(outline.geometry, body.geometry);
    assert.equal(outline.morphTargetInfluences, body.morphTargetInfluences);
    const om = outline.material as THREE.MeshBasicMaterial;
    assert.equal(om.side, THREE.BackSide);
    assert.equal(om.color.getHexString(), 'ff0000');

    // The shader hook pushes along objectNormal after skinning, with width × scene radius.
    const shader = { uniforms: {} as { [k: string]: THREE.IUniform }, vertexShader: THREE.ShaderLib.basic.vertexShader };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (om.onBeforeCompile as any)(shader, null);
    assert.match(shader.vertexShader, /^uniform float outlineWidth;/);
    assert.match(shader.vertexShader, /#include <skinning_vertex>\n\ttransformed \+= normalize\( objectNormal \) \* outlineWidth;/);
    assert.match(shader.vertexShader, /#if !defined\( USE_ENVMAP \) && !defined\( USE_SKINNING \)\n\t#include <beginnormal_vertex>/);
    close(shader.uniforms.outlineWidth.value, 0.02 * rig.radius);

    // Material bindings act on the toon material; roughness is skipped silently.
    reset();
    set('kick', 1);
    set('bass', 1);
    rig.update(1 / 60, src, stopped(), null);
    close(neon.emissiveIntensity, 3);
    assert.equal((toon as unknown as { roughness?: number }).roughness, undefined);
  });
});

describe('clips', () => {
  test('speed, weight, scrub', async () => {
    const { rig, gltf } = await rigFor({
      bindings: [
        { source: 'bass', target: { kind: 'clip', clip: 'Move', mode: 'speed' } },
        { source: 'mid', target: { kind: 'clip', clip: 'Move', mode: 'weight' } },
        { source: 'beatPhase', target: { kind: 'clip', clip: 'Dance1', mode: 'scrub' } },
      ],
    });
    reset();
    set('bass', 0.5);
    set('mid', 0.3);
    set('beatPhase', 0.25);
    rig.update(1 / 60, src, stopped(), null);
    const move = action(rig, gltf, 'Move');
    close(move.timeScale, 1);
    close(move.weight, 0.3);
    const dance = action(rig, gltf, 'Dance1');
    close(dance.time, 0.25);
    close(node(gltf, 'Body').scale.x, 1.25);
  });

  test('play fades in at the threshold and out below threshold − 0.1', async () => {
    const { rig, gltf } = await rigFor({ bindings: [{ source: 'synth', target: { kind: 'clip', clip: 'Wave', mode: 'play', threshold: 0.3, fadeMs: 100 } }] });
    const wave = action(rig, gltf, 'Wave');
    reset();
    rig.update(0.05, src, stopped(), null);
    assert.equal(wave.weight, 0);
    set('synth', 1);
    rig.update(0.05, src, stopped(), null);
    close(wave.weight, 0.5);
    rig.update(0.05, src, stopped(), null);
    close(wave.weight, 1);
    set('synth', 0.25); // inside the hysteresis band: stays
    rig.update(0.05, src, stopped(), null);
    close(wave.weight, 1);
    set('synth', 0);
    rig.update(0.05, src, stopped(), null);
    close(wave.weight, 0.5);
    rig.update(0.05, src, stopped(), null);
    close(wave.weight, 0);
  });

  test('trigger restarts once per rising edge', async () => {
    const { rig, gltf } = await rigFor({ bindings: [{ source: 'drums', target: { kind: 'clip', clip: 'Pump', mode: 'trigger', fadeMs: 0 } }] });
    const pump = action(rig, gltf, 'Pump');
    reset();
    rig.update(0.1, src, stopped(), null);
    assert.equal(pump.weight, 0);
    set('drums', 1);
    rig.update(0.1, src, stopped(), null);
    close(pump.weight, 1);
    close(pump.time, 0.1);
    for (let i = 0; i < 2; i++) rig.update(0.1, src, stopped(), null);
    close(pump.time, 0.3);
    set('drums', 0);
    rig.update(0.1, src, stopped(), null);
    set('drums', 1);
    rig.update(0.1, src, stopped(), null);
    close(pump.time, 0.1);
  });

  test('with no clip named anywhere, the first animation loops', async () => {
    const { rig, gltf } = await rigFor({});
    for (let i = 0; i < 5; i++) rig.update(0.1, src, stopped(), null); // single steps are clamped to 0.25 s
    const move = action(rig, gltf, 'Move');
    assert.equal(move.weight, 1);
    close(node(gltf, 'Mover').position.x, 2.5);
    assert.equal(gltf.animations[0].name, 'Move');
    assert.equal(rig.mixer?.existingAction(gltf.animations[1]), null);
  });

  test('idle clips loop with their time scale', async () => {
    const { rig, gltf } = await rigFor({ idle: { clips: [{ clip: 'Move', timeScale: 0.5 }] } });
    for (let i = 0; i < 5; i++) rig.update(0.1, src, stopped(), null);
    close(node(gltf, 'Mover').position.x, 2.25);
    close(action(rig, gltf, 'Move').weight, 1);
  });
});

describe('noteClips in the rig', () => {
  test('a note crossfades the action weights over fadeMs; once returns', async () => {
    const audio: Audio = {
      noteClips: {
        initial: 'Idle',
        rules: [
          { match: { part: 'synth', note: 60 }, clip: 'Dance1', fadeMs: 100 },
          { match: { part: 'synth', note: 62 }, clip: 'Wave', mode: 'once', fadeMs: 100, velocity: { to: 'weight', range: [0.5, 1] } },
        ],
      },
    };
    const { rig, gltf } = await rigFor(audio);
    const n = normalizeManifest({ format: 1, type: 'gltf', scene: 's.glb', audio: { schemaVersion: 1, ...audio } });
    const tables = compileNoteRules(n.audio.noteClips);
    const pending = new PendingNote();
    const idle = action(rig, gltf, 'Idle');
    const dance = action(rig, gltf, 'Dance1');
    const wave = action(rig, gltf, 'Wave');
    reset();
    rig.update(0.05, src, stopped(), pending);
    assert.deepStrictEqual([idle.weight, dance.weight, wave.weight], [1, 0, 0]);
    offerNoteEvent(tables, pending, 'synth', 60, 100, true);
    rig.update(0.05, src, stopped(), pending);
    assert.equal(pending.has, false, 'the rig consumes the pending note');
    close(idle.weight, 0.5);
    close(dance.weight, 0.5);
    rig.update(0.05, src, stopped(), pending);
    close(idle.weight, 0);
    close(dance.weight, 1);

    offerNoteEvent(tables, pending, 'synth', 62, 0, true); // once, velocity 0 → weight 0.5
    rig.update(0.05, src, stopped(), pending);
    close(wave.weight, 0.25);
    close(dance.weight, 0.5);
    assert.equal(wave.loop, THREE.LoopOnce);
    rig.update(0.05, src, stopped(), pending);
    close(wave.weight, 0.5);
    // Wave lasts 1 s; 0.1 s before its end (at 0.9 s) the switcher fades back to Dance1.
    for (let i = 0; i < 15; i++) rig.update(0.05, src, stopped(), pending); // 0.85 s
    close(dance.weight, 0, 1e-6);
    for (let i = 0; i < 3; i++) rig.update(0.05, src, stopped(), pending);
    close(dance.weight, 1);
    close(wave.weight, 0);
    assert.equal(rig.noteClips?.visibleSlot, 1);
  });
});

describe('errors and lifecycle', () => {
  test('unresolvable names throw with the manifest path', async () => {
    const gltf = await parseGlb(buildGlb(rigSceneSpec()));
    const n = normalizeManifest({ format: 1, type: 'gltf', scene: 's.glb', audio: { schemaVersion: 1, bindings: [{ source: 'bass', target: { kind: 'node', node: 'Nope', property: 'scale' } }] } });
    assert.throws(() => createRig(gltf, n), /^Error: audio\.bindings\[0\]\.target\.node: "Nope" is not a node/);
    const m = normalizeManifest({ format: 1, type: 'gltf', scene: 's.glb', audio: { schemaVersion: 1, bindings: [{ source: 'bass', target: { kind: 'morph', mesh: 'BodyMesh', morph: 'Frown' } }] } });
    assert.throws(() => createRig(gltf, m), /target\.morph: "Frown"/);
  });

  test('dispose releases materials, textures, outlines and detaches', async () => {
    const { rig, gltf } = await rigFor({ idle: { clips: [{ clip: 'Move' }] } }, { materials: [{ material: '*', toon: { steps: 4, outline: { width: 0.01 } } }] });
    const host = new THREE.Scene();
    host.add(rig.root);
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    gltf.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
      if (m) materials.add(m);
      if (m && m.gradientMap) textures.add(m.gradientMap);
    });
    // Body (Skin) and Cone/Mover (shared Neon) toon materials, three outline materials, one gradient.
    assert.deepStrictEqual([materials.size, textures.size], [5, 1]);
    let disposedMaterials = 0;
    let disposedTextures = 0;
    materials.forEach((m) => m.addEventListener('dispose', () => disposedMaterials++));
    textures.forEach((t) => t.addEventListener('dispose', () => disposedTextures++));
    const move = action(rig, gltf, 'Move');
    rig.dispose();
    assert.equal(rig.root.parent, null);
    let outlines = 0;
    gltf.scene.traverse((o) => {
      if (o.userData.outline) outlines++;
    });
    assert.equal(outlines, 0);
    assert.equal(disposedMaterials, 5);
    assert.equal(disposedTextures, 1);
    assert.equal(move.isRunning(), false);
    assert.equal(rig.mixer?.existingAction(gltf.animations[0]), null); // uncached
    rig.update(1 / 60, src, stopped(), null); // a no-op after dispose
  });
});

describe('allocation', () => {
  test('update() constructs no THREE objects over 1000 frames after warm-up', async () => {
    const audio: Audio = {
      idle: { clips: [{ clip: 'Move' }] },
      noteClips: {
        initial: 'Idle',
        returnAfterMs: 800,
        onStop: 'initial',
        rules: [
          { match: { part: 'synth', note: 60 }, clip: 'Dance1', sync: 'beat', clipBpm: 120 },
          { match: { part: 'sampler', slot: 1 }, clip: 'Wave', mode: 'once', velocity: { to: 'weight', range: [0.4, 1] } },
        ],
      },
      bindings: [
        { source: 'kick', target: { kind: 'node', node: 'Cone', property: 'scale' } },
        { source: 'high', target: { kind: 'node', node: 'Cone', property: 'spin' } },
        { source: 'snare', target: { kind: 'node', node: 'Mover', property: 'rotation', axis: 'xyz' } },
        { sources: [{ source: 'bass', weight: 0.7 }, { source: 'hit', weight: 0.5 }], combine: 'max', curve: 'exp', smoothing: { attackMs: 10, releaseMs: 300 }, target: { kind: 'material', material: 'Neon', property: 'emissiveIntensity' } },
        { source: 'mid', target: { kind: 'material', material: 'Neon', property: 'color', colors: ['#ff0000', '#00ff00'] } },
        { source: 'note', inputRange: [36, 84], target: { kind: 'material', material: 'Skin', property: 'hueShift' } },
        { source: 'level', target: { kind: 'material', material: 'Skin', property: 'opacity' } },
        { source: 'notePulse', target: { kind: 'morph', mesh: 'BodyMesh', morph: 'Smile' } },
        { source: 'level', target: { kind: 'light', light: 'KeyLight', property: 'intensity' } },
        { source: 'playing', target: { kind: 'camera', property: 'orbitSpeed' } },
        { source: 'onset', target: { kind: 'camera', property: 'dolly' } },
        { source: 'beatPhase', target: { kind: 'clip', clip: 'Pump', mode: 'scrub' } },
      ],
    };
    const { rig } = await rigFor(audio, { materials: [{ material: 'Skin', toon: { steps: 3, outline: { width: 0.01 } } }], view: { camera: { orbitSpeed: 10 } } });
    const n = normalizeManifest({ format: 1, type: 'gltf', scene: 's.glb', audio: { schemaVersion: 1, ...audio } });
    const tables = compileNoteRules(n.audio.noteClips);
    const pending = new PendingNote('velocity');
    const transport: TransportState = { playing: true, bpm: 120, beatPhase: 0, barPhase: 0 };
    const frame = (i: number) => {
      for (let s = 0; s < src.length; s++) src[s] = (Math.sin(i * 0.37 + s) + 1) / 2;
      src[SOURCE_INDEX.note] = 40 + (i % 40);
      transport.playing = i % 400 < 350;
      transport.beatPhase = (i * 0.04) % 1;
      transport.barPhase = (i * 0.01) % 1;
      if (i % 23 === 0) offerNoteEvent(tables, pending, 'synth', 60, 100, true);
      if (i % 61 === 0) offerNoteEvent(tables, pending, 'sampler', 1, i % 127, true);
      rig.update(1 / 60, src, transport, pending);
    };
    for (let i = 0; i < 120; i++) frame(i);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const three = require('three');
    const names = ['Vector2', 'Vector3', 'Vector4', 'Quaternion', 'Euler', 'Color', 'Matrix3', 'Matrix4', 'Box3', 'Sphere'];
    const originals: { [name: string]: unknown } = {};
    let constructed = 0;
    for (const name of names) {
      const Original = three[name];
      originals[name] = Original;
      three[name] = class extends Original {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor(...args: any[]) {
          super(...args);
          constructed++;
        }
      };
    }
    try {
      // The spies are visible through the namespace import the core uses.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new (THREE as any).Vector3();
      assert.equal(constructed, 1);
      constructed = 0;
      for (let i = 120; i < 1120; i++) frame(i);
    } finally {
      for (const name of names) three[name] = originals[name];
    }
    assert.equal(constructed, 0);
    assert.ok(Number.isFinite(rig.camera.position.x));
  });
});
