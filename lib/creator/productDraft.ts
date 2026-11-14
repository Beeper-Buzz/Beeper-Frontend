// The product editor's state, and the conversions to and from the creator
// products API (spec §1.3). Pure: the wizard holds a ProductDraft plus the
// upload list, and turns them into a request body here.

import type { DigitalKind } from "../marketplace";
import type { CreatorProduct, CreatorProductInput } from "./types";
import { buildSamplePack, SampleDraft } from "../manifests/samplePack";
import { buildEffectPreset, EffectEntry } from "../manifests/effectPreset";
import { buildVisualizer, VizParamDraft } from "../manifests/visualizer";
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
  shader: string;
  vizParams: VizParamDraft[];
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
  shader: "",
  vizParams: []
});

/** Which uploads each kind's file step accepts. */
export const FILE_GROUPS: Record<DigitalKind, UploadGroup[]> = {
  sample_pack: ["audio"],
  effect_preset: [],
  visualizer: ["text"]
};

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
    d.shader = m.shader || "";
    d.vizParams = Array.isArray(m.params) ? m.params : [];
  }
  return d;
}

const usable = (files: DraftFile[]) =>
  files.filter((f) => f.status === "done" && (f.signedId || f.existingId));

export function draftManifest(
  d: ProductDraft,
  files: DraftFile[]
): { manifest: Record<string, any>; errors: string[] } {
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
      const glsl = names.filter((n) => extensionOf(n) === "glsl");
      const shader =
        d.shader && glsl.includes(d.shader) ? d.shader : glsl[0] || "";
      return buildVisualizer({ shader, params: d.vizParams }, names);
    }
    default:
      return { manifest: {}, errors: ["pick what you're making"] };
  }
}

export function draftToInput(
  d: ProductDraft,
  files: DraftFile[],
  {
    originalFileIds,
    previewImageSignedId,
    previewAudioSignedId
  }: {
    /** The asset's file ids as loaded; null for a new product. */
    originalFileIds: number[] | null;
    previewImageSignedId?: string | null;
    previewAudioSignedId?: string | null;
  }
): CreatorProductInput {
  const ready = usable(files);
  const input: CreatorProductInput = {
    name: d.name.trim(),
    description: d.description.trim(),
    price: Math.round(Number(d.price || 0) * 100) / 100,
    kind: d.kind as DigitalKind,
    taxon_ids: d.taxonIds,
    manifest: draftManifest(d, files).manifest
  };
  if (previewImageSignedId)
    input.preview_image_signed_id = previewImageSignedId;
  if (previewAudioSignedId)
    input.preview_audio_signed_id = previewAudioSignedId;

  const added = ready
    .filter((f) => f.signedId)
    .map((f) => f.signedId as string);
  const kept = ready
    .filter((f) => !f.signedId && f.existingId !== undefined)
    .map((f) => f.existingId as number);
  const unchanged =
    originalFileIds !== null &&
    added.length === 0 &&
    kept.length === originalFileIds.length &&
    kept.every((id) => originalFileIds.includes(id));
  if (!unchanged) {
    input.files = added;
    if (originalFileIds !== null) input.keep_file_ids = kept;
  }
  return input;
}

export interface StepErrors {
  kind: string[];
  details: string[];
  files: string[];
  preview: string[];
}

export function stepErrors(d: ProductDraft, files: DraftFile[]): StepErrors {
  const details: string[] = [];
  if (!d.name.trim()) details.push("Name the product.");
  const price = Number(d.price);
  if (d.price.trim() === "" || !Number.isFinite(price) || price < 0)
    details.push("Price must be 0 or more.");
  else if (price > 999) details.push("Price must be 999 or less.");

  const fileErrors: string[] = [];
  if (files.some((f) => f.status === "queued" || f.status === "uploading"))
    fileErrors.push("Wait for uploads to finish.");
  if (files.some((f) => f.status === "error"))
    fileErrors.push("Retry or remove the files that failed.");
  if (d.kind) fileErrors.push(...draftManifest(d, files).errors);

  return {
    kind: d.kind ? [] : ["Pick what you're making."],
    details,
    files: fileErrors,
    preview: []
  };
}
