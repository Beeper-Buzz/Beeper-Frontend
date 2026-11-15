// What the wizard knows about a 3D scene's .glb, at any step: whether it has been read and
// inspected, and whether the preview has built the rig from it. The wizard blocks Submit on every
// error here; the server re-checks everything (it is the authority), this only keeps creators
// from submitting a scene the app can't load.

import type { GlbInspection } from "./core/glb";
import type { GltfSceneCheck } from "../manifests/visualizer";

export const SCENE_CHECKING = "scene: checking the .glb…";
export const SCENE_DOWNLOAD_FAILED =
  "scene: couldn't download the saved scene to check it; re-pick the file";
export const SCENE_READ_FAILED =
  "scene: couldn't read this .glb; pick it again";
export const SCENE_OPEN_PREVIEW =
  "scene: open the Scene step to load the preview";

/** The cache key of a scene file (the same name:size the wizard keys picked files by). */
export const sceneFileKey = (name: string, size: number): string =>
  `${name}:${size}`;

/** The .glb as read and inspected; `inspection` is null while reading or after a read error. */
export interface SceneFileState {
  key: string;
  bytes: ArrayBuffer | null;
  inspection: GlbInspection | null;
  readError: string | null;
}

/** What the preview learned building the rig from this file: loaded once, or the last error. */
export interface ScenePreviewState {
  loaded: boolean;
  error: string | null;
}

/**
 * The scene check for an attached .glb. In order: still reading, a read error, the inspector's
 * errors, a loader/rig error from the preview, and until the preview has built the rig once, a
 * hint to open the Scene step (three.js may still reject a file the inspector passes).
 */
export function sceneCheckFrom(
  file: SceneFileState | null,
  preview: ScenePreviewState | null
): GltfSceneCheck {
  const none = { summary: null, stats: null };
  if (!file) return { errors: [SCENE_CHECKING], ...none };
  if (file.readError) return { errors: [file.readError], ...none };
  if (!file.inspection) return { errors: [SCENE_CHECKING], ...none };
  const { summary, stats } = file.inspection;
  if (file.inspection.errors.length)
    return { errors: [...file.inspection.errors], summary, stats };
  if (preview?.error) return { errors: [preview.error], summary, stats };
  if (!preview?.loaded) return { errors: [SCENE_OPEN_PREVIEW], summary, stats };
  return { errors: [], summary, stats };
}

/** The messages the studio leaves out of its own list (it shows the preview's progress itself). */
export const STUDIO_HIDDEN = [SCENE_OPEN_PREVIEW];
