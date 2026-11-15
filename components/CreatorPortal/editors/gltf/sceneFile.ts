// The wizard's view of a 3D scene's .glb at every step (not just while the studio is open): the
// bytes, read once per file, and the shared inspector's result. Module caches keyed by name:size
// (like the wizard's picked files) survive the remount after each save, so a saved scene isn't
// read or checked again, and what the preview learned about it isn't lost.
//
// No three.js here: the wizard imports this, and three loads only with the studio.

import { useEffect, useState } from "react";
import { inspectGlb } from "../../../../lib/gltfVisualizer/core/glb";
import {
  SCENE_DOWNLOAD_FAILED,
  SCENE_READ_FAILED,
  sceneFileKey,
  SceneFileState,
  ScenePreviewState
} from "../../../../lib/gltfVisualizer/sceneCheck";

type Source = Blob | string | null;

const MAX_FILES = 2; // the current scene and the one it replaced, at up to 20 MB each
const files = new Map<
  string,
  { source: Blob | string; state: SceneFileState }
>();
const previews = new Map<string, ScenePreviewState>();

function remember(key: string, source: Blob | string, state: SceneFileState) {
  files.delete(key);
  files.set(key, { source, state });
  while (files.size > MAX_FILES) {
    const oldest = files.keys().next().value as string;
    files.delete(oldest);
  }
}

/** A cached read applies unless a different picked file now has the same name and size. */
function cachedFor(key: string, source: Source): SceneFileState | null {
  const c = files.get(key);
  if (!c) return null;
  if (
    typeof Blob !== "undefined" &&
    source instanceof Blob &&
    c.source !== source
  )
    return null;
  return c.state;
}

/** What the preview last learned building this file's rig (null: never opened). */
export const previewStateFor = (key: string | null): ScenePreviewState | null =>
  (key && previews.get(key)) || null;

export function rememberPreview(key: string, s: ScenePreviewState): void {
  previews.set(key, s);
}

/**
 * The .glb's bytes and inspection: null when there's no file; `inspection` null while reading.
 * A saved scene with no local copy is downloaded from its URL; when that fails (an expired link,
 * CORS), the state carries a read error asking to re-pick the file.
 */
export function useSceneFile(
  file: { name: string; size: number } | null,
  source: Source
): SceneFileState | null {
  const key = file ? sceneFileKey(file.name, file.size) : null;
  const hit = key ? cachedFor(key, source) : null;
  const [state, setState] = useState<SceneFileState | null>(hit);

  useEffect(() => {
    if (!key) return;
    const cached = cachedFor(key, source);
    if (cached) {
      setState(cached);
      return;
    }
    if (!source) {
      setState({
        key,
        bytes: null,
        inspection: null,
        readError: SCENE_DOWNLOAD_FAILED
      });
      return;
    }
    let alive = true;
    setState({ key, bytes: null, inspection: null, readError: null });
    const read =
      typeof source === "string"
        ? fetch(source).then((r) => {
            if (!r.ok) throw new Error(String(r.status));
            return r.arrayBuffer();
          })
        : source.arrayBuffer();
    read.then(
      (bytes) => {
        const st: SceneFileState = {
          key,
          bytes,
          inspection: inspectGlb(new Uint8Array(bytes)),
          readError: null
        };
        remember(key, source, st);
        if (alive) setState(st);
      },
      () =>
        alive &&
        setState({
          key,
          bytes: null,
          inspection: null,
          readError:
            typeof source === "string"
              ? SCENE_DOWNLOAD_FAILED
              : SCENE_READ_FAILED
        })
    );
    return () => {
      alive = false;
    };
  }, [key, source]);

  if (!key) return null;
  // A new file: never the previous file's result (reading starts in the effect).
  return state && state.key === key ? state : hit;
}
