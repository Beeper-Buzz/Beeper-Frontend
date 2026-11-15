// The product editor's state, and the conversions to and from the creator
// products API (spec §1.3). Pure: the wizard holds a ProductDraft plus the
// upload list, and turns them into a request body here.

import type { DigitalKind } from "../marketplace";
import type { CreatorProduct, CreatorProductInput } from "./types";
import { buildSamplePack, SampleDraft } from "../manifests/samplePack";
import { buildEffectPreset, EffectEntry } from "../manifests/effectPreset";
import {
  buildGltfVisualizer,
  buildVisualizer,
  GltfSceneCheck,
  vizSceneTypeOf,
  VizParamDraft,
  VizSceneType
} from "../manifests/visualizer";
import {
  configFromManifest,
  emptyGltfConfig,
  GltfConfig
} from "../gltfVisualizer/edit";
import { extensionOf, UploadGroup } from "../upload/directUpload";

export interface DraftFile {
  key: string;
  name: string;
  size: number;
  status: "queued" | "uploading" | "done" | "error";
  signedId?: string;
  existingId?: number;
}

export type SampleSettings = Omit<SampleDraft, "file">;

export interface ProductDraft {
  kind: DigitalKind | null;
  name: string;
  description: string;
  price: string;
  taxonIds: number[];
  // sample_pack
  packId: string;
  bpm: string;
  samples: Record<string, SampleSettings>;
  // effect_preset
  effects: EffectEntry[];
  // visualizer
  vizType: VizSceneType;
  shader: string;
  vizParams: VizParamDraft[];
  /** vizType "gltf": the 3D scene's config (the manifest minus envelope and files). */
  gltf: GltfConfig;
}

export const emptyDraft = (): ProductDraft => ({
  kind: null,
  name: "",
  description: "",
  price: "",
  taxonIds: [],
  packId: "",
  bpm: "",
  samples: {},
  effects: [],
  vizType: "shader",
  shader: "",
  vizParams: [],
  gltf: emptyGltfConfig()
});

/** Which uploads each kind's file step accepts. */
export const FILE_GROUPS: Record<DigitalKind, UploadGroup[]> = {
  sample_pack: ["audio"],
  effect_preset: [],
  visualizer: ["text"]
};

/** The upload groups of a draft's file step (a 3D scene takes a .glb and a poster). */
export const fileGroupsFor = (d: ProductDraft): UploadGroup[] =>
  !d.kind
    ? []
    : d.kind === "visualizer" && d.vizType === "gltf"
    ? ["model", "image"]
    : FILE_GROUPS[d.kind];

export function draftFromProduct(p: CreatorProduct): ProductDraft {
  const d = emptyDraft();
  const m = (p.asset?.manifest || {}) as Record<string, any>;
  d.kind = p.kind;
  d.name = p.name || "";
  d.description = p.description || "";
  d.price = p.price === null || p.price === undefined ? "" : String(p.price);
  d.taxonIds = p.taxon_ids || [];
  if (p.kind === "sample_pack") {
    d.packId = m.pack_id || "";
    d.bpm = m.bpm !== undefined ? String(m.bpm) : "";
    for (const s of (m.samples || []) as SampleDraft[]) {
      if (!s?.file) continue;
      const { file, ...rest } = s;
      d.samples[file] = rest;
    }
  } else if (p.kind === "effect_preset") {
    d.effects = Array.isArray(m.effects) ? m.effects : [];
  } else if (p.kind === "visualizer") {
    d.vizType = vizSceneTypeOf(m);
    if (d.vizType === "gltf") {
      d.gltf = configFromManifest(m);
    } else {
      d.shader = m.shader || "";
      d.vizParams = Array.isArray(m.params) ? m.params : [];
    }
  }
  return d;
}

const usable = (files: DraftFile[]) =>
  files.filter((f) => f.status === "done" && (f.signedId || f.existingId));

/** Creators can't sell for less than this; free products are admin-only. */
export const MIN_PRICE = 0.5;
export const MAX_PRICE = 999;

export function draftManifest(
  d: ProductDraft,
  files: DraftFile[],
  /** vizType "gltf": the picked GLB's inspection, so names are checked too. */
  gltfScene: GltfSceneCheck | null = null
): {
  manifest: Record<string, any>;
  errors: string[];
  rowErrors?: Record<string, string[]>;
} {
  const names = usable(files).map((f) => f.name);
  switch (d.kind) {
    case "sample_pack": {
      const bpm = d.bpm.trim() ? Number(d.bpm) : undefined;
      return buildSamplePack(
        {
          pack_id: d.packId.trim() || undefined,
          bpm,
          samples: names.map((file) => ({ file, ...(d.samples[file] || {}) }))
        },
        names
      );
    }
    case "effect_preset":
      return buildEffectPreset(d.effects);
    case "visualizer": {
      if (d.vizType === "gltf") {
        const attached = usable(files).map((f) => ({
          name: f.name,
          size: f.size
        }));
        return buildGltfVisualizer({ config: d.gltf }, attached, gltfScene);
      }
      const glsl = names.filter((n) => extensionOf(n) === "glsl");
      const shader =
        d.shader && glsl.includes(d.shader) ? d.shader : glsl[0] || "";
      return buildVisualizer({ shader, params: d.vizParams }, names);
    }
    default:
      return { manifest: {}, errors: ["pick what you're making"] };
  }
}

/** The upload list differs from the asset's files as loaded. */
export function filesChanged(
  files: DraftFile[],
  originalFileIds: number[] | null
): boolean {
  const ready = usable(files);
  if (originalFileIds === null) return ready.length > 0;
  const kept = ready
    .filter((f) => !f.signedId && f.existingId !== undefined)
    .map((f) => f.existingId as number);
  return (
    ready.some((f) => f.signedId) ||
    kept.length !== originalFileIds.length ||
    !kept.every((id) => originalFileIds.includes(id))
  );
}

export function draftToInput(
  d: ProductDraft,
  files: DraftFile[],
  {
    originalFileIds,
    originalManifest,
    previewImageSignedId,
    previewAudioSignedId,
    presetSignedId
  }: {
    /** The asset's file ids as loaded; null for a new product. */
    originalFileIds: number[] | null;
    /**
     * The asset's manifest as loaded. On update, the manifest is sent only
     * when it differs: the server treats any manifest (or kind) in a PATCH as
     * a new version for review, so a live product's details-only edit must
     * leave both out. Undefined: always send it.
     */
    originalManifest?: Record<string, any> | null;
    previewImageSignedId?: string | null;
    previewAudioSignedId?: string | null;
    /** effect_preset: a freshly uploaded preset.json, when the preset changed. */
    presetSignedId?: string | null;
  }
): CreatorProductInput {
  const ready = usable(files);
  const isNew = originalFileIds === null;
  const manifest = draftManifest(d, files).manifest;
  const input: CreatorProductInput = {
    name: d.name.trim(),
    description: d.description.trim(),
    price: Math.round(Number(d.price || 0) * 100) / 100,
    taxon_ids: d.taxonIds
  };
  if (isNew) input.kind = d.kind as DigitalKind;
  if (
    isNew ||
    originalManifest === undefined ||
    !sameManifest(manifest, originalManifest)
  )
    input.manifest = manifest;
  if (previewImageSignedId)
    input.preview_image_signed_id = previewImageSignedId;
  if (previewAudioSignedId)
    input.preview_audio_signed_id = previewAudioSignedId;

  // An effect preset's only file is its preset.json, uploaded on save when
  // the preset changed; it replaces whatever the draft had.
  if (d.kind === "effect_preset") {
    if (presetSignedId) {
      input.files = [presetSignedId];
      if (originalFileIds !== null) input.keep_file_ids = [];
    }
    return input;
  }

  const added = ready
    .filter((f) => f.signedId)
    .map((f) => f.signedId as string);
  const kept = ready
    .filter((f) => !f.signedId && f.existingId !== undefined)
    .map((f) => f.existingId as number);
  if (filesChanged(files, originalFileIds) || isNew) {
    input.files = added;
    if (originalFileIds !== null) input.keep_file_ids = kept;
  }
  return input;
}

/** effect_preset: the manifest as the asset's file. */
export const presetFile = (manifest: Record<string, any>): File =>
  new File([JSON.stringify(manifest, null, 2)], "preset.json", {
    type: "application/json"
  });

const sortKeys = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v && typeof v === "object"
    ? Object.fromEntries(
        Object.keys(v as object)
          .sort()
          .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])])
      )
    : v;

/**
 * Same manifest, ignoring key order (the server stores JSONB) and the
 * server-owned `files` key.
 */
export function sameManifest(
  a: Record<string, any> | null | undefined,
  b: Record<string, any> | null | undefined
): boolean {
  const strip = (m: Record<string, any> | null | undefined) => {
    const { files: _files, ...rest } = m || {};
    return JSON.stringify(sortKeys(rest));
  };
  return strip(a) === strip(b);
}

const GENERAL_WORDS: Record<string, string> = {
  "pack_id invalid": "Pack id must be 3 to 40 of a-z, 0-9 and -.",
  "bpm must be a number": "Tempo must be a number.",
  "samples must have 1..64 entries": "Add 1 to 64 samples."
};

export interface StepErrors {
  kind: string[];
  details: string[];
  files: string[];
  preview: string[];
}

export function stepErrors(
  d: ProductDraft,
  files: DraftFile[],
  extra: {
    /** checkShaderSource() of the visualizer's shader, once it's been read. */
    shaderErrors?: string[];
    /** A 3D scene's GLB inspection (and loader errors), once it's been read. */
    gltfScene?: GltfSceneCheck | null;
  } = {}
): StepErrors {
  const details: string[] = [];
  if (!d.name.trim()) details.push("Name the product.");
  const price = Number(d.price);
  if (d.price.trim() === "" || !Number.isFinite(price) || price < MIN_PRICE)
    details.push("Price must be at least $0.50.");
  else if (price > MAX_PRICE) details.push("Price must be $999 or less.");

  const fileErrors: string[] = [];
  if (files.some((f) => f.status === "queued" || f.status === "uploading"))
    fileErrors.push("Wait for uploads to finish.");
  if (files.some((f) => f.status === "error"))
    fileErrors.push("Retry or remove the files that failed.");
  if (d.kind) {
    const built = draftManifest(d, files, extra.gltfScene || null);
    if (built.rowErrors) {
      // Sample packs: say it per file, in words.
      for (const e of built.errors) {
        if (/^samples\[\d+\]|^file "/.test(e)) continue;
        fileErrors.push(GENERAL_WORDS[e] || e);
      }
      for (const [file, list] of Object.entries(built.rowErrors))
        for (const m of list) fileErrors.push(`${file}: ${m}`);
    } else {
      fileErrors.push(...built.errors);
    }
    if (
      d.kind === "visualizer" &&
      d.vizType !== "gltf" &&
      extra.shaderErrors?.length
    ) {
      const shader = built.manifest.shader || "shader";
      for (const e of extra.shaderErrors) fileErrors.push(`${shader}: ${e}`);
    }
  }

  return {
    kind: d.kind ? [] : ["Pick what you're making."],
    details,
    files: fileErrors,
    preview: []
  };
}
