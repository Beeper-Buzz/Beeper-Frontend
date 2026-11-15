import { describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DEFAULT_LIMITS } from '../limits';
import { SceneStats } from '../glb';
import {
  DEFAULT_CLIP_FADE_MS,
  isGltfVisualizerManifest,
  normalizeManifest,
  outputKeyOf,
  validateManifest,
} from '../manifest';
import { errorPathOf, manifestCases, pathMatches } from './helpers';

const cases = manifestCases();
const base = (audio: object = {}, extra: object = {}) => ({ format: 1, type: 'gltf', scene: 's.glb', audio: { schemaVersion: 1, ...audio }, ...extra });

describe('fixtures/manifest-cases.json', () => {
  for (const c of cases.valid) {
    test(`valid: ${c.name}`, () => {
      assert.deepStrictEqual(validateManifest(c.manifest, cases.summary), []);
      assert.deepStrictEqual(validateManifest(c.manifest, null), []);
      assert.equal(isGltfVisualizerManifest(c.manifest), true);
    });
  }
  for (const c of cases.invalid) {
    test(`invalid: ${c.name} → ${c.errorPath}`, () => {
      const errors = validateManifest(c.manifest, cases.summary);
      assert.ok(errors.length > 0, 'expected errors');
      assert.ok(
        errors.some((e) => pathMatches(e, c.errorPath as string)),
        `no error at ${c.errorPath}; got:\n  ${errors.join('\n  ')}`,
      );
      for (const e of errors) assert.match(e, /^[^:]+: \S/, `"<path>: <message>" form: ${e}`);
    });
  }
  test('schema-only cases fail without a summary too; name cases need it', () => {
    for (const c of cases.invalid) {
      if (c.schemaOnly) assert.ok(validateManifest(c.manifest, null).length > 0, c.name);
    }
    const nameCase = cases.invalid.find((c) => c.name === 'unknown node');
    assert.ok(nameCase);
    assert.deepStrictEqual(validateManifest(nameCase.manifest, null), []);
  });
});

describe('structure', () => {
  test('not an object', () => {
    assert.deepStrictEqual(validateManifest(null, null), ['manifest: must be an object']);
    assert.deepStrictEqual(validateManifest([], null), ['manifest: must be an object']);
  });

  test('unknown keys at depth are reported at their own path', () => {
    const m = base(
      { bindings: [{ source: 'bass', smoothing: { attackMs: 1, holdMs: 3 }, target: { kind: 'node', node: 'Cone', property: 'scale' } }] },
      { view: { camera: { zoom: 2 } }, materials: [{ material: 'Skin', toon: { steps: 2, outline: { width: 0.01, blur: 1 } } }] },
    );
    const paths = validateManifest(m, null).map(errorPathOf);
    assert.deepStrictEqual(paths.sort(), ['audio.bindings[0].smoothing.holdMs', 'materials[0].toon.outline.blur', 'view.camera.zoom']);
  });

  test('keys set to undefined count as absent', () => {
    assert.deepStrictEqual(validateManifest({ ...base(), poster: undefined, view: undefined }, null), []);
  });

  test('names are 1..128 code points; ids follow the pattern', () => {
    const long = 'x'.repeat(129);
    const emoji = '😀'.repeat(128); // 256 UTF-16 units, 128 code points
    const m = (node: string, id: string) => base({ bindings: [{ id, source: 'bass', target: { kind: 'node', node, property: 'scale' } }] });
    assert.deepStrictEqual(validateManifest(m(emoji, 'ok_1'), null), []);
    assert.deepStrictEqual(validateManifest(m(long, 'bad id'), null).map(errorPathOf).sort(), ['audio.bindings[0].id', 'audio.bindings[0].target.node']);
  });

  test('integers, enums, ranges and colours', () => {
    const m = base(
      {
        idle: { clips: [{ clip: 'Fan', timeScale: 5 }] },
        noteClips: { initial: 'Idle', priority: 'loudest', rules: [{ match: { part: 'keys', note: 60.5 }, clip: 'Dance1', sync: 'half' }] },
        bindings: [{ sources: [{ source: 'bass', weight: 9 }], curve: 'bounce', inputRange: [0], target: { kind: 'material', material: 'Neon', property: 'color', colors: ['#fff', '#000000'] } }],
      },
      { view: { exposure: 9, lighting: 'disco' } },
    );
    assert.deepStrictEqual(validateManifest(m, null).map(errorPathOf).sort(), [
      'audio.bindings[0].curve',
      'audio.bindings[0].inputRange',
      'audio.bindings[0].sources[0].weight',
      'audio.bindings[0].target.colors[0]',
      'audio.idle.clips[0].timeScale',
      'audio.noteClips.priority',
      'audio.noteClips.rules[0].match.note',
      'audio.noteClips.rules[0].sync',
      'view.exposure',
      'view.lighting',
    ]);
  });

  test('limits drive the list sizes', () => {
    const bindings = Array.from({ length: 3 }, () => ({ source: 'bass', target: { kind: 'node', node: 'Cone', property: 'scale' } }));
    assert.deepStrictEqual(validateManifest(base({ bindings }), null), []);
    const errors = validateManifest(base({ bindings }), null, { limits: { ...DEFAULT_LIMITS, maxBindings: 2 } });
    assert.deepStrictEqual(errors.map(errorPathOf), ['audio.bindings']);
  });
});

describe('semantic rules', () => {
  test('node targets add up; other targets are unique', () => {
    const node = { kind: 'node', node: 'Cone', property: 'position' };
    assert.deepStrictEqual(validateManifest(base({ bindings: [{ source: 'bass', target: node }, { source: 'kick', target: node }] }), cases.summary), []);
    const cam = { kind: 'camera', property: 'dolly' };
    const errors = validateManifest(base({ bindings: [{ source: 'bass', target: cam }, { source: 'kick', target: cam }] }), cases.summary);
    assert.deepStrictEqual(errors.map(errorPathOf), ['audio.bindings[1].target']);
  });

  test('speed + weight combine on one clip; play and trigger stand alone', () => {
    const t = (mode: string) => ({ source: 'bass', target: { kind: 'clip', clip: 'Fan', mode } });
    assert.deepStrictEqual(validateManifest(base({ bindings: [t('speed'), t('weight')] }), cases.summary), []);
    assert.deepStrictEqual(validateManifest(base({ bindings: [t('play'), t('trigger')] }), cases.summary).map(errorPathOf), ['audio.bindings[1].target.mode']);
    assert.deepStrictEqual(validateManifest(base({ bindings: [t('speed'), t('speed')] }), cases.summary).map(errorPathOf), ['audio.bindings[1].target']);
  });

  test('a clip owned by idle cannot be bound; a rule may reuse the initial clip', () => {
    const errors = validateManifest(base({ idle: { clips: [{ clip: 'Fan' }] }, bindings: [{ source: 'bass', target: { kind: 'clip', clip: 'Fan', mode: 'weight' } }] }), cases.summary);
    assert.deepStrictEqual(errors.map(errorPathOf), ['audio.bindings[0].target.clip']);
    const ok = base({ noteClips: { initial: 'Idle', rules: [{ match: { part: 'drums', voice: 'kick' }, clip: 'Idle', mode: 'once' }] } });
    assert.deepStrictEqual(validateManifest(ok, cases.summary), []);
  });

  test('outputRange: within bounds, reversed allowed; morph index and threshold bounds', () => {
    const b = (outputRange: number[]) => base({ bindings: [{ source: 'bass', outputRange, target: { kind: 'camera', property: 'dolly' } }] });
    assert.deepStrictEqual(validateManifest(b([5, 0.2]), null), []);
    assert.deepStrictEqual(validateManifest(b([0.1, 1]), null).map(errorPathOf), ['audio.bindings[0].outputRange']);
    const m = base({ bindings: [{ source: 'bass', target: { kind: 'morph', mesh: 'Body', morph: 32 } }, { source: 'kick', target: { kind: 'clip', clip: 'Pump', mode: 'trigger', threshold: 0 } }] });
    assert.deepStrictEqual(validateManifest(m, null).map(errorPathOf), ['audio.bindings[0].target.morph', 'audio.bindings[1].target.threshold']);
  });

  test('slots range lo ≤ hi; drum voices unique', () => {
    const m = base({
      noteClips: {
        initial: 'Idle',
        rules: [
          { match: { part: 'sampler', slots: [9, 3] }, clip: 'Wave' },
          { match: { part: 'drums', voices: ['kick', 'kick'] }, clip: 'Pump' },
        ],
      },
    });
    assert.deepStrictEqual(validateManifest(m, null).map(errorPathOf), ['audio.noteClips.rules[0].match.slots', 'audio.noteClips.rules[1].match.voices[1]']);
  });

  test('names: ambiguous morph, unknown light node, camera on a light node', () => {
    const summary = { ...cases.summary, meshes: [{ name: 'Body', morphs: ['Smile', 'Smile'] }] };
    const m = base(
      { bindings: [{ source: 'bass', target: { kind: 'morph', mesh: 'Body', morph: 'Smile' } }, { source: 'mid', target: { kind: 'light', light: 'Nope', property: 'intensity' } }] },
      { view: { camera: { node: 'KeyLight' } } },
    );
    assert.deepStrictEqual(validateManifest(m, summary).map(errorPathOf), ['view.camera.node', 'audio.bindings[1].target.light', 'audio.bindings[0].target.morph']);
  });

  test('outlines count toward maxDrawCalls when stats are given', () => {
    const stats = { drawCalls: 100, materialDrawCalls: [20, 5, 10, 0, 0] } as unknown as SceneStats;
    const outlined = (materials: object[]) => validateManifest({ ...base(), materials }, cases.summary, { stats });
    assert.deepStrictEqual(outlined([{ material: 'Outfit', toon: { steps: 2, outline: { width: 0.01 } } }]), []); // 105
    assert.deepStrictEqual(outlined([{ material: 'Skin', toon: { steps: 2, outline: { width: 0.01 } } }, { material: 'Neon', toon: { steps: 2, outline: { width: 0.01 } } }]).map(errorPathOf), ['materials']); // 130
    // "*" outlines everything not named; a named override without outline opts out.
    assert.deepStrictEqual(outlined([{ material: '*', toon: { steps: 2, outline: { width: 0.01 } } }, { material: 'Skin', toon: { steps: 2 } }]), []); // 115
    assert.deepStrictEqual(outlined([{ material: '*', toon: { steps: 2, outline: { width: 0.01 } } }]).map(errorPathOf), ['materials']); // 135
    // Without stats or summary the check is skipped.
    assert.deepStrictEqual(validateManifest({ ...base(), materials: [{ material: '*', toon: { steps: 2, outline: { width: 0.01 } } }] }, cases.summary), []);
  });
});

describe('normalizeManifest', () => {
  test('fills every default', () => {
    const n = normalizeManifest(base());
    assert.deepStrictEqual(n, {
      scene: 's.glb',
      poster: null,
      view: { background: '#000000', lighting: 'studio', exposure: 1, camera: { node: null, fov: 40, distance: 1, elevation: 10, azimuth: 0, orbitSpeed: 0 } },
      materials: [],
      audio: { idle: [], bindings: [], noteClips: null },
    });
  });

  test('dancer example', () => {
    const dancer = cases.valid.find((c) => c.name === 'dancer example');
    assert.ok(dancer);
    const n = normalizeManifest(dancer.manifest);
    assert.deepStrictEqual(n.materials, [
      { material: 'Skin', steps: 3, outline: { width: 0.006, color: '#120A1E' } },
      { material: '*', steps: 2, outline: null },
    ]);
    assert.deepStrictEqual(n.audio.idle, [{ clip: 'Fan', timeScale: 0.5 }]);
    const nc = n.audio.noteClips;
    assert.ok(nc);
    assert.equal(nc.priority, 'velocity');
    assert.deepStrictEqual(nc.rules[0].match, { part: 'keys', lo: 48, hi: 59, voices: null });
    assert.deepStrictEqual(nc.rules[2].match, { part: 'sampler', lo: 15, hi: 15, voices: null });
    assert.deepStrictEqual(nc.rules[3].match, { part: 'drums', lo: -1, hi: -1, voices: [4, 7] });
    assert.deepStrictEqual(
      nc.rules.map((r) => [r.fadeMs, r.timeScale, r.clipBpm, r.sync]),
      [[250, 1, 120, 'beat'], [250, 1, 120, 'bar'], [120, 1, 0, 'now'], [250, 1, 0, 'now']],
    );
    const byId = (id: string) => n.audio.bindings.find((b) => b.id === id);
    const smile = byId('smile');
    assert.ok(smile);
    assert.deepStrictEqual(
      { sources: smile.sources, combine: smile.combine, inputRange: smile.inputRange, outputRange: smile.outputRange, curve: smile.curve, steps: smile.steps, attackMs: smile.attackMs, releaseMs: smile.releaseMs, invert: smile.invert, outputKey: smile.outputKey },
      { sources: [{ source: 'notePulse', weight: 1 }], combine: 'sum', inputRange: [0, 1], outputRange: [0, 1], curve: 'linear', steps: 4, attackMs: 0, releaseMs: 0, invert: false, outputKey: 'morph' },
    );
    assert.deepStrictEqual(byId('bass-glow')?.sources, [{ source: 'bass', weight: 0.7 }, { source: 'hit', weight: 0.5 }]);
    assert.deepStrictEqual(byId('hip-sway')?.target, { kind: 'node', node: 'Hips', property: 'rotation', axis: 'z' });
    assert.equal(byId('blink')?.steps, 2);
  });

  test('speaker example: clip targets, axis defaults, play/trigger outputs', () => {
    const speaker = cases.valid.find((c) => c.name === 'speaker example (clip targets)');
    assert.ok(speaker);
    const b = normalizeManifest(speaker.manifest).audio.bindings;
    assert.equal(b[0].id, 'binding-0');
    assert.deepStrictEqual(b[1].outputRange, DEFAULT_LIMITS.outputDefaults['clip.weight']);
    assert.deepStrictEqual(b[3].target, { kind: 'clip', clip: 'Pump', mode: 'trigger', threshold: 0.6, fadeMs: DEFAULT_CLIP_FADE_MS });
    assert.deepStrictEqual([b[3].outputRange, b[3].outputKey], [[0, 1], null]);
    assert.deepStrictEqual(b[4].target, { kind: 'clip', clip: 'Wave', mode: 'play', threshold: 0.3, fadeMs: 400 });
    assert.deepStrictEqual(b[5].target, { kind: 'material', material: 'Neon', property: 'color', colors: ['#FF2266', '#22CCFF'] });
    assert.equal(b[5].invert, true);
    assert.deepStrictEqual(b[6].target, { kind: 'node', node: 'Cone', property: 'position', axis: 'y' });
    assert.deepStrictEqual(b[6].outputRange, [0, 0.2]);
    assert.equal(normalizeManifest(speaker.manifest).view.camera.node, 'Cam');
  });

  test('throws on a structurally invalid manifest', () => {
    assert.throws(() => normalizeManifest({ format: 2 }), /invalid glTF visualizer manifest/);
  });

  test('outputKeyOf', () => {
    assert.equal(outputKeyOf({ kind: 'clip', mode: 'play' }), null);
    assert.equal(outputKeyOf({ kind: 'node', property: 'spin' }), 'node.spin');
    assert.equal(outputKeyOf({ kind: 'light', property: 'intensity' }), 'light.intensity');
  });
});
