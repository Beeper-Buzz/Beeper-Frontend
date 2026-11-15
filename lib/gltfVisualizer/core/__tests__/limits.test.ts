import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DEFAULT_LIMITS } from '../limits';
import { readJson } from './helpers';

test('DEFAULT_LIMITS equals visualizer-gltf.limits.json exactly', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(DEFAULT_LIMITS)), readJson('visualizer-gltf.limits.json'));
});

test('every output key has bounds and a default inside them', () => {
  const keys = Object.keys(DEFAULT_LIMITS.outputBounds);
  assert.deepStrictEqual(Object.keys(DEFAULT_LIMITS.outputDefaults).sort(), keys.slice().sort());
  for (const k of keys) {
    const b = DEFAULT_LIMITS.outputBounds[k as keyof typeof DEFAULT_LIMITS.outputBounds];
    const d = DEFAULT_LIMITS.outputDefaults[k as keyof typeof DEFAULT_LIMITS.outputDefaults];
    for (const v of d) assert.ok(v >= b[0] && v <= b[1], `${k} default ${d} within ${b}`);
  }
});
