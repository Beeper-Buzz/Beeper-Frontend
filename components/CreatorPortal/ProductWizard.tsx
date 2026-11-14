import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@lib/utils";
import {
  useCreatorProduct,
  useDeleteCreatorProduct,
  useSaveCreatorProduct,
  useSubmitCreatorProduct
} from "@hooks/useCreator";
import { useMarketplaceTaxons } from "@hooks/useMarketplace";
import type { CreatorProduct } from "../../lib/creator/types";
import {
  DraftFile,
  draftFromProduct,
  draftManifest,
  draftToInput,
  emptyDraft,
  FILE_GROUPS,
  ProductDraft,
  stepErrors
} from "../../lib/creator/productDraft";
import {
  DIGITAL_KINDS,
  DigitalKind,
  formatBytes,
  kindLabel
} from "../../lib/marketplace";
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  Chip,
  ErrorNote,
  Field,
  formatMoney,
  inputCls,
  numCls,
  PageTitle,
  REVIEW,
  ReviewChip,
  Section,
  Skeleton
} from "./kit";
import { FileDrop, UploadJob, UploadList, useUploadQueue } from "./uploads";
import { SamplePackEditor } from "./editors/SamplePackEditor";
import { EffectPresetEditor } from "./editors/EffectPresetEditor";
import { VisualizerEditor } from "./editors/VisualizerEditor";

const STEPS = [
  { id: "kind", label: "Kind" },
  { id: "details", label: "Details" },
  { id: "files", label: "Files" },
  { id: "preview", label: "Preview media" },
  { id: "review", label: "Review" }
] as const;
type StepId = (typeof STEPS)[number]["id"];

const KIND_INFO: Record<DigitalKind, { body: string; files: string }> = {
  sample_pack: {
    body: "One-shots and loops that load onto the Sampler's 16 pads and keys.",
    files: "WAV, AIFF, FLAC or MP3, up to 50 MB each"
  },
  effect_preset: {
    body: "Settings for the app's effects rack, applied in one tap.",
    files: "No files: you set the effects here"
  },
  visualizer: {
    body: "A GLSL scene that reacts to the bass, mids, highs and beat.",
    files: "One .glsl file, up to 64 KB"
  }
};

/** Loads the product (when editing) and mounts the editor on it. */
export const ProductWizard: React.FC<{ productId: number | null }> = ({
  productId
}) => {
  const q = useCreatorProduct(productId);
  if (productId && q.isLoading) return <Skeleton className="h-96" />;
  if (productId && q.isError)
    return (
      <ErrorNote
        error={q.error}
        fallback="That product didn't load. It may have been deleted."
      />
    );
  const product = q.data || null;
  // Remount from the server's copy after every save.
  return (
    <WizardBody
      key={product ? `${product.id}:${product.updated_at}` : "new"}
      product={product}
    />
  );
};

const existingJobs = (p: CreatorProduct | null): UploadJob[] =>
  (p?.asset?.files || []).map((f) => ({
    key: `existing-${f.id}`,
    name: f.filename,
    size: f.byte_size,
    progress: 1,
    status: "done",
    existingId: f.id
  }));

const WizardBody: React.FC<{ product: CreatorProduct | null }> = ({
  product
}) => {
  const router = useRouter();
  const save = useSaveCreatorProduct();
  const submit = useSubmitCreatorProduct();
  const del = useDeleteCreatorProduct();
  const taxons = useMarketplaceTaxons();

  const [draft, setDraftState] = useState<ProductDraft>(() =>
    product ? draftFromProduct(product) : emptyDraft()
  );
  const setDraft = (fn: (d: ProductDraft) => ProductDraft) => setDraftState(fn);

  const allowed = useMemo(
    () => (draft.kind ? FILE_GROUPS[draft.kind] : []),
    [draft.kind]
  );
  const files = useUploadQueue({ allowed, initial: existingJobs(product) });
  const image = useUploadQueue({ allowed: ["image"], max: 1 });
  const demo = useUploadQueue({ allowed: ["audio"], max: 1 });

  const stepParam = String(router.query.step || "");
  const step: StepId = (STEPS.find((s) => s.id === stepParam)?.id ||
    (product ? "details" : "kind")) as StepId;
  const goTo = (id: StepId) =>
    router.replace(
      { pathname: router.pathname, query: { ...router.query, step: id } },
      undefined,
      { shallow: true, scroll: false }
    );
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const errors = stepErrors(draft, files.jobs as DraftFile[]);
  const previewBusy = image.busy || demo.busy;
  const errorCount =
    errors.kind.length + errors.details.length + errors.files.length;

  const originalFileIds = product
    ? (product.asset?.files || []).map((f) => f.id)
    : null;
  const input = () =>
    draftToInput(draft, files.jobs as DraftFile[], {
      originalFileIds,
      previewImageSignedId: image.jobs[0]?.signedId,
      previewAudioSignedId: demo.jobs[0]?.signedId
    });

  // Unsaved changes guard.
  const baseline = useRef<string | null>(null);
  const snapshot = JSON.stringify([
    draft,
    files.jobs.map((j) => [j.name, j.signedId, j.existingId]),
    image.jobs.map((j) => j.signedId),
    demo.jobs.map((j) => j.signedId)
  ]);
  if (baseline.current === null) baseline.current = snapshot;
  const dirty = snapshot !== baseline.current;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const state = product?.review_state;
  const locked = state === "submitted";
  const canSubmit =
    !locked &&
    state !== "rejected" &&
    (!product ||
      state === "draft" ||
      state === "changes_requested" ||
      (state === "approved" && (dirty || product.asset?.status === "draft")));

  const doSave = async (): Promise<CreatorProduct | null> => {
    if (!draft.kind) return null;
    const saved = await save.mutateAsync({ id: product?.id, input: input() });
    baseline.current = null;
    if (!product) {
      await router.replace(
        { pathname: `/creator/products/${saved.id}`, query: { step } },
        undefined,
        { shallow: false }
      );
    }
    return saved;
  };

  const onSave = () => {
    save.reset();
    doSave().catch(() => undefined);
  };

  const onSubmit = async () => {
    try {
      const saved = dirty || !product ? await doSave() : product;
      if (!saved) return;
      await submit.mutateAsync(saved.id);
      router.push("/creator/products");
    } catch {
      // shown through save.error / submit.error
    }
  };

  const setKind = (k: DigitalKind) =>
    setDraft((d) => {
      const match = (taxons.data || []).find(
        (t) => t.name.toLowerCase() === kindLabel(k, true).toLowerCase()
      );
      return {
        ...d,
        kind: k,
        taxonIds: match && !d.taxonIds.length ? [match.id] : d.taxonIds
      };
    });

  const sourceFor = (f: DraftFile): Blob | string | null => {
    const job = files.jobs.find((j) => j.key === f.key);
    if (job?.file) return job.file;
    const asset = product?.asset?.files.find((x) => x.id === f.existingId);
    return asset?.url || null;
  };

  const stepHasError = (id: StepId) =>
    id === "kind"
      ? errors.kind.length > 0
      : id === "details"
      ? errors.details.length > 0
      : id === "files"
      ? errors.files.length > 0
      : false;

  const manifest = draftManifest(draft, files.jobs as DraftFile[]).manifest;
  const totalBytes = files.jobs.reduce((n, j) => n + j.size, 0);

  return (
    <>
      <PageTitle
        sub={
          product ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <ReviewChip state={product.review_state} />
              {product.live_asset_version && (
                <span className={numCls}>
                  live v{product.live_asset_version}
                </span>
              )}
              {product.slug && product.review_state === "approved" && (
                <Link
                  href={`/${product.slug}`}
                  className="text-white/60 hover:text-white"
                >
                  View in shop
                </Link>
              )}
            </span>
          ) : (
            "Build it step by step. Save a draft any time."
          )
        }
        actions={
          product?.review_state === "draft" ? (
            <button
              type="button"
              className={btnDanger}
              disabled={del.isLoading}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete “${product.name}”? This can't be undone.`
                  )
                )
                  del
                    .mutateAsync(product.id)
                    .then(() => router.push("/creator/products"))
                    .catch(() => undefined);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete draft
            </button>
          ) : undefined
        }
      >
        {product ? product.name || "Untitled" : "New product"}
      </PageTitle>

      {product?.review_note &&
        (state === "changes_requested" || state === "rejected") && (
          <div className="mb-4 rounded-md border border-neon-magenta/40 bg-neon-magenta/[0.06] px-3 py-2">
            <div className="font-title-condensed text-xs text-neon-magenta">
              {REVIEW[state].label}
            </div>
            <p className="font-body text-sm text-white/80">
              {product.review_note}
            </p>
          </div>
        )}
      {locked && (
        <div className="mb-4 rounded-md border border-neon-amber/40 bg-neon-amber/[0.06] px-3 py-2 font-body text-sm text-white/80">
          This product is in review, so it can&apos;t be edited until the review
          is done.
        </div>
      )}
      {state === "approved" && (
        <div className="mb-4 rounded-md border border-glass-border px-3 py-2 font-body text-sm text-white/60">
          This product is live. Changes you submit go through review as a new
          version; buyers keep the live version until it&apos;s approved.
        </div>
      )}
      <ErrorNote error={del.error} />

      {/* Stepper */}
      <ol
        className="mb-4 flex gap-1 overflow-x-auto scrollbar-hide"
        aria-label="Steps"
      >
        {STEPS.map((s, i) => {
          const current = s.id === step;
          const bad = stepHasError(s.id) && i < stepIndex;
          return (
            <li key={s.id} className="flex shrink-0 items-center gap-1">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "h-px w-3 sm:w-6",
                    i <= stepIndex ? "bg-neon-cyan/60" : "bg-white/15"
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => goTo(s.id)}
                disabled={!draft.kind && s.id !== "kind"}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 font-body text-xs transition-colors disabled:opacity-30",
                  current
                    ? "border-neon-cyan/70 bg-neon-cyan/10 text-neon-cyan"
                    : "border-glass-border text-white/60 hover:text-white"
                )}
              >
                <span className={cn(numCls, "text-[11px]")}>{i + 1}</span>
                <span className={cn(!current && "hidden sm:inline")}>
                  {s.label}
                </span>
                {bad && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-neon-pink"
                    aria-label="has problems"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <fieldset disabled={locked} className="min-w-0 space-y-4">
        {step === "kind" && (
          <Section title="What are you making?">
            <div className="grid gap-2 md:grid-cols-3">
              {DIGITAL_KINDS.map((k) => {
                const on = draft.kind === k;
                const lockedKind = !!product && product.kind !== k;
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={lockedKind}
                    onClick={() => {
                      setKind(k);
                      goTo("details");
                    }}
                    aria-pressed={on}
                    className={cn(
                      "rounded-md border p-3 text-left transition-colors disabled:opacity-30",
                      on
                        ? "border-neon-cyan/70 bg-neon-cyan/[0.08]"
                        : "border-glass-border hover:border-white/30"
                    )}
                  >
                    <div className="font-michroma text-xs text-white">
                      {kindLabel(k)}
                    </div>
                    <p className="mt-1 font-body text-sm text-white/65">
                      {KIND_INFO[k].body}
                    </p>
                    <p className="mt-2 font-body text-xs text-white/40">
                      {KIND_INFO[k].files}
                    </p>
                  </button>
                );
              })}
            </div>
            {product && (
              <p className="mt-2 font-body text-xs text-white/40">
                The kind can&apos;t change after a product is created.
              </p>
            )}
          </Section>
        )}

        {step === "details" && (
          <Section title="Details">
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <Field label="Name" htmlFor="pd-name">
                <input
                  id="pd-name"
                  className={inputCls}
                  maxLength={80}
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="Price (USD)"
                htmlFor="pd-price"
                hint="0 makes it free"
              >
                <input
                  id="pd-price"
                  className={cn(inputCls, numCls)}
                  inputMode="decimal"
                  placeholder="4.99"
                  value={draft.price}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      price: e.target.value.replace(/[^0-9.]/g, "")
                    }))
                  }
                />
              </Field>
              <Field
                label="Description"
                htmlFor="pd-desc"
                className="sm:col-span-2"
              >
                <textarea
                  id="pd-desc"
                  className={cn(inputCls, "min-h-[120px] resize-y")}
                  maxLength={4000}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                />
              </Field>
              {(taxons.data?.length || 0) > 0 && (
                <fieldset className="sm:col-span-2">
                  <legend className="mb-1 font-title-condensed text-xs text-white/60">
                    Category
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {taxons.data?.map((t) => {
                      const on = draft.taxonIds.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 font-body text-sm",
                            on
                              ? "border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan"
                              : "border-glass-border text-white/60"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={on}
                            onChange={() =>
                              setDraft((d) => ({
                                ...d,
                                taxonIds: on
                                  ? d.taxonIds.filter((x) => x !== t.id)
                                  : [...d.taxonIds, t.id]
                              }))
                            }
                          />
                          {t.name}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </div>
            <StepProblems list={errors.details} />
          </Section>
        )}

        {step === "files" && draft.kind && (
          <Section
            title={
              draft.kind === "effect_preset"
                ? "Effects"
                : draft.kind === "visualizer"
                ? "Shader"
                : "Samples"
            }
            aside={
              allowed.length ? (
                <span className={`${numCls} text-xs text-white/40`}>
                  {files.jobs.length} files · {formatBytes(totalBytes)}
                </span>
              ) : undefined
            }
          >
            <div className="space-y-4">
              {allowed.length > 0 && (
                <div className="space-y-2">
                  <FileDrop
                    id="pd-files"
                    allowed={allowed}
                    onFiles={files.add}
                    label={
                      draft.kind === "visualizer"
                        ? "Drop your .glsl file or choose"
                        : "Drop audio files or choose"
                    }
                    hint={KIND_INFO[draft.kind].files}
                  />
                  {files.rejected.map((r) => (
                    <p key={r} className="font-body text-xs text-neon-pink">
                      {r}
                    </p>
                  ))}
                  <UploadList
                    jobs={files.jobs}
                    onRemove={files.remove}
                    onRetry={files.retry}
                  />
                </div>
              )}
              {draft.kind === "sample_pack" && (
                <SamplePackEditor
                  draft={draft}
                  setDraft={setDraft}
                  files={files.jobs as DraftFile[]}
                  sourceFor={sourceFor}
                />
              )}
              {draft.kind === "effect_preset" && (
                <EffectPresetEditor draft={draft} setDraft={setDraft} />
              )}
              {draft.kind === "visualizer" && (
                <VisualizerEditor
                  draft={draft}
                  setDraft={setDraft}
                  files={files.jobs as DraftFile[]}
                  sourceFor={sourceFor}
                />
              )}
              <StepProblems list={errors.files} />
            </div>
          </Section>
        )}

        {step === "preview" && (
          <Section title="Preview media">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="font-title-condensed text-xs text-white/60">
                  Cover image
                </div>
                {product?.preview?.image_url && !image.jobs.length && (
                  <img
                    src={product.preview.image_url}
                    alt="Current cover"
                    className="aspect-video w-full rounded-md object-cover"
                  />
                )}
                <FileDrop
                  id="pd-image"
                  allowed={["image"]}
                  multiple={false}
                  onFiles={(fl) => image.add(fl)}
                  disabled={image.jobs.length >= 1}
                  label={
                    product?.preview?.image_url
                      ? "Replace the cover"
                      : "Add a cover"
                  }
                  hint="PNG, JPG or WebP up to 10 MB. 16:9 works best."
                />
                <UploadList
                  jobs={image.jobs}
                  onRemove={image.remove}
                  onRetry={image.retry}
                />
              </div>
              <div className="space-y-2">
                <div className="font-title-condensed text-xs text-white/60">
                  Audio demo (optional)
                </div>
                {product?.preview?.audio_url && !demo.jobs.length && (
                  <audio
                    controls
                    src={product.preview.audio_url}
                    className="w-full"
                  >
                    <track kind="captions" />
                  </audio>
                )}
                <FileDrop
                  id="pd-demo"
                  allowed={["audio"]}
                  multiple={false}
                  onFiles={(fl) => demo.add(fl)}
                  disabled={demo.jobs.length >= 1}
                  label={
                    product?.preview?.audio_url
                      ? "Replace the demo"
                      : "Add a demo"
                  }
                  hint="A short mix that shows it off, up to 50 MB."
                />
                <UploadList
                  jobs={demo.jobs}
                  onRemove={demo.remove}
                  onRetry={demo.retry}
                />
              </div>
            </div>
          </Section>
        )}

        {step === "review" && draft.kind && (
          <Section title="Review and submit">
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 font-body text-sm">
              <dt className="text-white/50">Kind</dt>
              <dd className="text-white">{kindLabel(draft.kind)}</dd>
              <dt className="text-white/50">Name</dt>
              <dd className="text-white">{draft.name || "—"}</dd>
              <dt className="text-white/50">Price</dt>
              <dd className={`${numCls} text-white`}>
                {Number(draft.price) === 0 && draft.price !== ""
                  ? "Free"
                  : formatMoney(draft.price || 0)}
              </dd>
              <dt className="text-white/50">Contents</dt>
              <dd className="text-white">
                {draft.kind === "sample_pack" &&
                  `${(manifest.samples || []).length} samples, ${formatBytes(
                    totalBytes
                  )}`}
                {draft.kind === "effect_preset" &&
                  `${(manifest.effects || []).length} effects`}
                {draft.kind === "visualizer" &&
                  `${manifest.shader || "no shader"}, ${
                    (manifest.params || []).length
                  } parameters`}
              </dd>
              <dt className="text-white/50">Cover</dt>
              <dd className="text-white">
                {image.jobs[0]?.name ||
                  (product?.preview?.image_url ? "Saved" : "None")}
              </dd>
            </dl>

            {errorCount > 0 ? (
              <div className="mt-4 space-y-2">
                {(["kind", "details", "files"] as StepId[]).map((id) => {
                  const list = (errors as any)[id] as string[];
                  if (!list.length) return null;
                  return (
                    <div
                      key={id}
                      className="rounded-md border border-neon-pink/30 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-title-condensed text-xs text-neon-pink">
                          {STEPS.find((s) => s.id === id)?.label}
                        </span>
                        <button
                          type="button"
                          className="font-body text-xs text-white/70 underline"
                          onClick={() => goTo(id)}
                        >
                          Fix
                        </button>
                      </div>
                      <ul className="mt-1 list-disc pl-4">
                        {list.map((e) => (
                          <li
                            key={e}
                            className="font-body text-xs text-white/75"
                          >
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 font-body text-sm text-white/60">
                Ready. After you submit, an admin listens to it, checks it loads
                in the app and puts it live, or sends it back with a note.
              </p>
            )}

            <details className="mt-4 rounded-md border border-glass-border">
              <summary className="cursor-pointer px-3 py-2 font-body text-sm text-white/60">
                Manifest
              </summary>
              <pre className="max-h-72 overflow-auto border-t border-glass-border p-3 font-mono-semibold text-[11px] text-white/70">
                {JSON.stringify(manifest, null, 2)}
              </pre>
            </details>
          </Section>
        )}
      </fieldset>

      <ErrorNote error={save.error} fallback="Saving failed. Try again." />
      <ErrorNote
        error={submit.error}
        fallback="Submitting failed. Try again."
      />

      {/* Footer actions */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex flex-wrap items-center gap-2 border-t border-glass-border bg-surface-deep/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border">
        <button
          type="button"
          className={btnGhost}
          disabled={stepIndex === 0}
          onClick={() => goTo(STEPS[stepIndex - 1].id)}
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        {step !== "review" && (
          <button
            type="button"
            className={btnGhost}
            disabled={!draft.kind}
            onClick={() => goTo(STEPS[stepIndex + 1].id)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
        <span className="ml-auto font-body text-xs text-white/40">
          {dirty ? "Unsaved changes" : product ? "Saved" : ""}
        </span>
        <button
          type="button"
          className={btnGhost}
          disabled={
            locked || !draft.kind || save.isLoading || files.busy || previewBusy
          }
          onClick={onSave}
        >
          {save.isLoading ? "Saving…" : "Save draft"}
        </button>
        {step === "review" && (
          <button
            type="button"
            className={btnPrimary}
            disabled={
              !canSubmit ||
              errorCount > 0 ||
              save.isLoading ||
              submit.isLoading ||
              files.busy ||
              previewBusy
            }
            onClick={onSubmit}
          >
            {submit.isLoading ? "Submitting…" : "Submit for review"}
          </button>
        )}
      </div>
      {state && !canSubmit && step === "review" && !locked && (
        <p className="mt-2 font-body text-xs text-white/45">
          {state === "rejected"
            ? "Rejected products can't be resubmitted. Make a new product instead."
            : `This product is ${REVIEW[
                state
              ].label.toLowerCase()}; change something to submit a new version.`}
        </p>
      )}
      {locked && <Chip className="mt-2">Locked while in review</Chip>}
    </>
  );
};

const StepProblems: React.FC<{ list: string[] }> = ({ list }) =>
  list.length ? (
    <ul className="mt-3 space-y-0.5">
      {list.map((e) => (
        <li key={e} className="font-body text-xs text-neon-amber">
          {e}
        </li>
      ))}
    </ul>
  ) : null;
