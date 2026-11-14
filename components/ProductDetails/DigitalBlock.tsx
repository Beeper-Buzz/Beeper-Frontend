import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "react-query";
import { Download, Smartphone } from "lucide-react";
import { useDigitalSummary, claimFree } from "@hooks/useLibrary";
import { QueryKeys } from "@hooks/queryKeys";
import { apiErrorMessage } from "../../lib/api/v1";
import { formatBytes, kindLabel, DigitalKind } from "../../lib/marketplace";
import { loginRedirectFor } from "../../lib/digitalCheckout";
import type { DigitalSummary } from "../../lib/creator/types";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** "16 samples · 12.4 MB": what the download holds, from its manifest. */
export function includedLine(s: DigitalSummary): string {
  const parts: string[] = [];
  if (s.kind === "sample_pack" && s.sample_count)
    parts.push(plural(s.sample_count, "sample"));
  if (s.kind === "effect_preset" && s.effect_count)
    parts.push(plural(s.effect_count, "effect"));
  if (s.kind === "visualizer") {
    parts.push("1 shader");
    if (s.param_count) parts.push(plural(s.param_count, "control"));
  }
  if (s.file_count && s.kind !== "visualizer")
    parts.push(plural(s.file_count, "file"));
  if (s.byte_size) parts.push(formatBytes(s.byte_size));
  return parts.join(" · ");
}

/**
 * The digital part of a product page: what it is, what's in it, an audio
 * demo, and, for a free product, a claim straight into the library.
 */
export const DigitalBlock: React.FC<{
  slug: string;
  kind: DigitalKind;
  variantId: string;
  free: boolean;
  signedIn: boolean;
}> = ({ slug, kind, variantId, free, signedIn }) => {
  const { data: summary } = useDigitalSummary(slug);
  const queryClient = useQueryClient();
  const [claimed, setClaimed] = useState(false);
  const claim = useMutation(() => claimFree(Number(variantId)), {
    onSuccess: () => {
      setClaimed(true);
      queryClient.invalidateQueries(QueryKeys.LIBRARY);
    }
  });
  const audio = summary?.preview?.audio_url;
  const included = summary ? includedLine(summary) : "";

  return (
    <section
      aria-label="Digital download"
      className="mt-6 rounded-lg border border-neon-magenta/30 bg-neon-magenta/[0.06] p-4"
    >
      <div className="flex items-start gap-3">
        <Smartphone
          className="mt-0.5 h-5 w-5 shrink-0 text-neon-magenta"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="font-body text-sm text-white">
            Digital download · use it in the Beeper app
          </p>
          <p className="mt-0.5 font-body text-xs text-white/50">
            {kindLabel(kind)}
            {included && (
              <>
                {" · "}
                <span className="font-mono-semibold tabular-nums text-white/70">
                  {included}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {audio && (
        <audio
          controls
          preload="none"
          src={audio}
          className="mt-3 h-9 w-full"
          aria-label="Audio preview"
        />
      )}

      {free && (
        <div className="mt-3 border-t border-white/10 pt-3">
          {claimed ? (
            <p className="font-body text-sm text-white/80">
              It&apos;s in your library.{" "}
              <Link
                href="/account/library"
                className="text-neon-cyan underline-offset-2 hover:underline"
              >
                Open library
              </Link>
            </p>
          ) : signedIn ? (
            <>
              <button
                type="button"
                onClick={() => claim.mutate()}
                disabled={claim.isLoading || !variantId}
                className="inline-flex items-center gap-2 rounded-md border border-neon-cyan/60 bg-neon-cyan/15 px-4 py-2 font-michroma text-[11px] tracking-wide text-neon-cyan transition-colors hover:bg-neon-cyan/25 disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                {claim.isLoading ? "Adding…" : "Add to library, free"}
              </button>
              {claim.isError && (
                <p
                  role="alert"
                  className="mt-2 font-body text-xs text-neon-pink"
                >
                  {apiErrorMessage(
                    claim.error,
                    "Couldn't add it. Try adding it to your cart instead."
                  )}
                </p>
              )}
            </>
          ) : (
            <p className="font-body text-sm text-white/70">
              <Link
                href={loginRedirectFor(`/${slug}`)}
                className="text-neon-cyan underline-offset-2 hover:underline"
              >
                Sign in
              </Link>{" "}
              to add it to your library for free.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
