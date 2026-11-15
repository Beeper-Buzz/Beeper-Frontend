import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { CreatorProduct } from "../creator/types";
import {
  draftFromProduct,
  draftManifest,
  draftToInput,
  DraftFile,
  emptyDraft,
  presetFile,
  sameManifest,
  stepErrors
} from "../creator/productDraft";

const product = (over: Partial<CreatorProduct> = {}): CreatorProduct => ({
  id: 7,
  slug: "dusty-drums",
  name: "Dusty Drums",
  description: "Kicks and snares",
  price: "9.99",
  currency: "USD",
  kind: "sample_pack",
  review_state: "approved",
  review_note: null,
  taxon_ids: [3],
  preview: { image_url: null, audio_url: null },
  asset: {
    id: 1,
    version: 2,
    status: "published",
    manifest: {
      format: 1,
      pack_id: "dusty-drums",
      samples: [
        {
          file: "kick.wav",
          name: "Kick",
          root_note: 36,
          one_shot: true,
          gain_db: -3,
          pad: 1
        }
      ]
    },
    files: [
      {
        id: 11,
        filename: "kick.wav",
        byte_size: 1000,
        content_type: "audio/wav"
      }
    ]
  },
  live_asset_version: 2,
  sales_count: 4,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-02T00:00:00Z",
  ...over
});

const existing = (id: number, name: string): DraftFile => ({
  key: `e${id}`,
  name,
  size: 1000,
  status: "done",
  existingId: id
});
const uploaded = (name: string, signedId: string): DraftFile => ({
  key: name,
  name,
  size: 10,
  status: "done",
  signedId
});

describe("draftFromProduct", () => {
  test("restores details and the sample settings by file", () => {
    const d = draftFromProduct(product());
    assert.equal(d.kind, "sample_pack");
    assert.equal(d.name, "Dusty Drums");
    assert.equal(d.price, "9.99");
    assert.deepEqual(d.taxonIds, [3]);
    assert.equal(d.packId, "dusty-drums");
    assert.equal(d.samples["kick.wav"].root_note, 36);
    assert.equal(d.samples["kick.wav"].pad, 1);
  });
});

describe("draftToInput", () => {
  test("leaves files out when the asset's files are unchanged", () => {
    const d = draftFromProduct(product());
    const input = draftToInput(d, [existing(11, "kick.wav")], {
      originalFileIds: [11]
    });
    assert.equal("files" in input, false);
    assert.equal(input.price, 9.99);
    assert.equal(input.manifest?.samples[0].file, "kick.wav");
  });

  test("sends new signed ids plus the kept existing files when they change", () => {
    const d = draftFromProduct(product());
    const input = draftToInput(
      d,
      [existing(11, "kick.wav"), uploaded("snare.wav", "sig-2")],
      { originalFileIds: [11] }
    );
    assert.deepEqual(input.files, ["sig-2"]);
    assert.deepEqual(input.keep_file_ids, [11]);
    assert.deepEqual(
      input.manifest?.samples.map((s: { file: string }) => s.file),
      ["kick.wav", "snare.wav"]
    );
  });

  test("a new product always sends its files", () => {
    const d = {
      ...emptyDraft(),
      kind: "visualizer" as const,
      name: "Glow",
      price: "0"
    };
    const input = draftToInput(d, [uploaded("glow.glsl", "sig-g")], {
      originalFileIds: null
    });
    assert.deepEqual(input.files, ["sig-g"]);
    assert.equal(input.manifest?.shader, "glow.glsl");
  });
});

describe("draftManifest", () => {
  test("visualizer picks the only .glsl file as its shader", () => {
    const d = { ...emptyDraft(), kind: "visualizer" as const };
    const { manifest } = draftManifest(d, [uploaded("a.glsl", "s")]);
    assert.equal(manifest.shader, "a.glsl");
  });

  test("sample pack ignores non-audio files with an error", () => {
    const d = { ...emptyDraft(), kind: "sample_pack" as const };
    const { errors } = draftManifest(d, [uploaded("cover.png", "s")]);
    assert.ok(
      errors.some((e) => /cover\.png/.test(e)),
      errors.join()
    );
  });
});

describe("stepErrors", () => {
  test("details need a name and a price of at least 0.50", () => {
    const d = {
      ...emptyDraft(),
      kind: "sample_pack" as const,
      name: " ",
      price: "-1"
    };
    const e = stepErrors(d, []);
    assert.ok(e.details.includes("Name the product."));
    assert.ok(e.details.includes("Price must be at least $0.50."));
    const free = stepErrors({ ...d, name: "x", price: "0" }, []);
    assert.ok(free.details.includes("Price must be at least $0.50."));
    assert.deepEqual(
      stepErrors({ ...d, name: "x", price: "0.5" }, []).details,
      []
    );
    assert.deepEqual(e.kind, []);
  });

  test("files can't be submitted while uploading", () => {
    const d = { ...emptyDraft(), kind: "effect_preset" as const };
    const e = stepErrors(d, [
      { ...uploaded("x.json", "s"), status: "uploading" }
    ]);
    assert.ok(e.files.includes("Wait for uploads to finish."));
  });

  test("an effect preset needs no files but needs an effect", () => {
    const d = { ...emptyDraft(), kind: "effect_preset" as const };
    assert.ok(stepErrors(d, []).files.includes("add at least one effect"));
  });
});

describe("effect preset file", () => {
  test("an effect preset sends its preset.json as the only file", () => {
    const d = {
      ...emptyDraft(),
      kind: "effect_preset" as const,
      name: "Wash",
      price: "1",
      effects: [{ id: "reverb", enabled: true, params: {} }]
    };
    const input = draftToInput(d, [], {
      originalFileIds: [5],
      presetSignedId: "sig-p"
    });
    assert.deepEqual(input.files, ["sig-p"]);
    assert.deepEqual(input.keep_file_ids, []);
  });

  test("without a new preset.json an effect preset leaves its files alone", () => {
    const d = { ...emptyDraft(), kind: "effect_preset" as const };
    const input = draftToInput(d, [], { originalFileIds: [5] });
    assert.equal("files" in input, false);
    assert.equal("keep_file_ids" in input, false);
  });

  test("presetFile is the manifest as JSON named preset.json", async () => {
    const f = presetFile({ format: 1, effects: [] });
    assert.equal(f.name, "preset.json");
    assert.equal(f.type, "application/json");
    assert.deepEqual(JSON.parse(await f.text()), { format: 1, effects: [] });
  });

  test("sameManifest ignores key order and the server's files key", () => {
    assert.equal(
      sameManifest(
        { format: 1, effects: [{ id: "a", params: { x: 1, y: 2 } }] },
        {
          effects: [{ params: { y: 2, x: 1 }, id: "a" }],
          format: 1,
          files: [{ id: 1 }]
        }
      ),
      true
    );
    assert.equal(sameManifest({ a: 1 }, { a: 2 }), false);
  });
});

describe("stepErrors in words", () => {
  test("sample problems name the file", () => {
    const d = {
      ...emptyDraft(),
      kind: "sample_pack" as const,
      samples: { "a.wav": { pad: 1 }, "b.wav": { pad: 1 } }
    };
    const e = stepErrors(d, [uploaded("a.wav", "s1"), uploaded("b.wav", "s2")]);
    assert.ok(
      e.files.includes("b.wav: Pad 1 is already used by a.wav."),
      e.files.join(" | ")
    );
    assert.ok(!e.files.some((m) => m.startsWith("samples[")));
  });

  test("shader rule errors block the files step, named by file", () => {
    const d = { ...emptyDraft(), kind: "visualizer" as const };
    const e = stepErrors(d, [uploaded("glow.glsl", "s")], {
      shaderErrors: ["uniform declarations not allowed"]
    });
    assert.ok(e.files.includes("glow.glsl: uniform declarations not allowed"));
  });
});

describe("draftToInput on a live product", () => {
  test("an update leaves kind and an unchanged manifest out", () => {
    const prod = product();
    const d = { ...draftFromProduct(prod), name: "Dustier Drums" };
    const input = draftToInput(d, [existing(11, "kick.wav")], {
      originalFileIds: [11],
      originalManifest: prod.asset?.manifest
    });
    assert.equal(input.name, "Dustier Drums");
    assert.equal("kind" in input, false);
    assert.equal("manifest" in input, false);
    assert.equal("files" in input, false);
  });

  test("a changed manifest is sent", () => {
    const prod = product();
    const d = draftFromProduct(prod);
    d.samples["kick.wav"] = { ...d.samples["kick.wav"], gain_db: -6 };
    const input = draftToInput(d, [existing(11, "kick.wav")], {
      originalFileIds: [11],
      originalManifest: prod.asset?.manifest
    });
    assert.equal(input.manifest?.samples[0].gain_db, -6);
  });

  test("a new product sends its kind and manifest", () => {
    const d = { ...emptyDraft(), kind: "visualizer" as const };
    const input = draftToInput(d, [uploaded("a.glsl", "s")], {
      originalFileIds: null
    });
    assert.equal(input.kind, "visualizer");
    assert.equal(input.manifest?.shader, "a.glsl");
  });
});
