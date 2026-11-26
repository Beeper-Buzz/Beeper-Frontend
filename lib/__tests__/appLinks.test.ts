import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { AppLink, AppLinkKind, AppPlatform } from "../appLinks";
import { appCalloutCopy, resolveAppLinks } from "../appLinks";

// Note: resolveAppLinks reads the env-backed constants in utilities/branding.ts,
// so these expectations assume the repo defaults. Exporting
// NEXT_PUBLIC_IOS_APP_URL / NEXT_PUBLIC_ANDROID_APP_URL in your shell will fail
// the suite. House convention: the other link tests do the same.

const link = (platform: AppPlatform, kind: AppLinkKind): AppLink => ({
  platform,
  kind,
  href: "https://example.test/app",
  label: "x"
});

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
    assert.equal(links[0].label, "Get the iOS app");
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
    assert.equal(android?.label, "Get the Android app");
  });

  test("store labels carry no Apple or Google badge-lockup wording", () => {
    const labels = resolveAppLinks({
      ios_url: "https://apps.apple.com/app/id1661874489",
      android_url:
        "https://play.google.com/store/apps/details?id=com.beeper.Buzz"
    }).map((l) => l.label);
    assert.deepEqual(labels, ["Get the iOS app", "Get the Android app"]);
  });

  test("beta labels are unchanged", () => {
    assert.equal(resolveAppLinks(null)[0].label, "Join the iOS beta");
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

  test("a non-http(s) scheme is rejected and falls back to the env link", () => {
    const links = resolveAppLinks({ ios_url: "javascript:alert(1)" });
    assert.equal(links[0].kind, "beta");
    assert.equal(links[0].href, "https://testflight.apple.com/join/Ys1jkVfk");
  });
});

describe("appCalloutCopy", () => {
  test("beta-only: says beta, never 'out now'", () => {
    const copy = appCalloutCopy([link("ios", "beta"), link("android", "beta")]);
    assert.equal(copy.heading, "Try the Beeper app beta");
    assert.equal(
      copy.body,
      "The Beeper app beta is open on iPhone and Android."
    );
    assert.ok(!/out now/i.test(copy.body));
    assert.ok(!/almost here/i.test(copy.heading));
  });

  test("store-only: says out now, never 'beta' or 'almost here'", () => {
    const copy = appCalloutCopy([
      link("ios", "store"),
      link("android", "store")
    ]);
    assert.equal(copy.heading, "Get the Beeper app");
    assert.equal(copy.body, "The Beeper app is out now on iPhone and Android.");
    assert.ok(!/beta/i.test(copy.heading + copy.body));
    assert.ok(!/almost here/i.test(copy.heading));
  });

  test("iOS-only never implies Android exists", () => {
    const beta = appCalloutCopy([link("ios", "beta")]);
    assert.equal(beta.body, "The Beeper app beta is open on iPhone.");
    assert.ok(!/android/i.test(beta.heading + beta.body));

    const store = appCalloutCopy([link("ios", "store")]);
    assert.equal(store.body, "The Beeper app is out now on iPhone.");
    assert.ok(!/android/i.test(store.heading + store.body));
  });

  test("Android-only never implies iOS exists", () => {
    const beta = appCalloutCopy([link("android", "beta")]);
    assert.equal(beta.body, "The Beeper app beta is open on Android.");
    assert.ok(!/iphone|ios/i.test(beta.heading + beta.body));

    const store = appCalloutCopy([link("android", "store")]);
    assert.equal(store.body, "The Beeper app is out now on Android.");
    assert.ok(!/iphone|ios/i.test(store.heading + store.body));
  });

  test("mixed: launch copy that still calls the beta platform a beta", () => {
    const copy = appCalloutCopy([
      link("ios", "store"),
      link("android", "beta")
    ]);
    assert.equal(copy.heading, "Get the Beeper app");
    assert.equal(
      copy.body,
      "The Beeper app is out now on iPhone, with a beta on Android."
    );
  });

  test("no links names no platform and claims nothing", () => {
    const copy = appCalloutCopy([]);
    assert.ok(!/iphone|ios|android/i.test(copy.heading + copy.body));
    assert.ok(!/out now/i.test(copy.body));
  });

  test("copy follows what the admin actually resolved to", () => {
    assert.equal(
      appCalloutCopy(resolveAppLinks(null)).body,
      "The Beeper app beta is open on iPhone."
    );
    assert.equal(
      appCalloutCopy(
        resolveAppLinks({ ios_url: "https://apps.apple.com/app/id1661874489" })
      ).body,
      "The Beeper app is out now on iPhone."
    );
  });
});
