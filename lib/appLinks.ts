// Where "get the Beeper app" callouts point (native app callouts plan, Task 1).
// The admin can set an iOS and an Android link; the env-backed constants in
// utilities/branding.ts are the fallback (iOS defaults to the TestFlight
// invite, Android to nothing).
//
// Pure: no I/O, no window access, so it runs the same in getStaticProps and in
// the browser. An empty result is a valid outcome and means "render no links".
//
// Validation is per value: an override that is blank or not an absolute
// http(s) URL is discarded and the env fallback is then tried on its own
// merits. A platform with no usable URL is left out, never rendered broken.

import { ANDROID_APP_URL, IOS_APP_URL } from "../utilities/branding";

export type AppPlatform = "ios" | "android";
export type AppLinkKind = "beta" | "store";

export interface AppLink {
  platform: AppPlatform;
  href: string;
  label: string;
  kind: AppLinkKind;
}

export interface AppLinkOverride {
  ios_url?: string;
  android_url?: string;
}

const TESTFLIGHT_HOST = "testflight.apple.com";

// The store labels are deliberately NOT "Download on the App Store" / "Get it
// on Google Play": those are Apple's and Google's badge lockups, and both
// vendors' guidelines treat them as artwork, not as copy. We ship text buttons,
// so the wording has to be our own.
const LABELS: Record<AppPlatform, Record<AppLinkKind, string>> = {
  ios: {
    beta: "Join the iOS beta",
    store: "Get the iOS app"
  },
  android: {
    beta: "Join the Android beta",
    store: "Get the Android app"
  }
};

/** The trimmed value if it is an absolute http(s) URL, else null. */
export const validUrl = (value: string | undefined | null): string | null => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;
  try {
    const { protocol } = new URL(trimmed);
    return protocol === "http:" || protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
};

const buildLink = (
  platform: AppPlatform,
  override: string | undefined,
  fallback: string
): AppLink | null => {
  const href = validUrl(override) ?? validUrl(fallback);
  if (!href) return null;
  const kind: AppLinkKind =
    new URL(href).hostname === TESTFLIGHT_HOST ? "beta" : "store";
  return { platform, href, label: LABELS[platform][kind], kind };
};

/**
 * The app links to show, iOS first. Each platform takes the admin override if
 * it is valid, otherwise the env fallback if that is valid, otherwise it is
 * omitted. May return an empty array.
 */
export const resolveAppLinks = (override?: AppLinkOverride | null): AppLink[] =>
  [
    buildLink("ios", override?.ios_url, IOS_APP_URL),
    buildLink("android", override?.android_url, ANDROID_APP_URL)
  ].filter((link): link is AppLink => link !== null);

/** Callout wording. `heading` is for the section variant; `body` is used by both. */
export interface AppCalloutCopy {
  heading: string;
  body: string;
}

const PLATFORM_NAMES: Record<AppPlatform, string> = {
  ios: "iPhone",
  android: "Android"
};

/** "iPhone", "Android" or "iPhone and Android" — only platforms that are in the list. */
const platformPhrase = (links: AppLink[]): string =>
  links.map((link) => PLATFORM_NAMES[link.platform]).join(" and ");

/**
 * The callout copy for a set of resolved links.
 *
 * This is the other half of the launch flip: an admin who pastes a store URL
 * must not be left with surrounding copy that still announces a beta, and an
 * admin who has only filled in one platform must not get copy implying the
 * other one exists. So every word here is derived from `links` and nothing is
 * hardcoded to iOS or to the beta.
 */
export const appCalloutCopy = (links: AppLink[]): AppCalloutCopy => {
  const store = links.filter((link) => link.kind === "store");
  const beta = links.filter((link) => link.kind === "beta");

  if (links.length === 0) {
    // The component renders nothing in this state; copy still has to be honest.
    return { heading: "The Beeper app", body: "The Beeper app is on its way." };
  }

  if (store.length === 0) {
    return {
      heading: "Try the Beeper app beta",
      body: `The Beeper app beta is open on ${platformPhrase(beta)}.`
    };
  }

  if (beta.length === 0) {
    return {
      heading: "Get the Beeper app",
      body: `The Beeper app is out now on ${platformPhrase(store)}.`
    };
  }

  return {
    heading: "Get the Beeper app",
    body: `The Beeper app is out now on ${platformPhrase(
      store
    )}, with a beta on ${platformPhrase(beta)}.`
  };
};
