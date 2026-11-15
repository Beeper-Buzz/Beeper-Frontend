import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  FROM_APP_KEY,
  FlagStorage,
  captureFromApp,
  digitalVariantIds,
  fromAppInUrl,
  isFromApp,
  libraryDeepLink,
  openInBeeperHref,
  orderOpenInBeeperHref
} from "../fromApp";

const memory = (): FlagStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    }
  };
};

const blocked: FlagStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  }
};

const line = (id: string, slug: string, variantId: string | null) => ({
  id,
  type: "line_item",
  attributes: { slug },
  relationships: { variant: { data: variantId ? { id: variantId } : null } }
});

const order = (...lines: ReturnType<typeof line>[]) => ({
  data: { id: "1", type: "order", attributes: {} },
  included: [
    ...lines,
    { id: "9", type: "variant", attributes: {} },
    { id: "3", type: "address", attributes: {} }
  ]
});

describe("fromAppInUrl", () => {
  test("finds from=app in a full URL or a path", () => {
    assert.equal(fromAppInUrl("https://beeper.buzz/nova-kit?from=app"), true);
    assert.equal(fromAppInUrl("/nova-kit?ref=nova&from=app"), true);
  });

  test("ignores other values and URLs without it", () => {
    assert.equal(fromAppInUrl("https://beeper.buzz/nova-kit"), false);
    assert.equal(fromAppInUrl("/nova-kit?from=web"), false);
    assert.equal(fromAppInUrl("/nova-kit?from="), false);
    assert.equal(fromAppInUrl("/nova-kit#from=app"), false);
  });
});

describe("captureFromApp / isFromApp", () => {
  test("stores the flag when the URL carries from=app", () => {
    const s = memory();
    assert.equal(captureFromApp("/nova-kit?from=app", s), true);
    assert.equal(s.data[FROM_APP_KEY], "1");
    assert.equal(isFromApp(s), true);
  });

  test("a later page without the parameter keeps the flag", () => {
    const s = memory();
    captureFromApp("/nova-kit?from=app", s);
    assert.equal(captureFromApp("/checkout", s), false);
    assert.equal(isFromApp(s), true);
  });

  test("no parameter, no flag", () => {
    const s = memory();
    assert.equal(captureFromApp("/nova-kit", s), false);
    assert.deepEqual(s.data, {});
    assert.equal(isFromApp(s), false);
  });

  test("blocked or missing storage is harmless", () => {
    assert.equal(captureFromApp("/nova-kit?from=app", blocked), false);
    assert.equal(isFromApp(blocked), false);
    assert.equal(captureFromApp("/nova-kit?from=app", null), false);
    assert.equal(isFromApp(null), false);
  });

  test("without a window (server render) it is never from the app", () => {
    assert.equal(captureFromApp("/nova-kit?from=app"), false);
    assert.equal(isFromApp(), false);
  });
});

describe("openInBeeperHref", () => {
  test("one item opens that item", () => {
    assert.equal(openInBeeperHref([42]), "beeper://library/42");
    assert.equal(openInBeeperHref(["42", 42]), "beeper://library/42");
    assert.equal(libraryDeepLink(42), "beeper://library/42");
  });

  test("several items open the Library", () => {
    assert.equal(openInBeeperHref([42, 43]), "beeper://library");
  });

  test("no item, no link", () => {
    assert.equal(openInBeeperHref([]), null);
    assert.equal(openInBeeperHref(["", "x1"]), null);
  });
});

describe("digitalVariantIds", () => {
  test("keeps the digital lines' variant ids in line order", () => {
    const o = order(
      line("1", "beeper-d8", "7"),
      line("2", "nova-kit", "42"),
      line("3", "neon-grid", "43")
    );
    assert.deepEqual(digitalVariantIds(o, ["neon-grid", "nova-kit"]), [
      "42",
      "43"
    ]);
  });

  test("nothing digital, unknown slugs or no included lines", () => {
    const o = order(line("1", "beeper-d8", "7"));
    assert.deepEqual(digitalVariantIds(o, ["nova-kit"]), []);
    assert.deepEqual(digitalVariantIds(o, undefined), []);
    assert.deepEqual(digitalVariantIds(o, []), []);
    assert.deepEqual(digitalVariantIds({ included: undefined }, ["x"]), []);
    assert.deepEqual(digitalVariantIds(null, ["x"]), []);
  });

  test("skips a line without a variant", () => {
    const o = order(line("1", "nova-kit", null));
    assert.deepEqual(digitalVariantIds(o, ["nova-kit"]), []);
  });
});

describe("orderOpenInBeeperHref (the confirmation page's button)", () => {
  const one = order(line("1", "beeper-d8", "7"), line("2", "nova-kit", "42"));
  const several = order(
    line("1", "nova-kit", "42"),
    line("2", "neon-grid", "43")
  );
  const digital = ["nova-kit", "neon-grid"];

  test("from the app: one digital item links to it", () => {
    assert.equal(
      orderOpenInBeeperHref(one, digital, true),
      "beeper://library/42"
    );
  });

  test("from the app: several digital items link to the Library", () => {
    assert.equal(
      orderOpenInBeeperHref(several, digital, true),
      "beeper://library"
    );
  });

  test("from the app: no digital item, or slugs still loading, shows nothing", () => {
    assert.equal(
      orderOpenInBeeperHref(order(line("1", "beeper-d8", "7")), digital, true),
      null
    );
    assert.equal(orderOpenInBeeperHref(one, undefined, true), null);
    assert.equal(orderOpenInBeeperHref(undefined, digital, true), null);
  });

  test("without the flag nothing shows", () => {
    assert.equal(orderOpenInBeeperHref(one, digital, false), null);
    assert.equal(orderOpenInBeeperHref(several, digital, false), null);
  });
});
