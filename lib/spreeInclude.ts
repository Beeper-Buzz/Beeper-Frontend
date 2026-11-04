// `include=videos` makes a backend without the product_video relationship
// answer 400 ("videos is not specified as a relationship ..."), which would
// blank every product list. The backend is meant to deploy first, but if the
// web goes out early (or a dev points at an older admin) we retry once without
// videos and stop asking for the rest of the session.

let videosSupported = true;

/** Append `videos` to a JSON:API include list unless the backend rejected it. */
export function withVideos(include: string): string {
  if (!videosSupported) return include;
  const parts = include.split(",").filter(Boolean);
  return parts.includes("videos") ? include : [...parts, "videos"].join(",");
}

export function withoutVideos(include: string): string {
  return include
    .split(",")
    .filter((p) => p && p !== "videos")
    .join(",");
}

/** True for the 400 a backend without the relationship returns. */
export function isVideosIncludeError(
  status: number | undefined | null,
  message: string | undefined | null
): boolean {
  return status === 400 && /videos/i.test(String(message || ""));
}

export function markVideosUnsupported(): void {
  videosSupported = false;
}

/** Test hook. */
export function resetVideosSupport(): void {
  videosSupported = true;
}

/**
 * Run a request with `videos` in the include; if it fails with the
 * unsupported-relationship 400, mark it and run once more without.
 * `describe` pulls (status, message) from whatever the request threw.
 */
export async function requestWithVideosFallback<T>(
  include: string,
  run: (include: string) => Promise<T>,
  describe: (err: unknown) => { status?: number; message?: string }
): Promise<T> {
  const first = withVideos(include);
  try {
    return await run(first);
  } catch (err) {
    if (first === include) throw err;
    const { status, message } = describe(err);
    if (!isVideosIncludeError(status, message)) throw err;
    markVideosUnsupported();
    return run(withoutVideos(include));
  }
}
