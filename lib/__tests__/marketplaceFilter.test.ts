import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { filterMarketplace } from "../marketplace";

const p = (
  id: string,
  name: string,
  price: string,
  kind: string | null,
  creator: { handle: string; name: string } | null = null,
  created_at = "2026-11-01T00:00:00Z"
) => ({
  id,
  attributes: { name, slug: id, price, digital_kind: kind, creator, created_at }
});

const items = [
  p("a", "Dusty Drums", "9.99", "sample_pack", { handle: "kai", name: "Kai" }),
  p("b", "Tape Echo", "2.00", "effect_preset", null, "2026-11-05T00:00:00Z"),
  p("c", "Glow Grid", "0", "visualizer", { handle: "mo", name: "Mo Lin" }),
  p("d", "Mystery", "1.00", null)
];

const names = (xs: { attributes?: Record<string, any> }[]) =>
  xs.map((x) => x.attributes?.name);

describe("filterMarketplace", () => {
  test("keeps only products with a known digital kind", () => {
    const out = filterMarketplace(items, {
      kinds: [],
      search: "",
      sort: "name_asc"
    });
    assert.deepEqual(names(out), ["Dusty Drums", "Glow Grid", "Tape Echo"]);
  });

  test("kind chips narrow to the chosen kinds", () => {
    const out = filterMarketplace(items, {
      kinds: ["visualizer", "effect_preset"],
      search: "",
      sort: "name_asc"
    });
    assert.deepEqual(names(out), ["Glow Grid", "Tape Echo"]);
  });

  test("search matches the creator's name as well as the product", () => {
    const out = filterMarketplace(items, {
      kinds: [],
      search: "mo l",
      sort: "name_asc"
    });
    assert.deepEqual(names(out), ["Glow Grid"]);
  });

  test("sorts by price and by newest", () => {
    assert.deepEqual(
      names(
        filterMarketplace(items, { kinds: [], search: "", sort: "price_asc" })
      ),
      ["Glow Grid", "Tape Echo", "Dusty Drums"]
    );
    assert.deepEqual(
      names(
        filterMarketplace(items, { kinds: [], search: "", sort: "newest" })
      )[0],
      "Tape Echo"
    );
  });
});
