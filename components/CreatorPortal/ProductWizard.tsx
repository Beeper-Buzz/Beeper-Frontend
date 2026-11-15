import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";
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
  fileGroupsFor,
  filesChanged,
  presetFile,
  ProductDraft,
  sameManifest,
  saveBlockers,
  stepErrors,
  strayFiles
} from "../../lib/creator/productDraft";
import {
  sceneCheckFrom,
  ScenePreviewState
} from "../../lib/gltfVisualizer/sceneCheck";
import {
  canDelete,
  canEdit,
  canSubmitNow,
  willSubmit
} from "../../lib/creator/reviewRules";
import { extensionOf, uploadFile } from "../../lib/upload/directUpload";
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
import {
  previewStateFor,
  rememberPreview,
  useSceneFile
} from "./editors/gltf/sceneFile";

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
    files:
      "Up to 64 samples (16 load on pads). WAV, AIFF, FLAC or MP3, up to 50 MB each"
  },
  effect_preset: {
    body: "Settings for the app's effects rack, applied in one tap.",
    files: "No files to upload: you set the effects here"
  },
  visualizer: {
    body: "A GLSL shader or a 3D scene that moves with the bass, beat and notes.",
    files: "One .glsl file up to 64 KB, or one .glb scene up to 20 MB"
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

// The files picked in this tab, by name and size, so playback and the
// shader preview keep working after a save remounts the editor on the
// server's copy (whose files have no URLs).
const pickedFiles = new Map<string, File>();
const pickedKey = (name: string, size: number) => `${name}:${size}`;

const existingJobs = (p: CreatorProduct | null): UploadJob[] =>
  (p?.asset?.files || []).map((f) => ({
    key: `existing-${f.id}`,
    name: f.filename,
    size: f.byte_size,
    file: pickedFiles.get(pickedKey(f.filename, f.byte_size)),
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
    () => fileGroupsFor(draft),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.kind, draft.vizType]
  );
  const isScene = draft.kind === "visualizer" && draft.vizType === "gltf";
  const files = useUploadQueue({ allowed, initial: existingJobs(product) });
  const image = useUploadQueue({ allowed: ["image"], max: 1 });
  const demo = useUploadQueue({ allowed: ["audio"], max: 1 });
  useEffect(() => {
    for (const j of files.jobs)
      if (j.file) pickedFiles.set(pickedKey(j.name, j.size), j.file);
  }, [files.jobs]);
  const [shaderErrors, setShaderErrors] = useState<string[]>([]);

  const sourceFor = (f: DraftFile): Blob | string | null => {
    const job = files.jobs.find((j) => j.key === f.key);
    if (job?.file) return job.file;
    const asset = product?.asset?.files.find((x) => x.id === f.existingId);
    return asset?.url || null;
  };

  // A 3D scene's .glb is read and checked here, at every step (not only while the studio is
  // open), and cached per file so the remount after a save keeps the result.
  const glbJob = isScene
    ? files.jobs.find(
        (j) => extensionOf(j.name) === "glb" && j.status !== "error"
      ) || null
    : null;
  const glbSource = glbJob ? sourceFor(glbJob as DraftFile) : null;
  const scene = useSceneFile(glbJob, glbSource);
  const [, bumpPreview] = useReducer((n: number) => n + 1, 0);
  const sceneKey = scene?.key || null;
  const onPreviewStatus = useCallback(
    (s: ScenePreviewState) => {
      if (!sceneKey) return;
      const prev = previewStateFor(sceneKey);
      rememberPreview(sceneKey, {
        loaded: s.loaded || !!prev?.loaded,
        error: s.error
      });
      bumpPreview();
    },
    [sceneKey]
  );
  const gltfScene = glbJob
    ? sceneCheckFrom(scene, previewStateFor(sceneKey))
    : null;
  const [submitNote, setSubmitNote] = useState<string | null>(null);
  const [presetError, setPresetError] = useState<unknown>(null);

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

  const errors = stepErrors(draft, files.jobs as DraftFile[], {
    shaderErrors: draft.kind === "visualizer" ? shaderErrors : [],
    gltfScene: isScene ? gltfScene : null
  });
  const previewBusy = image.busy || demo.busy;
  const errorCount =
    errors.kind.length + errors.details.length + errors.files.length;

  const originalFileIds = product
    ? (product.asset?.files || []).map((f) => f.id)
    : null;
  const manifest = draftManifest(draft, files.jobs as DraftFile[]).manifest;
  const manifestChanged =
    !product || !sameManifest(manifest, product.asset?.manifest);
  // Files or manifest differ from the server's: saving starts a new version.
  const assetDirty =
    draft.kind === "effect_preset"
      ? manifestChanged || !product?.asset?.files.length
      : manifestChanged ||
        filesChanged(files.jobs as DraftFile[], originalFileIds);
  const previewDirty = !!(image.jobs.length || demo.jobs.length);

  const input = (presetSignedId?: string) =>
    draftToInput(draft, files.jobs as DraftFile[], {
      originalFileIds,
      originalManifest: product ? product.asset?.manifest ?? null : undefined,
      previewImageSignedId: image.jobs[0]?.signedId,
      previewAudioSignedId: demo.jobs[0]?.signedId,
      presetSignedId
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

  // In-app navigation away with unsaved changes asks first. Step changes
  // (same page, new ?step=) and our own post-save moves pass through.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const leaving = useRef(false);
  useEffect(() => {
    const onRoute = (url: string) => {
      if (leaving.current || !dirtyRef.current) return;
      const path = (u: string) => u.split(/[?#]/)[0];
      if (path(url) === path(router.asPath)) return;
      if (window.confirm("Leave without saving? Your changes will be lost."))
        return;
      router.events.emit("routeChangeError");
      // Next has no cancel API: throwing aborts the route change.
      throw new Error("Navigation cancelled: unsaved changes");
    };
    router.events.on("routeChangeStart", onRoute);
    return () => {
      try {
        router.events.off("routeChangeStart", onRoute);
      } catch {
        // never throw from cleanup
      }
    };
  }, [router]);

  const state = product?.review_state;
  const editable = !product || canEdit(product);
  const locked = !editable;
  const live = !!product?.live_asset_version;
  const canSubmit = willSubmit(product, {
    asset: assetDirty,
    preview: previewDirty
  });

  const doSave = async (): Promise<CreatorProduct | null> => {
    if (!draft.kind) return null;
    setPresetError(null);
    let presetSignedId: string | undefined;
    if (draft.kind === "effect_preset" && assetDirty) {
      // The preset is the asset's single file: preset.json from the manifest.
      try {
        presetSignedId = (await uploadFile(presetFile(manifest), undefined))
          .signedId;
      } catch (e) {
        setPresetError(e);
        throw e;
      }
    }
    const saved = await save.mutateAsync({
      id: product?.id,
      input: input(presetSignedId)
    });
    baseline.current = null;
    if (!product) {
      leaving.current = true;
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
    setSubmitNote(null);
    doSave().catch(() => undefined);
  };

  const onSubmit = async () => {
    setSubmitNote(null);
    try {
      const saved = dirty || !product ? await doSave() : product;
      if (!saved) return;
      if (!canSubmitNow(saved)) {
        setSubmitNote(
          "Saved. There's nothing new to review: details on a live product change right away."
        );
        return;
      }
      await submit.mutateAsync(saved.id);
      leaving.current = true;
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

  const stepHasError = (id: StepId) =>
    id === "kind"
      ? errors.kind.length > 0
      : id === "details"
      ? errors.details.length > 0
      : id === "files"
      ? errors.files.length > 0
      : false;

  const totalBytes = files.jobs.reduce((n, j) => n + j.size, 0);
  // Files of the other visualizer type (left by switching): the server would refuse them.
  const strayJobs = strayFiles(draft, files.jobs as DraftFile[]) as UploadJob[];
  const blockers = saveBlockers(draft, files.jobs as DraftFile[]);
  const removeStrays = () => strayJobs.forEach((j) => files.remove(j.key));

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
          product && canDelete(product) ? (
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
                    .then(() => {
                      leaving.current = true;
                      return router.push("/creator/products");
                    })
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
          {state === "submitted"
            ? "This product is in review, so it can't be edited until the review is done."
            : "This product was rejected before it went live, so it can't be edited. Start a new product instead."}
        </div>
      )}
      {live && editable && (
        <div className="mb-4 rounded-md border border-glass-border px-3 py-2 font-body text-sm text-white/70">
          This product is live. Name, description, price and category change as
          soon as you save. New files, effect or sample settings, or new preview
          media become a new version for review; buyers keep the live version
          until it&apos;s approved.
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
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 font-body-bold text-xs transition-colors disabled:opacity-30",
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
                  <>
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-neon-pink"
                      aria-hidden
                    />
                    <span className="sr-only">, has problems</span>
                  </>
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
                    <p className="mt-2 font-body-bold text-xs text-white/60">
                      {KIND_INFO[k].files}
                    </p>
                  </button>
                );
              })}
            </div>
            {product && (
              <p className="mt-2 font-body-bold text-xs text-white/60">
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
                hint="At least $0.50"
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
                ? "Scene"
                : "Samples"
            }
            aside={
              allowed.length ? (
                <span className={`${numCls} text-xs text-white/60`}>
                  {files.jobs.length} files · {formatBytes(totalBytes)}
                </span>
              ) : undefined
            }
          >
            <div className="space-y-4">
              {/* Files of the other visualizer type block saving until removed. */}
              {strayJobs.length > 0 && (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-body-bold text-xs text-neon-amber">
                      {isScene
                        ? "A 3D scene uses one .glb and an optional poster. These belong to a shader:"
                        : "A shader visualizer uses .glsl files. These belong to a 3D scene:"}
                    </p>
                    <button
                      type="button"
                      className={cn(btnGhost, "px-2 py-1 text-xs")}
                      onClick={removeStrays}
                    >
                      Remove {strayJobs.length === 1 ? "it" : "them"}
                    </button>
                  </div>
                  {isScene && (
                    <UploadList
                      jobs={strayJobs}
                      onRemove={files.remove}
                      onRetry={files.retry}
                    />
                  )}
                </div>
              )}
              {allowed.length > 0 && !isScene && (
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
                    <p
                      key={r}
                      className="font-body-bold text-xs text-neon-pink"
                    >
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
                  onShaderErrors={setShaderErrors}
                  sceneFiles={{
                    jobs: files.jobs,
                    add: files.add,
                    remove: files.remove,
                    retry: files.retry,
                    rejected: files.rejected
                  }}
                  scene={scene}
                  sceneCheck={gltfScene}
                  onPreviewStatus={onPreviewStatus}
                  typeLocked={!!product}
                />
              )}
              {/* The studio lists its own problems, by field. */}
              {!isScene && <StepProblems list={errors.files} />}
            </div>
          </Section>
        )}

        {step === "preview" && (
          <Section title="Preview media">
            {live && (
              <p className="mb-3 font-body-bold text-xs text-white/70">
                New preview media on a live product go through review too. The
                shop keeps the current ones until then.
              </p>
            )}
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
              <dt className="text-white/60">Kind</dt>
              <dd className="text-white">{kindLabel(draft.kind)}</dd>
              <dt className="text-white/60">Name</dt>
              <dd className="text-white">{draft.name || "—"}</dd>
              <dt className="text-white/60">Price</dt>
              <dd className={`${numCls} text-white`}>
                {formatMoney(draft.price || 0)}
              </dd>
              <dt className="text-white/60">Contents</dt>
              <dd className="text-white">
                {draft.kind === "sample_pack" &&
                  `${(manifest.samples || []).length} samples, ${formatBytes(
                    totalBytes
                  )}`}
                {draft.kind === "effect_preset" &&
                  `${(manifest.effects || []).length} effects`}
                {draft.kind === "visualizer" &&
                  !isScene &&
                  `${manifest.shader || "no shader"}, ${
                    (manifest.params || []).length
                  } parameters`}
                {isScene &&
                  `3D scene ${manifest.scene || "(no .glb yet)"}, ${
                    (manifest.audio?.bindings || []).length
                  } bindings, ${
                    (manifest.audio?.noteClips?.rules || []).length
                  } note rules${manifest.poster ? ", poster" : ""}`}
              </dd>
              <dt className="text-white/60">Cover</dt>
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
                          className="font-body-bold text-xs text-white/70 underline"
                          onClick={() => goTo(id)}
                        >
                          Fix
                        </button>
                      </div>
                      <ul className="mt-1 list-disc pl-4">
                        {list.map((e) => (
                          <li
                            key={e}
                            className="font-body-bold text-xs text-white/75"
                          >
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : canSubmit ? (
              <p className="mt-4 font-body text-sm text-white/70">
                Ready. After you submit, an admin listens to it, checks it loads
                in the app and puts it live, or sends it back with a note.
              </p>
            ) : null}

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

      <ErrorNote
        error={presetError}
        fallback="The preset file didn't upload. Try again."
      />
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
        <span className="ml-auto font-body-bold text-xs text-white/60">
          {dirty ? "Unsaved changes" : product ? "Saved" : ""}
        </span>
        <button
          type="button"
          className={btnGhost}
          disabled={
            locked ||
            !draft.kind ||
            save.isLoading ||
            files.busy ||
            previewBusy ||
            blockers.length > 0
          }
          title={blockers.length ? blockers.join("\n") : undefined}
          onClick={onSave}
        >
          {save.isLoading ? "Saving…" : live ? "Save" : "Save draft"}
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
            {submit.isLoading
              ? "Submitting…"
              : live
              ? "Submit new version"
              : "Submit for review"}
          </button>
        )}
      </div>
      {blockers.length > 0 && !locked && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="font-body-bold text-xs text-neon-amber">
            Saving is off until{" "}
            {strayJobs.length === 1
              ? `${strayJobs[0].name} is removed: it isn't`
              : `${strayJobs.length} files are removed: they aren't`}{" "}
            part of a {isScene ? "3D scene" : "shader"}.
          </p>
          <button
            type="button"
            className={cn(btnGhost, "px-2 py-1 text-xs")}
            onClick={removeStrays}
          >
            Remove {strayJobs.length === 1 ? "it" : "them"}
          </button>
        </div>
      )}
      {submitNote && (
        <p role="status" className="mt-2 font-body-bold text-xs text-white/70">
          {submitNote}
        </p>
      )}
      {product && !canSubmit && step === "review" && !locked && (
        <p className="mt-2 font-body-bold text-xs text-white/60">
          {live
            ? "Nothing to review: change the files, the effect or sample settings, or the preview media to submit a new version. Details save straight to the shop."
            : "Add files before submitting."}
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
        <li key={e} className="font-body-bold text-xs text-neon-amber">
          {e}
        </li>
      ))}
    </ul>
  ) : null;
