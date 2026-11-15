// Live preview of a 3D scene with the shared rig (the same code the app runs): GLTFLoader parses
// the picked bytes, createRig applies the config, and every frame the demo groove's sources and
// note events drive rig.update. The rig's camera renders unless Inspect is on, which hands the
// view to orbit controls on R3F's own camera (so the two never fight).

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
    scene.add(rig.root);
    scene.background = rig.background;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = rig.exposure;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    invalidate();
    return () => {
      scene.remove(rig.root);
      scene.background = null;
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

class CanvasBoundary extends React.Component<
  { children: React.ReactNode; onError: (msg: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    this.props.onError(errText(e));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface PreviewStatus {
  /** A loader or rig error ("<path>: message"), or null. */
  error: string | null;
  /** The key of the config the running rig was built from. */
  builtKey: string | null;
  building: boolean;
}

/**
 * `normalized` + `configKey`: the latest valid config (the studio debounces it). Each config
 * rebuilds from the bytes (rig.dispose frees the loaded geometry and textures); the old rig
 * keeps rendering until the new one is ready. Publishes its handle on live.previewRef.
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
  const [glError, setGlError] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const stateRef = useRef<RootState | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    if (!bytes || !normalized) {
      setBuilt(null);
      onStatusRef.current({ error: null, builtKey: null, building: false });
      return;
    }
    let alive = true;
    const fail = (error: string) =>
      alive && onStatusRef.current({ error, builtKey: null, building: false });
    onStatusRef.current({ error: null, builtKey: null, building: true });
    parseGlb(bytes).then(
      (gltf) => {
        if (!alive) return;
        let rig: Rig;
        try {
          rig = createRig(gltf, normalized, { aspect: 16 / 9 });
        } catch (e) {
          // "<manifest path>: message", as the app's fallback reports it.
          fail(errText(e));
          return;
        }
        const noteClips = normalized.audio.noteClips;
        setBuilt({
          rig,
          tables: compileNoteRules(noteClips),
          pending: new PendingNote(noteClips ? noteClips.priority : "last"),
          normalized,
          key: configKey
        });
        onStatusRef.current({
          error: null,
          builtKey: configKey,
          building: false
        });
      },
      (e) => fail(`scene: three.js couldn't load this file (${errText(e)})`)
    );
    return () => {
      alive = false;
    };
    // configKey identifies `normalized`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bytes, configKey]);

  // The previous rig is disposed once the next one is mounted (or on unmount).
  useEffect(() => {
    const rigRef = live.rigRef;
    rigRef.current = built ? built.rig : null;
    return () => {
      if (!built) return;
      if (rigRef.current === built.rig) rigRef.current = null;
      try {
        built.rig.dispose();
      } catch {
        // never throw from cleanup
      }
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
        if (!s || !built) return null;
        // Render now and read the buffer in the same task (preserveDrawingBuffer as backup).
        s.gl.render(s.scene, inspect ? s.camera : built.rig.camera);
        const canvas = s.gl.domElement;
        for (const q of [0.92, 0.85, 0.75, 0.6]) {
          const blob = await new Promise<Blob | null>((res) =>
            canvas.toBlob(res, "image/jpeg", q)
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
    [built, inspect]
  );

  const glProps = useMemo(
    () => ({ antialias: true, preserveDrawingBuffer: true, alpha: false }),
    []
  );

  return (
    <div
      ref={box}
      className={className}
      style={{
        background: built ? `#${built.rig.background.getHexString()}` : "#000"
      }}
    >
      {glError ? (
        <p className="flex h-full items-center justify-center p-4 text-center font-body-bold text-sm text-white/70">
          WebGL isn&apos;t available here, so there&apos;s no live preview.
        </p>
      ) : (
        <CanvasBoundary onError={setGlError}>
          <Canvas
            frameloop={paused || !visible ? "demand" : "always"}
            dpr={[1, 2]}
            gl={glProps}
            camera={{ fov: 40, near: 0.01, far: 1000, position: [0, 1, 4] }}
          >
            {built && (
              <Stage built={built} inspect={inspect} stateRef={stateRef} />
            )}
          </Canvas>
        </CanvasBoundary>
      )}
    </div>
  );
};
