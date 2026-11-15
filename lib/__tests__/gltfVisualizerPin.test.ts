// The glTF visualizer contract and core are copies of the workspace's
// specs/gltf-visualizer (spec §6.1). This pins them to its SHA256SUMS, hashed
// after CRLF → LF, so a change there fails here until it's copied in too.
// Layout: ts/* → lib/gltfVisualizer/core/*, the JSON files beside it.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// specs/gltf-visualizer/SHA256SUMS
const SHA256SUMS = `
7436002510df77494285dea9d993edd761289e65b47e3f2b0996ca070d207481  fixtures/manifest-cases.json
57d5289fbcd9c85bf62bddccdce5181d4230d1880c0c4f0c07a4785af8029d4e  ts/__tests__/bindings.test.ts
04bbd066e9e1cf810b53622641c66d031d826a5df64bc2ab82e9c7c813f48ec0  ts/__tests__/glb.test.ts
959875acf3481adc091f0e26ad4e674a99ab844f77b70839dba9174654405f49  ts/__tests__/helpers.ts
6d8e87ee7f9e6ef8a67c895681ccdc2ef5f5195d5463d4018c0f11a055d78545  ts/__tests__/limits.test.ts
5763f71642881e54d379f7ca4b0ee7deafbd4c6d621daea5f8fd064e8af7016c  ts/__tests__/manifest.test.ts
696430e63b2308a3bf05f6a405fe9ce5a8d38c45b874f02eed233909ff49955a  ts/__tests__/noteClips.test.ts
e742eeea897207e66f177356dde2241490a0f5a597e96741a9f9ce9b5078b5f3  ts/__tests__/rig.test.ts
1e4254104423c4c6f76cf2aeb74f12054a467cd3b0806f1dc94eb02126b051c4  ts/__tests__/scenes.ts
1ea3f2fe50a160b0eb85745770eccc2e92c4886590ad842f6593f9646eb8e10d  ts/__tests__/schema.ajv.test.ts
63c172de2a2b13753b3a5920096a326a33cc12cdff931feaed4723c7e52f6d23  ts/bindings.ts
f9382308c99ca0f1077081037d1540b780e1ea10f710e0d99496e6b91b6cfb4a  ts/glb.ts
3c4af5bc086b45f3b1169a70bdd9e30578785c4508ed227ce47f89a5bb49db58  ts/index.ts
f84353ea37ce6e15201497a390b814691b117602fab328aa24991a1a14c7219e  ts/limits.ts
cee29ce921aaa45dbbe65c37d9ba5dd260bf82d9f6253a08f8ea97cd02bfcbe9  ts/manifest.ts
cbc99ec3b3210367278669c794d53ab26fa89563a1fdc70f2c341eda5d2a4bd0  ts/noteClips.ts
8c308bcc069326cc5c2a05501147f6170e0947d72a69bc6d99b447c3a0c85e7c  ts/rig.ts
a07af231bf34dde6b9dd1b0d0a83143d36285fed2a22a794ce4f284eae58a770  ts/testGlb.ts
35c65107d8e5e9aa0752c74e675d35a7d4a4e415ca9ab1e9edbadaf5d44ece3c  visualizer-gltf.limits.json
bb74f9b1be6d5815bee111a96251aabe4892d467acd8a24578efea75caf66dbd  visualizer-gltf.schema.json
`;

const ROOT = join(__dirname, "..", "gltfVisualizer");
const local = (specPath: string) =>
  join(
    ROOT,
    specPath.startsWith("ts/") ? `core/${specPath.slice(3)}` : specPath
  );

const entries = SHA256SUMS.trim()
  .split("\n")
  .map((line) => {
    const [hash, path] = line.trim().split(/\s+/);
    return { hash, path };
  });

test("the glTF visualizer core and contract match specs/gltf-visualizer/SHA256SUMS", () => {
  assert.equal(entries.length, 20);
  for (const { hash, path } of entries) {
    const text = readFileSync(local(path), "utf8").replace(/\r\n/g, "\n");
    const actual = createHash("sha256").update(text, "utf8").digest("hex");
    assert.equal(
      actual,
      hash,
      `${path} differs from the spec copy; copy it again`
    );
  }
});
