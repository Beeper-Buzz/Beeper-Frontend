// CMS sections for a storefront page, edited in the admin under Page Sections
// (dna-admin HomepageSection, scoped by `page_key`). Plain fetch with a
// timeout and no storage/window access, so it runs in getStaticProps. Any
// failure (admin down, endpoint missing, page empty) returns null and the page
// falls back to the copy committed in data/cms/<page>.json, which is the same
// file the admin's `rake beeper:cms:seed_page` loads.

export type SectionType =
  | "hero"
  | "features"
  | "products"
  | "content"
  | "call_to_action"
  | "revenue_share"
  | "steps"
  | "faq"
  | (string & {});

export interface PageSection {
  id: number | string;
  section_type: SectionType;
  title: string | null;
  /** HTML authored in the admin's editor. */
  content: string | null;
  settings: Record<string, any>;
}

type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal }
) => Promise<{ ok: boolean; json: () => Promise<any> }>;

export interface FetchPageSectionsOptions {
  baseUrl: string;
  fetchImpl?: FetchLike;
  /** getStaticProps awaits this; a hung admin must not hang the build. */
  timeoutMs?: number;
}

/**
 * Settings arrive as an object, a JSON string, or (rows saved before the admin
 * parsed them) a Ruby hash string like `{"a"=>1}`. Anything else is `{}`.
 */
export function parseSettings(raw: unknown): Record<string, any> {
  if (raw && typeof raw === "object" && !Array.isArray(raw))
    return raw as Record<string, any>;
  if (typeof raw !== "string" || !raw.trim()) return {};
  for (const text of [raw, raw.replace(/"\s*=>\s*/g, '": ')]) {
    try {
      const v = JSON.parse(text.replace(/\bnil\b/g, "null"));
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    } catch {
      // try the next form
    }
  }
  return {};
}

/** `settings.items` kept to the objects that have every key in `required`. */
export function itemsOf<T extends Record<string, any>>(
  settings: Record<string, any> | null | undefined,
  required: (keyof T & string)[]
): T[] {
  const items = settings?.items;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (i): i is T =>
      !!i &&
      typeof i === "object" &&
      required.every((k) => typeof i[k] === "string" && i[k].trim() !== "")
  );
}

export const numberOr = (v: unknown, fallback: number): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
};

const normalize = (raw: any, index: number): PageSection | null => {
  if (!raw || typeof raw.section_type !== "string") return null;
  return {
    id: raw.id ?? `section-${index}`,
    section_type: raw.section_type,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : null,
    content:
      typeof raw.content === "string" && raw.content.trim()
        ? raw.content
        : null,
    settings: parseSettings(raw.settings)
  };
};

/** Normalized sections in display order (ids default to their position). */
export const toSections = (raw: unknown): PageSection[] =>
  (Array.isArray(raw) ? raw : [])
    .map(normalize)
    .filter((s): s is PageSection => !!s);

/**
 * The page's visible sections, in order. Null when there are none or the
 * request fails, so callers can tell "use the fallback" from real content.
 */
export async function fetchPageSections(
  pageKey: string,
  { baseUrl, fetchImpl, timeoutMs = 5000 }: FetchPageSectionsOptions
): Promise<PageSection[] | null> {
  const doFetch: FetchLike = fetchImpl || (fetch as unknown as FetchLike);
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  try {
    const res = await doFetch(
      `${baseUrl}/api/v1/homepage_sections?visible_only=true&page_key=${encodeURIComponent(
        pageKey
      )}`,
      {
        headers: { "Content-Type": "application/json" },
        signal: controller?.signal
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const raw: any[] = json?.response_data?.homepage_sections || [];
    // An admin that predates page_key ignores the param and returns the
    // homepage's sections: only rows tagged with this page count.
    const own = raw.filter(
      (s) => s?.page_key === pageKey && s?.is_visible !== false
    );
    own.sort((a, b) => numberOr(a.position, 0) - numberOr(b.position, 0));
    const sections = toSections(own);
    return sections.length ? sections : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** What the creator earns on a sale at `price` with a `share` percent cut. */
export const creatorEarnings = (price: number, share: number): number =>
  Math.round(Math.max(0, price) * Math.min(100, Math.max(0, share))) / 100;
