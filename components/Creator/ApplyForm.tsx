import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@lib/utils";
import { useApplyCreator } from "@hooks/useCreator";
import { DIGITAL_KINDS, DigitalKind, kindLabel } from "../../lib/marketplace";
import type { PortfolioLink } from "../../lib/creator/types";
import {
  btnGhost,
  btnPrimary,
  ErrorNote,
  Field,
  inputCls,
  Section
} from "../CreatorPortal/kit";
import { FileDrop, UploadList, useUploadQueue } from "../CreatorPortal/uploads";

const KIND_HINT: Record<DigitalKind, string> = {
  sample_pack: "One-shots and loops for the Sampler's 16 pads",
  effect_preset: "Settings for the app's nine effects",
  visualizer: "A GLSL scene that reacts to the music"
};

const MAX_LINKS = 5;

const isUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

export const ApplyForm: React.FC<{ defaultName?: string }> = ({
  defaultName = ""
}) => {
  const apply = useApplyCreator();
  const [displayName, setDisplayName] = useState(defaultName);
  const [kinds, setKinds] = useState<DigitalKind[]>([]);
  const [links, setLinks] = useState<PortfolioLink[]>([{ label: "", url: "" }]);
  const [about, setAbout] = useState("");
  const [tried, setTried] = useState(false);
  const demos = useUploadQueue({ allowed: ["audio", "image", "text"], max: 3 });

  const cleanLinks = links.filter((l) => l.url.trim());
  const errors = {
    displayName:
      displayName.trim().length < 2 ? "Enter the name buyers will see." : null,
    kinds: kinds.length ? null : "Pick at least one.",
    links: cleanLinks.every((l) => isUrl(l.url.trim()))
      ? null
      : "Links must start with https://",
    about:
      about.trim().length < 40
        ? "Tell us a little more (at least 40 characters)."
        : null
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!valid || demos.busy || demos.failed) return;
    apply.mutate({
      display_name: displayName.trim(),
      kinds,
      portfolio_links: cleanLinks.map((l) => ({
        label: l.label.trim() || new URL(l.url.trim()).hostname,
        url: l.url.trim()
      })),
      about: about.trim(),
      sample_upload_signed_ids: demos.jobs
        .map((j) => j.signedId)
        .filter((s): s is string => !!s)
    });
  };

  const toggleKind = (k: DigitalKind) =>
    setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Section title="About you">
        <div className="space-y-4">
          <Field
            label="Creator name"
            htmlFor="cr-name"
            hint="Shown on your products as the byline."
            error={tried ? errors.displayName : null}
          >
            <input
              id="cr-name"
              className={inputCls}
              value={displayName}
              maxLength={60}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
            />
          </Field>

          <fieldset>
            <legend className="mb-1 font-title-condensed text-xs text-white/60">
              What you want to sell
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {DIGITAL_KINDS.map((k) => {
                const on = kinds.includes(k);
                return (
                  <label
                    key={k}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition-colors",
                      on
                        ? "border-neon-cyan/60 bg-neon-cyan/[0.08]"
                        : "border-glass-border hover:border-white/25"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleKind(k)}
                      className="mt-0.5 h-4 w-4 accent-neon-cyan"
                    />
                    <span>
                      <span className="block font-body text-sm text-white">
                        {kindLabel(k, true)}
                      </span>
                      <span className="block font-body text-xs text-white/45">
                        {KIND_HINT[k]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {tried && errors.kinds && (
              <p className="mt-1 font-body text-xs text-neon-pink">
                {errors.kinds}
              </p>
            )}
          </fieldset>

          <Field
            label="Your work so far"
            htmlFor="cr-about"
            hint="Releases, credits, the gear you use, what you'd make for Beeper."
            error={tried ? errors.about : null}
          >
            <textarea
              id="cr-about"
              className={cn(inputCls, "min-h-[120px] resize-y")}
              value={about}
              maxLength={2000}
              onChange={(e) => setAbout(e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Links">
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input
                aria-label={`Link ${i + 1} label`}
                placeholder="Label (SoundCloud)"
                className={cn(inputCls, "w-1/3 min-w-0")}
                value={l.label}
                onChange={(e) =>
                  setLinks((ls) =>
                    ls.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x
                    )
                  )
                }
              />
              <input
                aria-label={`Link ${i + 1} URL`}
                placeholder="https://"
                inputMode="url"
                className={cn(inputCls, "min-w-0 flex-1")}
                value={l.url}
                onChange={(e) =>
                  setLinks((ls) =>
                    ls.map((x, j) =>
                      j === i ? { ...x, url: e.target.value } : x
                    )
                  )
                }
              />
              <button
                type="button"
                className="shrink-0 rounded p-2 text-white/40 hover:text-neon-pink"
                aria-label={`Remove link ${i + 1}`}
                onClick={() =>
                  setLinks((ls) =>
                    ls.length > 1
                      ? ls.filter((_, j) => j !== i)
                      : [{ label: "", url: "" }]
                  )
                }
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {tried && errors.links && (
            <p className="font-body text-xs text-neon-pink">{errors.links}</p>
          )}
          {links.length < MAX_LINKS && (
            <button
              type="button"
              className={btnGhost}
              onClick={() => setLinks((ls) => [...ls, { label: "", url: "" }])}
            >
              <Plus className="h-4 w-4" /> Add a link
            </button>
          )}
        </div>
      </Section>

      <Section
        title="Demo files"
        aside={
          <span className="font-mono-semibold text-xs text-white/40">
            {demos.jobs.length}/3
          </span>
        }
      >
        <div className="space-y-2">
          <p className="font-body text-sm text-white/55">
            Up to three examples of what you&apos;d sell: a few samples, a
            screenshot of a scene, a shader file.
          </p>
          <FileDrop
            id="cr-demos"
            allowed={["audio", "image", "text"]}
            onFiles={demos.add}
            disabled={demos.jobs.length >= 3}
            label="Drop files or choose"
            hint="WAV, AIFF, FLAC, MP3 up to 50 MB · images up to 10 MB · GLSL"
          />
          {demos.rejected.map((r) => (
            <p key={r} className="font-body text-xs text-neon-pink">
              {r}
            </p>
          ))}
          <UploadList
            jobs={demos.jobs}
            onRemove={demos.remove}
            onRetry={demos.retry}
          />
        </div>
      </Section>

      <ErrorNote
        error={apply.error}
        fallback="Your application wasn't sent. Try again."
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className={btnPrimary}
          disabled={apply.isLoading || demos.busy}
        >
          {apply.isLoading
            ? "Sending…"
            : demos.busy
            ? "Uploading…"
            : "Send application"}
        </button>
        {demos.failed && (
          <span className="font-body text-xs text-neon-pink">
            Retry or remove the files that failed.
          </span>
        )}
      </div>
    </form>
  );
};
