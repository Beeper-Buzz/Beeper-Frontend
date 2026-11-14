import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  cartHasDigital,
  cartNeedsDelivery,
  isDigitalRequiresAccountError,
  loginRedirectFor
} from "../digitalCheckout";
import {
  creatorOf,
  digitalKindOf,
  formatBytes,
  kindLabel
} from "../marketplace";

const cart = (slugs: string[], attrs: Record<string, unknown> = {}) => ({
  data: { attributes: attrs },
  included: slugs.map((slug, i) => ({
    id: String(i + 1),
    type: "line_item",
    attributes: { slug }
  }))
});

describe("cartNeedsDelivery", () => {
  test("the order's checkout steps decide when the API sends them", () => {
    assert.equal(
      cartNeedsDelivery(
        cart(["tee"], {
          checkout_steps: ["address", "payment", "confirm", "complete"]
        }),
        []
      ),
      false
    );
    assert.equal(
      cartNeedsDelivery(
        cart(["pack"], {
          checkout_steps: ["address", "delivery", "payment", "complete"]
        }),
        ["pack"]
      ),
      true
    );
  });

  test("without steps, a cart of only digital products needs no delivery", () => {
    assert.equal(
      cartNeedsDelivery(cart(["pack", "viz"]), ["pack", "viz"]),
      false
    );
  });

  test("one physical line keeps delivery", () => {
    assert.equal(cartNeedsDelivery(cart(["pack", "tee"]), ["pack"]), true);
  });

  test("unknown answers keep delivery (the safe default)", () => {
    assert.equal(cartNeedsDelivery(cart(["pack"]), undefined), true);
    assert.equal(cartNeedsDelivery(cart([]), []), true);
    assert.equal(cartNeedsDelivery(null, ["pack"]), true);
  });

  test("cartHasDigital", () => {
    assert.equal(cartHasDigital(cart(["pack", "tee"]), ["pack"]), true);
    assert.equal(cartHasDigital(cart(["tee"]), ["pack"]), false);
    assert.equal(cartHasDigital(cart(["tee"]), undefined), false);
  });
});

describe("isDigitalRequiresAccountError", () => {
  test("spots the code in an SDK error summary, body or message", () => {
    assert.equal(
      isDigitalRequiresAccountError({ summary: "digital_requires_account" }),
      true
    );
    assert.equal(
      isDigitalRequiresAccountError({
        serverResponse: {
          status: 422,
          data: { error: "digital_requires_account" }
        }
      }),
      true
    );
    assert.equal(
      isDigitalRequiresAccountError(new Error("digital_requires_account")),
      true
    );
    assert.equal(
      isDigitalRequiresAccountError({
        code: "digital_requires_account"
      }),
      true
    );
  });

  test("other errors are not it", () => {
    assert.equal(
      isDigitalRequiresAccountError(new Error("Insufficient stock")),
      false
    );
    assert.equal(isDigitalRequiresAccountError(null), false);
  });

  test("loginRedirectFor sends guests back to checkout", () => {
    assert.equal(loginRedirectFor("/checkout"), "/login?redirect=%2Fcheckout");
  });
});

describe("marketplace product attributes", () => {
  const product = (attributes: Record<string, unknown>) => ({ attributes });

  test("reads digital_kind and creator", () => {
    const p = product({
      digital_kind: "sample_pack",
      creator: { handle: "nova", name: "Nova" }
    });
    assert.equal(digitalKindOf(p), "sample_pack");
    assert.deepEqual(creatorOf(p), { handle: "nova", name: "Nova" });
  });

  test("ordinary products have neither", () => {
    assert.equal(digitalKindOf(product({})), null);
    assert.equal(digitalKindOf(product({ digital_kind: "toaster" })), null);
    assert.equal(creatorOf(product({ creator: null })), null);
    assert.equal(creatorOf(product({ creator: { name: "x" } })), null);
  });

  test("labels and sizes", () => {
    assert.equal(kindLabel("effect_preset"), "Effect preset");
    assert.equal(formatBytes(0), "0 B");
    assert.equal(formatBytes(1536), "1.5 KB");
    assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
  });
});
