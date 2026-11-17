// The way back into the app (specs/2026-11-15-storefront-web-purchase-design).
// The Beeper app opens product pages in the system browser with `?from=app`.
// The site remembers that for the browser session (sessionStorage
// `bb_from_app`), and the order confirmation page then offers "Open in
// Beeper" for an order with digital items.
//
// Pure apart from the default use of `window.sessionStorage`; a blocked or
// missing storage just means "not from the app".

export const FROM_APP_KEY = "bb_from_app";
export const LIBRARY_DEEP_LINK = "beeper://library";

export type FlagStorage = Pick<Storage, "getItem" | "setItem">;

const sessionStore = (): FlagStorage | null => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    // Reading window.sessionStorage itself throws when storage is blocked.
    return null;
  }
};

/** True when a URL or path carries `from=app`. */
export function fromAppInUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "https://placeholder.invalid");
    return parsed.searchParams.get("from") === "app";
  } catch {
    return false;
  }
}

/**
 * Stores the flag when the URL carries `from=app`. Returns whether it stored
 * it. Never throws; a URL without the parameter leaves the flag as it was.
 */
export function captureFromApp(
  url: string,
  storage: FlagStorage | null = sessionStore()
): boolean {
  if (!storage || !fromAppInUrl(url)) return false;
  try {
    storage.setItem(FROM_APP_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Whether this browser session arrived from the app. */
export function isFromApp(
  storage: FlagStorage | null = sessionStore()
): boolean {
  try {
    return storage?.getItem(FROM_APP_KEY) === "1";
  } catch {
    return false;
  }
}

/** Deep link the app opens on one Library item (spec §3.2). */
export const libraryDeepLink = (variantId: number | string) =>
  `${LIBRARY_DEEP_LINK}/${variantId}`;

/**
 * Where "Open in Beeper" goes: the item itself for one digital variant, the
 * Library for several, nothing for none.
 */
export function openInBeeperHref(
  variantIds: Array<number | string>
): string | null {
  const ids = Array.from(
    new Set(variantIds.map(String).filter((id) => /^\d+$/.test(id)))
  );
  if (ids.length === 0) return null;
  return ids.length === 1 ? libraryDeepLink(ids[0]) : LIBRARY_DEEP_LINK;
}

type OrderDoc = { included?: any[] } | null | undefined;

/**
 * Variant ids of an order's digital lines, in line order. A line is digital
 * when its product's slug is in `digitalSlugs` (the product endpoint's
 * `digital_kind`, see useCartDigitalSlugs).
 */
export function digitalVariantIds(
  order: OrderDoc,
  digitalSlugs: string[] | undefined
): string[] {
  if (!digitalSlugs?.length || !Array.isArray(order?.included)) return [];
  return (order?.included as any[])
    .filter(
      (item) =>
        item?.type === "line_item" &&
        digitalSlugs.includes(item.attributes?.slug)
    )
    .map((line) => line.relationships?.variant?.data?.id)
    .filter((id): id is string | number => id != null)
    .map(String);
}

/** The confirmation page's "Open in Beeper" link, or null to show nothing. */
export function orderOpenInBeeperHref(
  order: OrderDoc,
  digitalSlugs: string[] | undefined,
  fromApp: boolean
): string | null {
  if (!fromApp) return null;
  return openInBeeperHref(digitalVariantIds(order, digitalSlugs));
}
