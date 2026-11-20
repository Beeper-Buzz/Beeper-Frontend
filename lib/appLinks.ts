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

const LABELS: Record<AppPlatform, Record<AppLinkKind, string>> = {
  ios: {
    beta: "Join the iOS beta",
    store: "Download on the App Store"
  },
  android: {
    beta: "Join the Android beta",
    store: "Get it on Google Play"
  }
};

/** The trimmed value if it is an absolute http(s) URL, else null. */
const validUrl = (value: string | undefined | null): string | null => {
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
