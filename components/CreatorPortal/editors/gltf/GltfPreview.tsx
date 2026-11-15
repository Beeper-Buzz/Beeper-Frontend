// Live preview of a 3D scene with the shared rig (the same code the app runs): GLTFLoader parses
// the picked bytes, createRig applies the config, and every frame the demo groove's sources and
// note events drive rig.update. The rig's camera renders unless Inspect is on, which hands the
// view to orbit controls on R3F's own camera (so the two never fight).
//
// The rig mutates what it's given (toon materials, its own disposal) and resolves names through
// the loader's associations, so it can't be rebuilt on a clone: each config parses the bytes
// again. One build runs at a time; edits made meanwhile collapse to the latest, and every parse
// that doesn't become the shown rig is disposed (geometry, materials, textures, ImageBitmaps).

import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { Canvas, RootState, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  createRig,
  GltfLike,
  Rig
} from "../../../../lib/gltfVisualizer/core/rig";
import type { NormalizedGltfManifest } from "../../../../lib/gltfVisualizer/core/manifest";
import {
  compileNoteRules,
  NoteRuleTables,
  offerNoteEvent,
  PendingNote
} from "../../../../lib/gltfVisualizer/core/noteClips";
import { cameraFromView } from "../../../../lib/gltfVisualizer/edit";
import { useLive } from "./live";

const POSTER_MAX = 2 * 1024 * 1024;

interface Built {
  rig: Rig;
  tables: NoteRuleTables;
  pending: PendingNote;
  normalized: NormalizedGltfManifest;
  key: string;
  /** Mounted in the canvas scene: the Stage disposes it after removing it. */
  staged: boolean;
  /** Disposes the rig once. */
  dispose: () => void;
}

const errText = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "unknown error";

/** Parses GLB bytes with three's loader (textures decode in the browser). */
const parseGlb = (bytes: ArrayBuffer): Promise<GltfLike> =>
  new Promise((resolve, reject) =>
    new GLTFLoader().parse(
      bytes,
      "",
      (gltf) => resolve(gltf as unknown as GltfLike),
      (e) => reject(e)
    )
  );

/** Frees a parsed glTF that never became (or no longer is) a rig. */
function disposeGltf(gltf: GltfLike): void {
  try {
    const textures = new Set<THREE.Texture>();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = mesh.material
        ? Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]
        : [];
      for (const m of mats) {
        for (const v of Object.values(m))
          if (v instanceof THREE.Texture) textures.add(v);
        m.dispose();
      }
    });
    textures.forEach((t) => {
      const img = t.image as { close?: () => void } | null;
      if (img && typeof img.close === "function") img.close();
      t.dispose();
    });
  } catch {
    // best effort: never throw while cleaning up
  }
}

/** Inside the Canvas: mounts the rig, drives it, renders with its camera or the inspect one. */
const Stage: React.FC<{
  built: Built;
  inspect: boolean;
  stateRef: React.MutableRefObject<RootState | null>;
}> = ({ built, inspect, stateRef }) => {
  const live = useLive();
  const state = useThree();
  const { gl, scene, size, camera, invalidate } = state;
  const controls = useRef<{ target: THREE.Vector3; update(): void } | null>(
    null
  );
  stateRef.current = state;

  useEffect(() => {
    const { rig } = built;
    built.staged = true;
    scene.add(rig.root);
    scene.background = rig.background;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = rig.exposure;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    invalidate();
    return () => {
      scene.remove(rig.root);
      scene.background = null;
      built.staged = false;
      // Out of the scene first, so no frame draws a disposed rig.
      built.dispose();
    };
  }, [built, gl, scene, invalidate]);

  useEffect(() => {
    if (size.height > 0) built.rig.setAspect(size.width / size.height);
    invalidate();
  }, [built, size.width, size.height, invalidate]);

  // Inspect starts from the rig camera's view, orbiting the scene centre.
  useEffect(() => {
    if (!inspect) return;
    const cam = camera as THREE.PerspectiveCamera;
    const src = built.rig.camera;
    cam.position.copy(src.position);
    cam.quaternion.copy(src.quaternion);
    cam.fov = src.fov;
    cam.near = src.near;
    cam.far = src.far;
    cam.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.copy(built.rig.center);
      controls.current.update();
    }
    invalidate();
  }, [inspect, built, camera, invalidate]);

  useFrame((s, dt) => {
    const { rig, tables, pending } = built;
    const events = live.drainEvents();
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      offerNoteEvent(tables, pending, e.part, e.note, e.velocity, true);
    }
    rig.update(dt, live.groove.sources, live.groove.transport, pending);
    s.gl.render(s.scene, inspect ? s.camera : rig.camera);
  }, 1);

  return (
    <OrbitControls
      // drei types the ref as three-stdlib's class; only target + update are used.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={controls as any}
      enabled={inspect}
      enablePan={false}
      makeDefault
    />
  );
};

const NO_WEBGL = /webgl|context|gpu/i;

/** Catches the canvas's errors: says WebGL is unavailable only when it is, else offers a retry. */
class CanvasBoundary extends React.Component<
  { children: React.ReactNode; onRetry: () => void },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: errText(e) };
  }
  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center font-body-bold text-sm text-white/70">
        {NO_WEBGL.test(error) ? (
          <p>
            WebGL isn&apos;t available here, so there&apos;s no live preview.
          </p>
        ) : (
          <p>The preview stopped: {error}</p>
        )}
        <button
          type="button"
          className="rounded border border-glass-border px-2 py-1 text-xs text-white/80 hover:text-white"
          onClick={() => {
            this.setState({ error: null });
            this.props.onRetry();
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

export interface PreviewStatus {
  /** A loader or rig error ("<path>: message"), or null. */
  error: string | null;
  /** The key of the config the running rig was built from. */
  builtKey: string | null;
  building: boolean;
}

interface Job {
  bytes: ArrayBuffer;
  normalized: NormalizedGltfManifest;
  key: string;
}

/**
 * `bytes`: the .glb, only once the inspector passed it. `normalized` + `configKey`: the latest
 * valid config (the studio debounces it). The old rig keeps rendering until the new one is
 * ready. Publishes its handle on live.previewRef.
 */
export const GltfPreview: React.FC<{
  bytes: ArrayBuffer | null;
  normalized: NormalizedGltfManifest | null;
  configKey: string;
  inspect: boolean;
  paused: boolean;
  onStatus: (s: PreviewStatus) => void;
  className?: string;
}> = ({
  bytes,
  normalized,
  configKey,
  inspect,
  paused,
  onStatus,
  className
}) => {
  const live = useLive();
  const [built, setBuilt] = useState<Built | null>(null);
  const [visible, setVisible] = useState(true);
  const [lost, setLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const stateRef = useRef<RootState | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  // The build queue: at most one parse in flight, and only the latest wanted config after it.
  const queue = useRef<{ want: Job | null; busy: boolean; alive: boolean }>({
    want: null,
    busy: false,
    alive: true
  });
  const run = useRef<() => void>(() => undefined);
  run.current = () => {
    const q = queue.current;
    if (q.busy || !q.want || !q.alive) return;
    const job = q.want;
    q.want = null;
    q.busy = true;
    onStatusRef.current({ error: null, builtKey: null, building: true });
    parseGlb(job.bytes).then(
      (gltf) => {
        q.busy = false;
        // Unmounted, or a newer config is waiting: this parse is stale.
        if (!q.alive || q.want) {
          disposeGltf(gltf);
          run.current();
          return;
        }
        let rig: Rig;
        try {
          rig = createRig(gltf, job.normalized, { aspect: 16 / 9 });
        } catch (e) {
          disposeGltf(gltf);
          // "<manifest path>: message", as the app's fallback reports it.
          onStatusRef.current({
            error: errText(e),
            builtKey: null,
            building: false
          });
          return;
        }
        let disposed = false;
        const noteClips = job.normalized.audio.noteClips;
        setBuilt({
          rig,
          tables: compileNoteRules(noteClips),
          pending: new PendingNote(noteClips ? noteClips.priority : "last"),
          normalized: job.normalized,
          key: job.key,
          staged: false,
          dispose: () => {
            if (disposed) return;
            disposed = true;
            try {
              rig.dispose();
            } catch {
              // never throw from cleanup
            }
          }
        });
        onStatusRef.current({
          error: null,
          builtKey: job.key,
          building: false
        });
      },
      (e) => {
        q.busy = false;
        if (!q.alive) return;
        if (q.want) {
          run.current();
          return;
        }
        onStatusRef.current({
          error: `scene: three.js couldn't load this file (${errText(e)})`,
          builtKey: null,
          building: false
        });
      }
    );
  };

  useEffect(() => {
    const q = queue.current;
    q.alive = true;
    return () => {
      q.alive = false;
      q.want = null;
    };
  }, []);

  useEffect(() => {
    const q = queue.current;
    if (!bytes || !normalized) {
      q.want = null;
      setBuilt(null);
      onStatusRef.current({ error: null, builtKey: null, building: false });
      return;
    }
    q.want = { bytes, normalized, key: configKey };
    run.current();
    // configKey identifies `normalized`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bytes, configKey]);

  // The rig the meters read. A replaced rig is disposed by the Stage once it's out of the scene;
  // one that never reached the canvas (no WebGL) is disposed here.
  const current = useRef<Built | null>(null);
  current.current = built;
  useEffect(() => {
    const rigRef = live.rigRef;
    rigRef.current = built ? built.rig : null;
    return () => {
      if (!built) return;
      if (rigRef.current === built.rig) rigRef.current = null;
      // Checked a moment later (StrictMode re-runs effects on the same rig): unmounted, or
      // replaced and never in (or already out of) the scene.
      setTimeout(() => {
        const q = queue.current;
        if (!q.alive) built.dispose();
        else if (current.current !== built && !built.staged) built.dispose();
      }, 1500);
    };
  }, [built, live.rigRef]);

  // Pause off screen.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting)
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useImperativeHandle(
    live.previewRef,
    () => ({
      capturePoster: async () => {
        const s = stateRef.current;
        if (!s || !built || lost) return null;
        // Render and copy in the same task: the drawing buffer is only valid until the browser
        // composites it (no preserveDrawingBuffer).
        s.gl.render(s.scene, inspect ? s.camera : built.rig.camera);
        const src = s.gl.domElement;
        const copy = document.createElement("canvas");
        copy.width = src.width;
        copy.height = src.height;
        const ctx = copy.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(src, 0, 0);
        for (const q of [0.92, 0.85, 0.75, 0.6]) {
          const blob = await new Promise<Blob | null>((res) =>
            copy.toBlob(res, "image/jpeg", q)
          );
          if (blob && blob.size <= POSTER_MAX) return blob;
        }
        return null;
      },
      cameraFromView: () => {
        const s = stateRef.current;
        if (!s || !built || !inspect) return null;
        const rig = built.rig;
        return cameraFromView(
          s.camera.position,
          rig.center,
          rig.camera.position.distanceTo(rig.center),
          built.normalized.view.camera.distance
        );
      }
    }),
    [built, inspect, lost]
  );

  const glProps = useMemo(() => ({ antialias: true, alpha: false }), []);

  return (
    <div
      ref={box}
      className={className}
      style={{
        background: built ? `#${built.rig.background.getHexString()}` : "#000"
      }}
    >
      <CanvasBoundary onRetry={() => setCanvasKey((k) => k + 1)}>
        <Canvas
          key={canvasKey}
          frameloop={paused || !visible || lost ? "demand" : "always"}
          dpr={[1, 2]}
          gl={glProps}
          camera={{ fov: 40, near: 0.01, far: 1000, position: [0, 1, 4] }}
          onCreated={(st) => {
            const c = st.gl.domElement;
            // three restores its own state; the preview just waits and redraws.
            c.addEventListener("webglcontextlost", () => setLost(true));
            c.addEventListener("webglcontextrestored", () => {
              setLost(false);
              st.invalidate();
            });
          }}
        >
          {built && (
            <Stage built={built} inspect={inspect} stateRef={stateRef} />
          )}
        </Canvas>
      </CanvasBoundary>
      {lost && (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center font-body-bold text-sm text-white/70">
          The graphics card reset the preview; it comes back when the browser
          restores it.
        </p>
      )}
    </div>
  );
};
