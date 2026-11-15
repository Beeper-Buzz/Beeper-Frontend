// The 3D-scene studio (spec §9): pick a GLB, inspect it in the browser, preview it live with
// the shared rig driven by the demo groove, and edit the config (bindings, note → clip, idle,
// toon materials, view) with every problem shown next to its control and in one list. Files go
// through the wizard's upload queue (scene .glb + optional poster); the config is the draft's.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  Box,
  Crosshair,
  Download,
  Move3d,
  Pause,
  Play,
  Upload
} from "lucide-react";
import { cn } from "@lib/utils";
import {
  normalizeManifest,
  validateManifest
} from "../../../../lib/gltfVisualizer/core/manifest";
import {
  DemoGroove,
  GrooveEvent
} from "../../../../lib/gltfVisualizer/demoGroove";
import {
  GltfConfig,
  gltfManifest,
  IMPORT_MAX_BYTES,
  parseVisualizerImport,
  targetChoices
} from "../../../../lib/gltfVisualizer/edit";
import {
  SceneFileState,
  ScenePreviewState,
  STUDIO_HIDDEN
} from "../../../../lib/gltfVisualizer/sceneCheck";
import type {
  DraftFile,
  ProductDraft
} from "../../../../lib/creator/productDraft";
import {
  buildGltfVisualizer,
  GltfSceneCheck
} from "../../../../lib/manifests/visualizer";
import { extensionOf } from "../../../../lib/upload/directUpload";
import { formatBytes } from "../../../../lib/marketplace";
import { btnGhost, Chip, numCls } from "../../kit";
import { FileDrop, UploadJob } from "../../uploads";
import { BindingsEditor } from "./BindingsEditor";
import { DrivePanel } from "./DrivePanel";
import { panelTitle, Segmented } from "./fields";
import { GltfPreview, PreviewStatus } from "./GltfPreview";
import { LiveContext, PreviewHandle, StudioLive, useEveryFrame } from "./live";
import { GrooveSound } from "./grooveSound";
import { NoteClipsEditor } from "./NoteClipsEditor";
import { IdleEditor, MaterialsEditor, ViewEditor } from "./SceneSettings";
import { ErrorList, JobState, PosterBox, StatsPanel } from "./SceneStatus";

const POSTER_EXTS = ["png", "jpg", "jpeg", "webp"];
const POSTER_MAX = 2 * 1024 * 1024;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type SettingsTab = "idle" | "materials" | "view";

export const GltfStudio: React.FC<{
  draft: ProductDraft;
  setDraft: (fn: (d: ProductDraft) => ProductDraft) => void;
  jobs: UploadJob[];
  sourceFor: (f: DraftFile) => Blob | string | null;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (key: string) => void;
  onRetryFile: (key: string) => void;
  rejected: string[];
  /** The .glb as the wizard read and inspected it (it checks the scene at every step). */
  scene: SceneFileState | null;
  /** The wizard's scene check (inspection, read and preview errors). */
  sceneCheck: GltfSceneCheck | null;
  /** What the preview learned building the rig: loaded, or a loader/rig error. */
  onPreviewStatus: (s: ScenePreviewState) => void;
}> = ({
  draft,
  setDraft,
  jobs,
  sourceFor,
  onAddFiles,
  onRemoveFile,
  onRetryFile,
  rejected,
  scene,
  sceneCheck,
  onPreviewStatus
}) => {
  const config = draft.gltf;
  const setConfig = useCallback(
    (fn: (c: GltfConfig) => GltfConfig) =>
      setDraft((d) => ({ ...d, gltf: fn(d.gltf) })),
    [setDraft]
  );

  // Live state shared with the panels.
  const [groove] = useState(() => new DemoGroove());
  const [sound] = useState(() => new GrooveSound());
  useEffect(() => () => sound.close(), [sound]);
  const events = useRef<GrooveEvent[]>([]);
  const rigRef = useRef<StudioLive["rigRef"]["current"]>(null);
  const previewRef = useRef<PreviewHandle | null>(null);
  const live = useMemo<StudioLive>(
    () => ({
      groove,
      sound,
      rigRef,
      previewRef,
      drainEvents: () => {
        const out = events.current;
        events.current = [];
        return out;
      }
    }),
    [groove, sound]
  );
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [inspect, setInspect] = useState(false);
  const last = useRef(0);
  useEveryFrame(() => {
    const now = performance.now();
    const dt = last.current ? Math.min(0.1, (now - last.current) / 1000) : 0;
    last.current = now;
    if (paused) return;
    const evs = groove.tick(dt);
    if (!evs.length) return;
    const q = events.current;
    for (const e of evs) {
      q.push(e);
      sound.play(e);
    }
    if (q.length > 64) q.splice(0, q.length - 64);
  });

  // Files: one .glb, one optional poster.
  const present = jobs.filter((j) => j.status !== "error");
  const glbJob = jobs.find((j) => extensionOf(j.name) === "glb") || null;
  const posterJob =
    jobs.find((j) => POSTER_EXTS.includes(extensionOf(j.name))) || null;
  const posterSource = posterJob ? sourceFor(posterJob as DraftFile) : null;
  const posterUrl = typeof posterSource === "string" ? posterSource : null;
  const bytes = scene?.bytes || null;
  const readError = scene?.readError || null;
  const [posterNote, setPosterNote] = useState<string | null>(null);

  const inspection = scene?.inspection || null;
  // three.js only sees files the inspector passed (no external URIs, Draco or over-limit counts).
  const previewBytes = inspection && !inspection.errors.length ? bytes : null;
  const summary = inspection?.summary || null;
  const stats = inspection?.stats || null;
  const choices = useMemo(() => targetChoices(summary), [summary]);

  // What the preview can build: the config with names resolved, debounced.
  const previewManifest = useMemo(() => {
    if (!summary) return null;
    const m = gltfManifest(config, "preview.glb", null);
    if (validateManifest(m, summary).length) return null;
    const normalized = normalizeManifest(m);
    return { normalized, key: JSON.stringify(normalized) };
  }, [config, summary]);
  // While the config has problems, keep playing the last setup that worked for this file.
  const lastGood = useRef<{
    summary: typeof summary;
    pm: typeof previewManifest;
  } | null>(null);
  if (previewManifest) lastGood.current = { summary, pm: previewManifest };
  const shown =
    previewManifest ||
    (lastGood.current && lastGood.current.summary === summary
      ? lastGood.current.pm
      : null);
  const debounced = useDebounced(shown, 250);
  const [status, setStatus] = useState<PreviewStatus>({
    error: null,
    builtKey: null,
    building: false
  });
  const rigCurrent =
    !!previewManifest && status.builtKey === previewManifest.key;
  // The wizard keeps what the preview learned (per file), so Submit knows three.js loads it.
  const onPreviewStatusRef = useRef(onPreviewStatus);
  onPreviewStatusRef.current = onPreviewStatus;
  const onStatus = useCallback((s: PreviewStatus) => {
    setStatus(s);
    if (s.builtKey) onPreviewStatusRef.current({ loaded: true, error: null });
    else if (s.error)
      onPreviewStatusRef.current({ loaded: false, error: s.error });
  }, []);

  // The wizard's check, minus the hint to open this step (the preview shows its own progress).
  const check: GltfSceneCheck | null = useMemo(
    () =>
      sceneCheck && {
        ...sceneCheck,
        errors: sceneCheck.errors.filter((e) => !STUDIO_HIDDEN.includes(e))
      },
    [sceneCheck]
  );

  const attached = present.map((j) => ({ name: j.name, size: j.size }));
  const built = useMemo(
    () => buildGltfVisualizer({ config }, attached, check),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, JSON.stringify(attached), check]
  );
  const errors = built.errors;

  // File actions. A replaced file is removed first; the add waits a tick so the
  // queue's duplicate-name check sees the removal.
  const replace = (old: UploadJob | null, file: File) => {
    if (old) {
      onRemoveFile(old.key);
      setTimeout(() => onAddFiles([file]), 0);
    } else onAddFiles([file]);
  };
  const pickGlb = (list: FileList | File[]) => {
    const f = Array.from(list)[0];
    if (f) replace(glbJob, f);
  };
  const pickPoster = (f: File) => {
    setPosterNote(null);
    if (!POSTER_EXTS.includes(extensionOf(f.name))) {
      setPosterNote("Use a PNG, JPG or WebP image.");
      return;
    }
    if (f.size > POSTER_MAX) {
      setPosterNote(
        `${f.name} is ${formatBytes(f.size)}; a poster can be up to 2 MB.`
      );
      return;
    }
    replace(posterJob, f);
  };
  const capturePoster = async () => {
    setPosterNote(null);
    const blob = await previewRef.current?.capturePoster();
    if (!blob) {
      setPosterNote(
        "Couldn't capture the preview. Try again once the scene shows."
      );
      return;
    }
    replace(posterJob, new File([blob], "poster.jpg", { type: "image/jpeg" }));
  };
  const cameraFromView = () => {
    const v = previewRef.current?.cameraFromView();
    if (!v) return;
    setConfig((c) => {
      const cam = { ...(c.view?.camera || {}) };
      delete cam.node;
      return { ...c, view: { ...(c.view || {}), camera: { ...cam, ...v } } };
    });
  };

  // Import / export visualizer.json (the manifest object).
  const [importNote, setImportNote] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const importJson = async (f: File) => {
    setImportNote(null);
    setImportErrors([]);
    if (f.size > IMPORT_MAX_BYTES) {
      setImportNote(
        `${f.name} is ${formatBytes(
          f.size
        )}; a visualizer.json is at most 256 KB.`
      );
      return;
    }
    let text: string;
    try {
      text = await f.text();
    } catch {
      setImportNote(`Couldn't read ${f.name}.`);
      return;
    }
    const parsed = parseVisualizerImport(text);
    if ("errors" in parsed) {
      setImportNote(`${f.name} wasn't imported:`);
      setImportErrors(parsed.errors);
      return;
    }
    setConfig(() => parsed.config);
    const sceneName = glbJob?.name;
    setImportNote(
      parsed.scene && sceneName && parsed.scene !== sceneName
        ? `Imported. It was written for ${parsed.scene}; this product uses ${sceneName}.`
        : "Imported."
    );
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(built.manifest, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "visualizer.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const [tab, setTab] = useState<SettingsTab>("view");
  const canInspect = !!status.builtKey;
  const fits = inspection && !inspection.errors.length;

  return (
    <LiveContext.Provider value={live}>
      <div className="space-y-3">
        {/* The scene file */}
        {!glbJob ? (
          <FileDrop
            id="gltf-scene"
            allowed={["model"]}
            multiple={false}
            onFiles={pickGlb}
            label="Drop your .glb scene or choose"
            hint="One GLB up to 20 MB with its animations. PNG or JPEG textures; no Draco, meshopt or KTX2. In Blender: File → Export → glTF Binary."
          />
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-glass-border bg-white/[0.02] px-3 py-2">
            <Box className="h-4 w-4 shrink-0 text-neon-cyan" aria-hidden />
            <span className="min-w-0 truncate font-body-bold text-sm text-white">
              {glbJob.name}
            </span>
            <span className={cn(numCls, "text-xs text-white/60")}>
              {formatBytes(glbJob.size)}
            </span>
            {inspection &&
              (fits ? (
                <Chip tone="lime">fits the limits</Chip>
              ) : (
                <Chip tone="pink">
                  {inspection.errors.length} problem
                  {inspection.errors.length === 1 ? "" : "s"}
                </Chip>
              ))}
            {status.building && <Chip tone="cyan">building…</Chip>}
            <span className="ml-auto flex items-center gap-1">
              <label
                className={cn(btnGhost, "cursor-pointer px-2 py-1 text-xs")}
              >
                Replace
                <input
                  type="file"
                  accept=".glb"
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files?.length) pickGlb(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <JobState
                job={glbJob}
                onRetry={onRetryFile}
                onRemove={onRemoveFile}
              />
            </span>
            {glbJob.status === "error" && glbJob.error && (
              <p className="w-full font-body-bold text-xs text-neon-pink">
                {glbJob.error}
              </p>
            )}
          </div>
        )}
        {rejected.map((r) => (
          <p key={r} className="font-body-bold text-xs text-neon-pink">
            {r}
          </p>
        ))}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* Left: preview, poster, stats, problems */}
          <div className="min-w-0 space-y-3 lg:sticky lg:top-4 lg:self-start">
            <div className="overflow-hidden rounded-md border border-glass-border">
              <div className="relative aspect-video w-full">
                <GltfPreview
                  className="absolute inset-0"
                  bytes={previewBytes}
                  normalized={debounced ? debounced.normalized : null}
                  configKey={debounced ? debounced.key : ""}
                  inspect={inspect}
                  paused={paused}
                  onStatus={onStatus}
                />
                {!bytes && (
                  <div className="absolute inset-0 flex items-center justify-center p-4 text-center font-body-bold text-sm text-white/70">
                    {!glbJob
                      ? "Your scene plays here, moving with the demo groove."
                      : readError
                      ? "Couldn't get the scene to check it. Re-pick the .glb with Replace."
                      : "Reading the scene…"}
                  </div>
                )}
                {bytes && inspection && inspection.errors.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center p-4 text-center font-body-bold text-sm text-white/70">
                    This .glb doesn&apos;t fit the rules yet (see Problems), so
                    it isn&apos;t loaded.
                  </div>
                )}
                {bytes && !previewManifest && shown && (
                  <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 font-body-bold text-[11px] text-neon-amber">
                    Showing the last working setup: fix the problems to update
                    it.
                  </div>
                )}
                {previewBytes && !shown && summary && (
                  <div className="absolute inset-0 flex items-center justify-center p-4 text-center font-body-bold text-sm text-white/70">
                    Fix the problems listed below to play the scene.
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-t border-glass-border bg-surface-deep/80 px-2 py-1.5">
                <button
                  type="button"
                  className={cn(btnGhost, "px-2 py-1 text-xs")}
                  onClick={() => setPaused((p) => !p)}
                  aria-pressed={paused}
                >
                  {paused ? (
                    <Play className="h-3.5 w-3.5" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" />
                  )}
                  {paused ? "Play" : "Pause"}
                </button>
                <button
                  type="button"
                  className={cn(
                    btnGhost,
                    "px-2 py-1 text-xs",
                    inspect && "border-neon-cyan/60 text-neon-cyan"
                  )}
                  onClick={() => setInspect((v) => !v)}
                  aria-pressed={inspect}
                  disabled={!canInspect}
                  title="Orbit with the mouse to look around. The rig's camera comes back when you turn it off."
                >
                  <Move3d className="h-3.5 w-3.5" /> Inspect
                </button>
                <button
                  type="button"
                  className={cn(btnGhost, "px-2 py-1 text-xs")}
                  onClick={cameraFromView}
                  disabled={!inspect || !!config.view?.camera?.node}
                  title={
                    config.view?.camera?.node
                      ? "The scene uses its glTF camera"
                      : "Turn on Inspect, frame the shot, then press this to make it the camera"
                  }
                >
                  <Crosshair className="h-3.5 w-3.5" /> Camera from view
                </button>
                {inspect && (
                  <span className="font-body-bold text-[11px] text-white/60">
                    Inspecting: drag to orbit, scroll to zoom
                  </span>
                )}
              </div>
            </div>
            <PosterBox
              job={posterJob}
              url={posterUrl}
              canCapture={rigCurrent || !!status.builtKey}
              onPick={pickPoster}
              onCapture={capturePoster}
              onRetry={onRetryFile}
              onRemove={onRemoveFile}
              note={posterNote}
            />
            {stats && <StatsPanel stats={stats} />}
            <ErrorList errors={errors} />
          </div>

          {/* Right: drive and the config */}
          <div className="min-w-0 space-y-3">
            <DrivePanel />
            <BindingsEditor
              bindings={config.audio.bindings || []}
              onChange={(list) =>
                setConfig((c) => ({
                  ...c,
                  audio: { ...c.audio, bindings: list }
                }))
              }
              errors={errors}
              choices={choices}
              rigCurrent={rigCurrent}
            />
            <NoteClipsEditor
              noteClips={config.audio.noteClips}
              onChange={(nc) =>
                setConfig((c) => {
                  const audio = { ...c.audio };
                  if (nc) audio.noteClips = nc;
                  else delete audio.noteClips;
                  return { ...c, audio };
                })
              }
              errors={errors}
              choices={choices}
            />
            <section className="rounded-md border border-glass-border bg-white/[0.02] p-3">
              <Segmented
                label="Scene settings"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "idle", label: "Idle" },
                  { value: "materials", label: "Materials (toon)" },
                  { value: "view", label: "View" }
                ]}
                className="mb-3"
              />
              {tab === "idle" && (
                <IdleEditor
                  idle={config.audio.idle}
                  onChange={(idle) =>
                    setConfig((c) => {
                      const audio = { ...c.audio };
                      if (idle) audio.idle = idle;
                      else delete audio.idle;
                      return { ...c, audio };
                    })
                  }
                  errors={errors}
                  choices={choices}
                />
              )}
              {tab === "materials" && (
                <MaterialsEditor
                  materials={config.materials}
                  onChange={(materials) =>
                    setConfig((c) => {
                      const next = { ...c };
                      if (materials) next.materials = materials;
                      else delete next.materials;
                      return next;
                    })
                  }
                  errors={errors}
                  choices={choices}
                />
              )}
              {tab === "view" && (
                <ViewEditor
                  view={config.view}
                  onChange={(view) =>
                    setConfig((c) => {
                      const next = { ...c };
                      if (view) next.view = view;
                      else delete next.view;
                      return next;
                    })
                  }
                  errors={errors}
                  choices={choices}
                  onCameraFromView={cameraFromView}
                  canCameraFromView={inspect && !config.view?.camera?.node}
                />
              )}
            </section>
          </div>
        </div>

        {/* Import / export */}
        <div className="flex flex-wrap items-center gap-2 border-t border-glass-border pt-3">
          <span className={panelTitle}>visualizer.json</span>
          <label className={cn(btnGhost, "cursor-pointer px-2 py-1 text-xs")}>
            <Upload className="h-3.5 w-3.5" aria-hidden /> Import
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className={cn(btnGhost, "px-2 py-1 text-xs")}
            onClick={exportJson}
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Export
          </button>
          {importNote && (
            <span
              role="status"
              className="font-body-bold text-xs text-white/70"
            >
              {importNote}
            </span>
          )}
          {importErrors.length > 0 && (
            <ul className="w-full space-y-0.5">
              {importErrors.map((e) => (
                <li key={e} className="font-body-bold text-xs text-neon-pink">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </LiveContext.Provider>
  );
};

export default GltfStudio;
