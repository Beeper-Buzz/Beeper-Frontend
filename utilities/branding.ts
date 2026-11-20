// Single source of truth for storefront branding strings.
//
// This file exists so brand copy is never hardcoded in components again — the
// storefront was forked from a template and carried the previous tenant's name
// ("POL Clothing", "DNA") in footers, menus and page copy for a long time.
// Everything here is env-overridable; the fallbacks are the current tenant.

// Product / storefront brand, e.g. "Beeper".
export const SITE_TITLE = process.env.NEXT_PUBLIC_SITE_TITLE || "Beeper";

// Short form used in tight UI (header, footer copyright).
export const SHORT_TITLE = process.env.NEXT_PUBLIC_SHORT_TITLE || "Beeper";

// Legal entity behind the storefront. Deliberately separate from SITE_TITLE:
// the brand is "Beeper", the company that owns it is "Material Instinct".
export const COMPANY_NAME =
  process.env.NEXT_PUBLIC_COMPANY_NAME || "Material Instinct";

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_EMAIL || "hey@beeper.buzz";

export const CONTACT_PHONE = process.env.NEXT_PUBLIC_PHONE || "+1-917-300-8103";

export const LOGO_PATH =
  process.env.NEXT_PUBLIC_LOGO_PATH || "images/beeper-logo-v2.png";

// Where the "get the Beeper app" callouts send people. The admin's app link
// settings override these. iOS defaults to the TestFlight invite until the App
// Store listing exists; Android has no default, so it is omitted until set.
export const IOS_APP_URL =
  process.env.NEXT_PUBLIC_IOS_APP_URL ||
  "https://testflight.apple.com/join/Ys1jkVfk";
export const ANDROID_APP_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL || "";
