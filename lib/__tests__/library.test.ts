import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { groupLibrary } from "../library";
import type { LibraryItem } from "../creator/types";

const item = (
  id: number,
  kind: LibraryItem["kind"],
  name: string,
  revoked_at: string | null = null,
  granted_at = "2026-11-01T00:00:00Z"
): LibraryItem => ({
  ownership_id: id,
  variant_id: id * 10,
  product: { id, slug: name.toLowerCase(), name, image_url: null, creator: null },
  kind,
  asset: { id, version: 1, byte_size: 10, manifest: {}, files: [] },
  source: "order",
  granted_at,
  revoked_at
});

describe("groupLibrary", () => {
  test("groups by kind in a fixed order and skips empty kinds", () => {
    const groups = groupLibrary([
      item(1, "visualizer", "Glow"),
      item(2, "sample_pack", "Drums")
    ]);
    assert.deepEqual(
      groups.map((g) => g.kind),
      ["sample_pack", "visualizer"]
    );
  });

  test("newest first within a kind, revoked items last", () => {
    const [g] = groupLibrary([
      item(1, "sample_pack", "Old", null, "2026-10-01T00:00:00Z"),
      item(2, "sample_pack", "Gone", "2026-11-10T00:00:00Z", "2026-11-09T00:00:00Z"),
      item(3, "sample_pack", "New", null, "2026-11-05T00:00:00Z")
    ]);
    assert.deepEqual(
      g.items.map((i) => i.product.name),
      ["New", "Old", "Gone"]
    );
  });

  test("ignores items of an unknown kind", () => {
    const groups = groupLibrary([
      { ...item(1, "sample_pack", "X"), kind: "synth" as never }
    ]);
    assert.deepEqual(groups, []);
  });
});
