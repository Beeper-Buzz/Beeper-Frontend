import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, Download, Smartphone } from "lucide-react";
import { cn } from "@lib/utils";
import {
  getLibraryLinks,
  libraryDeepLink,
  useLibrary
} from "@hooks/useLibrary";
import { apiErrorMessage } from "../../lib/api/v1";
import { groupLibrary } from "../../lib/library";
import { formatBytes, kindLabel } from "../../lib/marketplace";
import type { LibraryItem } from "../../lib/creator/types";
import {
  Chip,
  ErrorNote,
  formatDate,
  numCls,
  Skeleton
} from "../CreatorPortal/kit";

const SOURCE: Record<LibraryItem["source"], string> = {
  order: "Bought",
  iap: "Bought in app",
  grant: "Gift",
  free: "Free"
};

/** Start a browser download of a signed URL without leaving the page. */
const startDownload = (url: string, filename: string) => {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const ItemRow: React.FC<{ item: LibraryItem }> = ({ item }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const revoked = !!item.revoked_at;
  const files = item.asset?.files || [];

  const download = async (fileId: number, filename: string) => {
    setBusy(fileId);
    setError(null);
    try {
      // Links last 10 minutes, so ask for one right before each download.
      const [link] = await getLibraryLinks(item.ownership_id, [fileId]);
      if (!link?.url) throw new Error("No download link came back.");
      startDownload(link.url, filename);
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't start the download. Try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <li
      className={cn(
        "rounded-md border border-glass-border bg-white/[0.02]",
        revoked && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-surface-deep">
          {item.product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.product.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/${item.product.slug}`}
              className="truncate font-body text-sm font-semibold text-white no-underline hover:text-neon-cyan"
            >
              {item.product.name}
            </Link>
            {revoked ? (
              <Chip tone="pink">Removed {formatDate(item.revoked_at)}</Chip>
            ) : (
              <Chip>{SOURCE[item.source] || item.source}</Chip>
            )}
          </div>
          <div className="mt-0.5 truncate font-body text-xs text-white/50">
            {item.product.creator ? `by ${item.product.creator.name} · ` : ""}
            <span className={numCls}>
              v{item.asset?.version ?? 1} ·{" "}
              {formatBytes(item.asset?.byte_size || 0)}
            </span>
          </div>
        </div>
        {!revoked && (
          <a
            href={libraryDeepLink(item.variant_id)}
            className="hidden shrink-0 items-center gap-1.5 rounded-md border border-neon-cyan/60 bg-neon-cyan/15 px-3 py-2 font-michroma text-[10px] tracking-wide text-neon-cyan no-underline transition-colors hover:bg-neon-cyan/25 sm:inline-flex"
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            Open in Beeper
          </a>
        )}
      </div>

      {revoked ? (
        <p className="border-t border-glass-border px-3 py-2 font-body text-xs text-white/50">
          This order was refunded or cancelled, so the files are no longer
          available. The app removes its copy within 7 days.
        </p>
      ) : (
        <div className="flex items-center gap-2 border-t border-glass-border px-3 py-2">
          <a
            href={libraryDeepLink(item.variant_id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-neon-cyan/60 bg-neon-cyan/15 px-3 py-1.5 font-michroma text-[10px] tracking-wide text-neon-cyan no-underline sm:hidden"
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            Open in Beeper
          </a>
          {files.length > 0 && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 font-body text-xs text-white/60 hover:text-white sm:ml-0"
            >
              {files.length} {files.length === 1 ? "file" : "files"}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  open && "rotate-180"
                )}
                aria-hidden
              />
            </button>
          )}
        </div>
      )}

      {!revoked && open && (
        <ul className="divide-y divide-glass-border border-t border-glass-border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate font-body text-xs text-white/80">
                {f.filename}
              </span>
              <span className={`${numCls} shrink-0 text-[11px] text-white/40`}>
                {formatBytes(f.byte_size)}
              </span>
              <button
                type="button"
                onClick={() => download(f.id, f.filename)}
                disabled={busy !== null}
                aria-label={`Download ${f.filename}`}
                className="shrink-0 rounded p-1.5 text-white/60 transition-colors hover:bg-white/[0.06] hover:text-neon-cyan disabled:opacity-40"
              >
                <Download
                  className={cn("h-4 w-4", busy === f.id && "animate-pulse")}
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="px-3 pb-2 font-body text-xs text-neon-pink">
          {error}
        </p>
      )}
    </li>
  );
};

export const LibraryView: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const library = useLibrary(enabled);

  if (!enabled || library.isLoading)
    return (
      <div className="space-y-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  if (library.isError) return <ErrorNote error={library.error} />;

  const groups = groupLibrary(library.data || []);
  if (groups.length === 0)
    return (
      <div className="glass-panel px-5 py-12 text-center">
        <h2 className="font-michroma text-sm text-white">
          Your library is empty
        </h2>
        <p className="mx-auto mt-2 max-w-sm font-body text-sm text-white/50">
          Sample packs, effect presets and visualizers you buy or claim land
          here and in the Beeper app&apos;s library.
        </p>
        <Link
          href="/browse?mode=marketplace"
          className="mt-5 inline-flex rounded-md border border-neon-cyan/60 bg-neon-cyan/15 px-4 py-2 font-michroma text-[11px] tracking-wide text-neon-cyan no-underline hover:bg-neon-cyan/25"
        >
          Browse the marketplace
        </Link>
      </div>
    );

  return (
    <div className="space-y-6">
      <p className="font-body text-sm text-white/50">
        Everything here is also in the Beeper app&apos;s library when you sign
        in with this account.
      </p>
      {groups.map((g) => (
        <section key={g.kind} aria-labelledby={`lib-${g.kind}`}>
          <h2
            id={`lib-${g.kind}`}
            className="mb-2 flex items-baseline gap-2 font-michroma text-xs text-white/80"
          >
            {kindLabel(g.kind, true)}
            <span className={`${numCls} text-[11px] text-white/40`}>
              {g.items.length}
            </span>
          </h2>
          <ul className="space-y-2">
            {g.items.map((item) => (
              <ItemRow key={item.ownership_id} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
