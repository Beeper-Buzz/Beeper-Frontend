import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RESERVED_SLUGS,
  isRoutableSlug,
  lookupProduct,
  resolveSlug
} from "../slugRoute";

type Reply = { status: number; body?: unknown } | "hang" | "throw" | "garbage";

const BASE = "https://api.test";

const productDoc = (slug: string, available?: boolean): Reply => ({
  status: 200,
  body: { data: { id: "1", attributes: { slug, name: "Name", available } } }
});
const missing: Reply = { status: 404, body: { error: "not found" } };
// The real endpoint answers HTTP 200 with response_code 404 in the body.
const notAProfile: Reply = {
  status: 200,
  body: { response_code: 404, response_message: "User not found" }
};
const aProfile: Reply = {
  status: 200,
  body: {
    response_code: 200,
    response_data: {
      id: 7,
      display_name: "Beep",
      email: "private@example.com",
      first_name: "Private"
    }
  }
};

// Answers by URL shape; records what was asked.
const fakeFetch = (product: Reply, profile: Reply = notAProfile) => {
  const urls: string[] = [];
  const impl = (url: string, init?: { signal?: AbortSignal }) => {
    urls.push(url);
    const reply = url.includes("/by_handle/") ? profile : product;
    if (reply === "throw") return Promise.reject(new Error("ECONNREFUSED"));
    if (reply === "hang") {
      return new Promise<never>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted"))
        );
      });
    }
    if (reply === "garbage") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("<html>"))
      });
    }
    return Promise.resolve({
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: () => Promise.resolve(reply.body)
    });
  };
  return { impl, urls };
};

const resolve = async (slug: string, product: Reply, profile?: Reply) => {
  const f = fakeFetch(product, profile);
  const result = await resolveSlug(slug, {
    baseUrl: BASE,
    fetchImpl: f.impl,
    timeoutMs: 20
  });
  return { result, urls: f.urls };
};

describe("resolveSlug: products", () => {
  it("a visible product is a product, with no product data carried along", async () => {
    const { result, urls } = await resolve("case", productDoc("case", true));
    assert.deepEqual(result, { kind: "product" });
    assert.equal(urls.length, 1);
  });

  it("asks for the one product by slug, never the ignored filter[slug]", async () => {
    // Spree 4.2 ignores filter[slug] and returns the whole catalog, which made
    // every slug look like a product and hid every profile.
    const { urls } = await resolve("case", productDoc("case", true));
    assert.equal(urls[0], `${BASE}/api/v2/storefront/products/case`);
  });

  it("treats a payload without `available` as visible", async () => {
    const { result } = await resolve("case", productDoc("case"));
    assert.deepEqual(result, { kind: "product" });
  });

  it("hidden product (200 with available: false) is not found", async () => {
    const { result } = await resolve("hidden", productDoc("hidden", false));
    assert.deepEqual(result, { kind: "not-found" });
  });

  it("hidden product (backend answers 404) is not found", async () => {
    const { result } = await resolve("hidden", missing);
    assert.deepEqual(result, { kind: "not-found" });
  });

  it("unknown slug is not found (HTTP 404 from both)", async () => {
    const { result } = await resolve("nope", missing, { status: 404 });
    assert.deepEqual(result, { kind: "not-found" });
  });

  it("a numeric id that resolves to another slug is not a product page", async () => {
    // The API also finds by id: /api/v2/storefront/products/2 returns a product.
    const { result } = await resolve("2", productDoc("carrying-case", true));
    assert.deepEqual(result, { kind: "not-found" });
  });
});

describe("resolveSlug: profiles", () => {
  it("a handle with no product is a profile, and carries none of its data", async () => {
    const { result, urls } = await resolve("beeper", missing, aProfile);
    // The page's props go into __NEXT_DATA__; the client fetches the profile itself.
    assert.deepEqual(result, { kind: "profile" });
    assert.ok(urls[1].endsWith("/api/v1/users/by_handle/beeper/profile"));
  });

  it("lowercases the handle", async () => {
    const { urls } = await resolve("Beeper", missing, aProfile);
    assert.ok(urls[1].endsWith("/by_handle/beeper/profile"));
  });

  it("a visible product wins over a handle and skips the profile lookup", async () => {
    const { result, urls } = await resolve(
      "both",
      productDoc("both", true),
      aProfile
    );
    assert.deepEqual(result, { kind: "product" });
    assert.equal(urls.length, 1);
  });

  it("a hidden product's slug can still be someone's handle", async () => {
    const { result } = await resolve(
      "both",
      productDoc("both", false),
      aProfile
    );
    assert.equal(result.kind, "profile");
  });
});

describe("resolveSlug: API failures are never a 404 and never a product", () => {
  const cases: [string, Reply, Reply][] = [
    ["product 500, profile says no", { status: 500 }, notAProfile],
    ["product 503, profile 404", { status: 503 }, { status: 404 }],
    ["product 429, profile says no", { status: 429 }, notAProfile],
    ["product timeout", "hang", notAProfile],
    ["product connection refused", "throw", notAProfile],
    ["product not JSON", "garbage", notAProfile],
    ["product 404, profile 500", missing, { status: 500 }],
    ["product 404, profile timeout", missing, "hang"],
    ["product 404, profile throws", missing, "throw"],
    ["product 404, profile not JSON", missing, "garbage"],
    [
      "product 404, profile body says 500",
      missing,
      { status: 200, body: { response_code: 500 } }
    ],
    ["hidden, profile 500", productDoc("x", false), { status: 500 }],
    ["both down", { status: 500 }, { status: 500 }]
  ];
  for (const [name, product, profile] of cases) {
    it(name, async () => {
      const { result } = await resolve("x", product, profile);
      assert.deepEqual(result, { kind: "unavailable" });
    });
  }

  it("a profile still resolves while the product API is failing", async () => {
    const { result } = await resolve("beeper", { status: 500 }, aProfile);
    assert.equal(result.kind, "profile");
  });
});

describe("resolveSlug: without asking the backend", () => {
  const offline = async (slug: string) => {
    const { result, urls } = await resolve(slug, "throw", "throw");
    assert.equal(urls.length, 0, `${slug} should not reach the API`);
    return result;
  };

  it("reserved slugs are not found", async () => {
    for (const slug of RESERVED_SLUGS) {
      assert.deepEqual(await offline(slug), { kind: "not-found" });
    }
    assert.ok(RESERVED_SLUGS.includes("category"));
    assert.ok(RESERVED_SLUGS.includes("tag"));
    assert.ok(RESERVED_SLUGS.includes("community-guidelines"));
  });

  it("file-like and odd paths are not found", async () => {
    for (const slug of [
      "robots.txt",
      "sitemap.xml",
      "wp-login.php",
      "..",
      "a/b",
      "a b",
      "",
      "x".repeat(256)
    ]) {
      assert.deepEqual(await offline(slug), { kind: "not-found" });
    }
  });

  it("accepts real slug and handle shapes", () => {
    assert.equal(isRoutableSlug("beeper-carrying-case"), true);
    assert.equal(isRoutableSlug("some_handle"), true);
    assert.equal(
      isRoutableSlug(
        "beeper-8-pre-order-reservation-512eb3fe-9876-489b-808d-a5aa162f5be7"
      ),
      true
    );
  });
});

describe("lookupProduct", () => {
  it("returns the attributes of a visible product", async () => {
    const f = fakeFetch(productDoc("case", true));
    const found = await lookupProduct("case", {
      baseUrl: BASE,
      fetchImpl: f.impl
    });
    assert.equal(found.status, "visible");
    assert.equal(
      found.status === "visible" ? found.attributes.name : "",
      "Name"
    );
  });

  it("does not hand back attributes for a hidden product", async () => {
    const f = fakeFetch(productDoc("case", false));
    const found = await lookupProduct("case", {
      baseUrl: BASE,
      fetchImpl: f.impl
    });
    assert.deepEqual(found, { status: "hidden" });
  });

  it("gives up after the timeout", async () => {
    const f = fakeFetch("hang");
    const found = await lookupProduct("case", {
      baseUrl: BASE,
      fetchImpl: f.impl,
      timeoutMs: 10
    });
    assert.deepEqual(found, { status: "error" });
  });
});
