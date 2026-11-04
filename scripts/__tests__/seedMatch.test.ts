import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PRODUCTS } from "../seed-spree-data";
import {
  collectAllPages,
  ExistingProduct,
  findExistingProduct,
  mergeTaxonIds,
  normalizeName
} from "../seedMatch";

const found = PRODUCTS.find((p) => p.slug === "beeper-8-reservation");
if (!found) throw new Error("seed data lost the reservation definition");
const reservationDef = found;

const p = (
  id: number,
  name: string,
  slug: string,
  sku = ""
): ExistingProduct => ({ id, name, slug, master: { sku } });

describe("findExistingProduct", () => {
  test("the 2026-08-07 case: same name, different slug is matched, not re-created", () => {
    // Product 34 as it was when the seed ran: hand-created in the admin, so
    // FriendlyId derived the slug from the name. Master SKU blank.
    const existing = [
      p(1, "Beeper Δ8", "beeper-8"),
      p(
        34,
        "Beeper Δ8 — Pre-Order Reservation",
        "beeper-8-pre-order-reservation"
      )
    ];
    const m = findExistingProduct(reservationDef, existing);
    assert.ok(m, "must match instead of creating");
    assert.equal(m.product.id, 34);
    assert.equal(m.by, "name");
    assert.match(m.warning || "", /not slug/);
  });

  test("exact slug wins, without a warning", () => {
    const existing = [
      p(
        67,
        "Beeper Δ8 — Pre-Order Reservation",
        "beeper-8-pre-order-reservation-512eb3fe"
      ),
      p(34, "Beeper Δ8 — Pre-Order Reservation", "beeper-8-reservation")
    ];
    const m = findExistingProduct(reservationDef, existing);
    assert.equal(m?.product.id, 34);
    assert.equal(m?.by, "slug");
    assert.equal(m?.warning, undefined);
  });

  test("master SKU match when slug and name both changed", () => {
    const existing = [
      p(2, "Carrying Case", "beeper-carrying-case"),
      p(90, "Reserve your Beeper", "reserve", "BEEPER-D8-RES")
    ];
    const m = findExistingProduct(reservationDef, existing);
    assert.equal(m?.product.id, 90);
    assert.equal(m?.by, "sku");
    assert.match(m?.warning || "", /SKU/);
  });

  test("SKU at the top level also counts", () => {
    const m = findExistingProduct({ name: "X", slug: "x", sku: "SKU-1" }, [
      { id: 5, name: "Other", slug: "other", sku: "SKU-1" }
    ]);
    assert.equal(m?.product.id, 5);
  });

  test("blank SKUs never match each other", () => {
    const m = findExistingProduct({ name: "New thing", slug: "new", sku: "" }, [
      p(1, "Something", "something", "")
    ]);
    assert.equal(m, null);
  });

  test("two products with the same name: lowest id, warning lists the other", () => {
    const existing = [
      p(
        67,
        "Beeper Δ8 — Pre-Order Reservation",
        "beeper-8-pre-order-reservation-512eb3fe"
      ),
      p(
        34,
        "Beeper Δ8 — Pre-Order Reservation",
        "beeper-8-pre-order-reservation"
      )
    ];
    const m = findExistingProduct(reservationDef, existing);
    assert.equal(m?.product.id, 34);
    assert.equal(m?.by, "name");
    assert.match(m?.warning || "", /2 products match/);
    assert.match(m?.warning || "", /67/);
  });

  test("name match ignores case, spacing and dash style", () => {
    const m = findExistingProduct(reservationDef, [
      p(34, "  beeper Δ8 - pre-order   RESERVATION ", "res")
    ]);
    assert.equal(m?.product.id, 34);
  });

  test("no match: null, so the seed creates it", () => {
    const m = findExistingProduct(reservationDef, [
      p(1, "Beeper Δ8", "beeper-8"),
      p(2, "Beeper Carrying Case", "beeper-carrying-case")
    ]);
    assert.equal(m, null);
    assert.equal(findExistingProduct(reservationDef, []), null);
  });

  test("normalizeName", () => {
    assert.equal(
      normalizeName("Beeper Δ8 — Pre-Order Reservation"),
      "beeper δ8 pre order reservation"
    );
    assert.equal(normalizeName(undefined), "");
  });
});

describe("collectAllPages", () => {
  const make = (total: number, reportPages: boolean) => {
    const calls: number[] = [];
    const fetchPage = async (page: number, perPage: number) => {
      calls.push(page);
      const start = (page - 1) * perPage;
      const items = Array.from(
        { length: Math.max(0, Math.min(perPage, total - start)) },
        (_, i) => start + i
      );
      return {
        products: items,
        ...(reportPages
          ? {
              pages: Math.max(1, Math.ceil(total / perPage)),
              current_page: page
            }
          : {})
      };
    };
    return { calls, fetchPage };
  };

  test("follows the reported page count", async () => {
    const { calls, fetchPage } = make(250, true);
    const all = await collectAllPages(fetchPage, 100);
    assert.equal(all.length, 250);
    assert.deepEqual(calls, [1, 2, 3]);
  });

  test("without a page count, stops on a short page", async () => {
    const { calls, fetchPage } = make(200, false);
    const all = await collectAllPages(fetchPage, 100);
    assert.equal(all.length, 200);
    assert.deepEqual(calls, [1, 2, 3]);
  });

  test("guards against servers that never end", async () => {
    let n = 0;
    const all = await collectAllPages(async () => ({ products: [n++] }), 1, 5);
    assert.equal(all.length, 5);
  });
});

describe("mergeTaxonIds", () => {
  test("adds missing taxons and keeps hand-added ones", () => {
    assert.deepEqual(mergeTaxonIds([40, 99], [40, 43]), [40, 99, 43]);
  });
  test("null when nothing is missing", () => {
    assert.equal(mergeTaxonIds([40, 43], [43]), null);
    assert.equal(mergeTaxonIds(undefined, []), null);
  });
});

describe("seed data", () => {
  test("the reservation is Featured and Pre-Order", () => {
    assert.deepEqual([...(reservationDef?.taxons || [])].sort(), [
      "Featured",
      "Pre-Order"
    ]);
  });
});
