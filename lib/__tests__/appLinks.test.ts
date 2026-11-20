import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveAppLinks } from "../appLinks";

describe("resolveAppLinks", () => {
  test("falls back to the env iOS url when there is no override", () => {
    const links = resolveAppLinks(null);
    assert.equal(links.length, 1);
    assert.equal(links[0].platform, "ios");
    assert.equal(links[0].href, "https://testflight.apple.com/join/Ys1jkVfk");
    assert.equal(links[0].kind, "beta");
    assert.equal(links[0].label, "Join the iOS beta");
  });

  test("an admin override wins over env", () => {
    const links = resolveAppLinks({
      ios_url: "https://apps.apple.com/app/id1661874489"
    });
    assert.equal(links[0].kind, "store");
    assert.equal(links[0].label, "Download on the App Store");
    assert.equal(links[0].href, "https://apps.apple.com/app/id1661874489");
  });

  test("an empty or whitespace override falls back to env", () => {
    assert.equal(resolveAppLinks({ ios_url: "   " })[0].kind, "beta");
  });

  test("android is omitted entirely when override and env are both empty", () => {
    const links = resolveAppLinks({ android_url: "" });
    assert.deepEqual(
      links.map((l) => l.platform),
      ["ios"]
    );
  });

  test("an android override is labelled for Play", () => {
    const links = resolveAppLinks({
      android_url:
        "https://play.google.com/store/apps/details?id=com.beeper.Buzz"
    });
    const android = links.find((l) => l.platform === "android");
    assert.equal(android?.kind, "store");
    assert.equal(android?.label, "Get it on Google Play");
  });

  test("ios comes before android", () => {
    const links = resolveAppLinks({
      ios_url: "https://apps.apple.com/app/id1661874489",
      android_url:
        "https://play.google.com/store/apps/details?id=com.beeper.Buzz"
    });
    assert.deepEqual(
      links.map((l) => l.platform),
      ["ios", "android"]
    );
  });

  test("a malformed href is dropped rather than rendered", () => {
    assert.deepEqual(
      resolveAppLinks({ ios_url: "not a url" }).map((l) => l.kind),
      ["beta"]
    );
  });
});
