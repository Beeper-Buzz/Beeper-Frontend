import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { CreatorProduct } from "../creator/types";
import {
  draftFromProduct,
  draftManifest,
  draftToInput,
  DraftFile,
  emptyDraft,
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
    assert.equal(input.manifest.samples[0].file, "kick.wav");
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
      input.manifest.samples.map((s: { file: string }) => s.file),
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
    assert.equal(input.manifest.shader, "glow.glsl");
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
  test("details need a name and a price of 0 or more", () => {
    const d = {
      ...emptyDraft(),
      kind: "sample_pack" as const,
      name: " ",
      price: "-1"
    };
    const e = stepErrors(d, []);
    assert.ok(e.details.includes("Name the product."));
    assert.ok(e.details.includes("Price must be 0 or more."));
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
