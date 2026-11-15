// The JSON Schema agrees with the fixtures (ajv 8, draft-07). Kept apart because it needs ajv,
// which a repo may not have; it skips when no ajv 8 is found. Set AJV_PATH to point at one.
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'path';
import { manifestCases, readJson } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadAjv8(): any {
  const candidates: string[] = [];
  if (process.env.AJV_PATH) candidates.push(process.env.AJV_PATH);
  candidates.push('ajv');
  try {
    // The web worktree has ajv 6 at the top and ajv 8 under table/.
    candidates.push(path.join(path.dirname(require.resolve('table/package.json')), 'node_modules', 'ajv'));
  } catch (e) {
    // no table package
  }
  for (const c of candidates) {
    try {
      const version = require(path.join(c, 'package.json')).version as string;
      if (Number(version.split('.')[0]) >= 8) {
        const mod = require(c);
        return mod.default || mod;
      }
    } catch (e) {
      // try the next one
    }
  }
  return null;
}

const Ajv = loadAjv8();

test('ajv 8 accepts the valid and non-schemaOnly cases and rejects the schemaOnly ones', { skip: Ajv ? false : 'ajv 8 not found' }, () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(readJson('visualizer-gltf.schema.json'));
  const cases = manifestCases();
  for (const c of cases.valid) assert.equal(validate(c.manifest), true, `${c.name}: ${JSON.stringify(validate.errors)}`);
  for (const c of cases.invalid) {
    const ok = validate(c.manifest);
    if (c.schemaOnly) assert.equal(ok, false, `${c.name} should fail the schema`);
    else assert.equal(ok, true, `${c.name} should pass the schema (semantic case): ${JSON.stringify(validate.errors)}`);
  }
});
