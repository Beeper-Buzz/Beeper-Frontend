/*
 * Shared test helpers (node:test + node:assert only, so each repo can run or wrap the suites).
 *
 * Running here (no package.json; the web worktree's toolchain via NODE_PATH):
 *   cd specs/gltf-visualizer/ts
 *   NM=../../../_wt/bf-creators/node_modules
 *   NODE_PATH=$NM TS_NODE_PROJECT=tsconfig.json TS_NODE_TRANSPILE_ONLY=1 \
 *     node --no-experimental-strip-types --test -r $NM/ts-node/register __tests__/*.test.ts
 * (--no-experimental-strip-types: Node ≥ 23 would otherwise strip .ts itself instead of ts-node.)
 *
 * GLTFLoader under CommonJS: three ships it as ESM (three/examples/jsm), while the core compiled
 * to CommonJS resolves `three` to build/three.cjs. Importing the loader natively (import() or
 * Node's require(esm)) would bring in a second copy of three (three.module.js), so the rig's
 * instanceof-free code would still work but the constructor spies of the no-allocation test
 * would watch the wrong module. installJsmHook() instead transpiles three/examples/jsm/*.js to
 * CommonJS with the TypeScript compiler as they are required, so the loader, the rig and the
 * tests share one three.cjs. Under Jest (the app) babel-jest does the same through
 * transformIgnorePatterns; in the web (webpack/Next) there is a single ESM three anyway.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { GltfLike } from '../rig';
import type { SceneSummary } from '../glb';

/** specs/gltf-visualizer */
export const SPEC_DIR = path.resolve(__dirname, '..', '..');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readJson(rel: string): any {
  return JSON.parse(fs.readFileSync(path.join(SPEC_DIR, rel), 'utf8'));
}

export interface ManifestCase {
  name: string;
  manifest: unknown;
  errorPath?: string;
  schemaOnly?: boolean;
}

export interface ManifestCases {
  summary: SceneSummary;
  valid: ManifestCase[];
  invalid: ManifestCase[];
}

export function manifestCases(): ManifestCases {
  return readJson('fixtures/manifest-cases.json');
}

/** The path of an error string: the text before the first ': '. */
export function errorPathOf(error: string): string {
  const i = error.indexOf(': ');
  return i < 0 ? error : error.slice(0, i);
}

/** True when an error's path equals `expected` or extends it with '.' or '['. */
export function pathMatches(error: string, expected: string): boolean {
  const p = errorPathOf(error);
  return p === expected || p.startsWith(`${expected}.`) || p.startsWith(`${expected}[`);
}

let hooked = false;

export function installJsmHook(): void {
  if (hooked) return;
  hooked = true;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Module = require('module');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ts = require('typescript');
  const previous = Module._extensions['.js'];
  Module._extensions['.js'] = function (mod: { _compile(code: string, file: string): void }, filename: string): void {
    if (/[\\/]three[\\/]examples[\\/]jsm[\\/]/.test(filename)) {
      const source = fs.readFileSync(filename, 'utf8');
      const out = ts.transpileModule(source, {
        fileName: filename,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
      }).outputText;
      mod._compile(out, filename);
      return;
    }
    previous(mod, filename);
  };
}

/** Parses GLB bytes with three's GLTFLoader (no textures: images unreferenced by materials aren't decoded). */
export function parseGlb(bytes: Uint8Array): Promise<GltfLike> {
  installJsmHook();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(copy.buffer, '', resolve, reject);
  });
}
