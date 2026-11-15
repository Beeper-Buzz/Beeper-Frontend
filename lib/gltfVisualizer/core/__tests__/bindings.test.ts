import { describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { SOURCES, SOURCE_COUNT, SOURCE_INDEX, combine, compileBindings, createSourceBuffer, curve, follow, rearmLevel } from '../bindings';
import { BindingConfig, SOURCE_NAMES, normalizeManifest } from '../manifest';
import { readJson } from './helpers';

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

function compile(bindings: object[]) {
  const n = normalizeManifest({ format: 1, type: 'gltf', scene: 's.glb', audio: { schemaVersion: 1, bindings: bindings as BindingConfig[] } });
  return compileBindings(n);
}

describe('sources', () => {
  test('20 sources in schema order', () => {
    const schemaOrder = readJson('visualizer-gltf.schema.json').definitions.source.enum;
    assert.deepStrictEqual(SOURCE_NAMES.slice(), schemaOrder);
    assert.deepStrictEqual(SOURCES.map((s) => s.name), schemaOrder);
    assert.equal(SOURCE_COUNT, 20);
    schemaOrder.forEach((name: keyof typeof SOURCE_INDEX, i: number) => assert.equal(SOURCE_INDEX[name], i));
    assert.equal(createSourceBuffer().length, 20);
  });

  test('studio input suggestions', () => {
    const by = (n: string) => SOURCES.find((s) => s.name === n);
    assert.deepStrictEqual(by('bpm')?.suggestedInputRange, [60, 180]);
    assert.deepStrictEqual(by('note')?.suggestedInputRange, [36, 84]);
    assert.deepStrictEqual(by('noteHz')?.suggestedInputRange, [65, 1047]);
  });
});

describe('curves', () => {
  test('values at 0, 0.5, 1', () => {
    const at = (name: Parameters<typeof curve>[0]) => [0, 0.5, 1].map((t) => curve(name, t));
    assert.deepStrictEqual(at('linear'), [0, 0.5, 1]);
    assert.deepStrictEqual(at('easeIn'), [0, 0.25, 1]);
    assert.deepStrictEqual(at('easeOut'), [0, 0.75, 1]);
    assert.deepStrictEqual(at('easeInOut'), [0, 0.5, 1]);
    const e = at('exp');
    close(e[0], 0);
    close(e[1], (Math.exp(2) - 1) / (Math.exp(4) - 1));
    close(e[2], 1);
    assert.deepStrictEqual(at('step'), [0, 2 / 3, 1]);
    close(curve('easeInOut', 0.25), 0.125);
    close(curve('easeInOut', 0.75), 0.875);
  });

  test('step edges', () => {
    assert.equal(curve('step', 0.2499, 4), 0);
    assert.equal(curve('step', 0.25, 4), 1 / 3);
    assert.equal(curve('step', 0.9999, 4), 1);
    assert.equal(curve('step', 0.4999, 2), 0);
    assert.equal(curve('step', 0.5, 2), 1);
    assert.equal(curve('step', 1, 16), 1);
  });
});

describe('follow', () => {
  test('0 ms is instant both ways', () => {
    assert.equal(follow(0, 1, 0.016, 0, 0), 1);
    assert.equal(follow(1, 0, 0.016, 0, 0), 0);
    assert.equal(follow(0, 1, 0, 0, 100), 1);
  });
  test('attack when rising, release when falling: exp(−dt/τ)', () => {
    close(follow(0, 1, 0.1, 100, 1000), 1 - Math.exp(-1));
    close(follow(1, 0, 0.1, 100, 1000), Math.exp(-0.1));
    assert.equal(follow(0.3, 1, 0, 100, 100), 0.3);
  });
});

describe('combine', () => {
  const v = [0.5, 1, 0.25];
  const w = [1, -0.5, 2];
  test('sum, max, avg, mul', () => {
    close(combine('sum', v, w), 0.5 - 0.5 + 0.5);
    close(combine('max', v, w), 0.5);
    close(combine('avg', v, w), 0.5 / 3.5);
    close(combine('mul', v, w), 0.5 * -0.5 * 0.5);
    assert.equal(combine('avg', [1, 1], [0, 0]), 0);
    assert.equal(combine('max', [], []), 0);
    close(combine('sum', v, w, 1), 0.5);
  });
});

describe('compiled evaluator', () => {
  const sources = createSourceBuffer();
  const set = (name: keyof typeof SOURCE_INDEX, value: number) => (sources[SOURCE_INDEX[name]] = value);

  test('outputs, invert, reversed inputRange, curves, combine', () => {
    const c = compile([
      { source: 'bass', outputRange: [1, 1.25], target: { kind: 'node', node: 'Cone', property: 'scale' } },
      { source: 'bass', invert: true, target: { kind: 'morph', mesh: 'Body', morph: 0 } },
      { source: 'bpm', inputRange: [180, 60], outputRange: [0, 2], target: { kind: 'clip', clip: 'Fan', mode: 'speed' } },
      { source: 'note', inputRange: [36, 84], curve: 'step', steps: 2, target: { kind: 'material', material: 'Neon', property: 'opacity' } },
      { sources: [{ source: 'kick', weight: 0.5 }, { source: 'snare' }], combine: 'max', target: { kind: 'light', light: 'KeyLight', property: 'intensity' } },
      { source: 'level', target: { kind: 'camera', property: 'dolly' } },
    ]);
    const out = new Float32Array(c.count);
    set('bass', 0.5);
    set('bpm', 150);
    set('note', 72);
    set('kick', 1);
    set('snare', 0.2);
    set('level', 2); // clamped to t = 1
    c.evaluate(sources, 0.016, out);
    close(out[0], 1.125);
    close(out[1], 0.5);
    close(out[2], 0.5); // t = (150 − 180) / (60 − 180) = 0.25
    close(out[3], 1); // t = 0.75 → step(2) = 1
    close(out[4], 0.5 + (2 - 0.5) * 0.5); // default light range [0.5, 2], t = max(0.5, 0.2)
    close(out[5], 0.8); // dolly default [1, 0.8], t = 1
    set('note', -1);
    c.evaluate(sources, 0.016, out);
    close(out[3], 0); // no note → below the range
  });

  test('smoothing in the evaluator', () => {
    const c = compile([{ source: 'kick', smoothing: { attackMs: 0, releaseMs: 100 }, target: { kind: 'morph', mesh: 'Body', morph: 0 } }]);
    const out = new Float32Array(1);
    set('kick', 1);
    c.evaluate(sources, 0.016, out);
    close(out[0], 1);
    set('kick', 0);
    c.evaluate(sources, 0.1, out);
    close(out[0], Math.exp(-1));
    c.reset();
    assert.equal(c.t[0], 0);
  });

  test('trigger: fires on the rising edge, re-arms below threshold − 0.1', () => {
    const c = compile([{ source: 'drums', target: { kind: 'clip', clip: 'Pump', mode: 'trigger', threshold: 0.6 } }]);
    const out = new Float32Array(1);
    const step = (v: number) => {
      set('drums', v);
      c.evaluate(sources, 0.016, out);
      return c.fired[0];
    };
    assert.deepStrictEqual([0.2, 0.7, 0.9, 0.55, 0.65, 0.49, 0.61, 0.61].map(step), [0, 1, 0, 0, 0, 0, 1, 0]);
  });

  test('play: on at threshold, off below threshold − 0.1', () => {
    const c = compile([{ source: 'synth', target: { kind: 'clip', clip: 'Wave', mode: 'play', threshold: 0.3 } }]);
    const out = new Float32Array(1);
    const step = (v: number) => {
      set('synth', v);
      c.evaluate(sources, 0.016, out);
      return c.active[0];
    };
    assert.deepStrictEqual([0.1, 0.3, 0.25, 0.21, 0.19, 0.29, 0.31].map(step), [0, 1, 1, 1, 0, 0, 1]);
  });

  test('re-arm level for thresholds ≤ 0.1 falls back to half the threshold', () => {
    close(rearmLevel(0.5), 0.4);
    close(rearmLevel(0.1), 0.05);
    close(rearmLevel(0.05), 0.025);
  });
});
