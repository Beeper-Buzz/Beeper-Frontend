// sample_pack manifest (spec §1.5). The builder fills defaults and assigns
// pads so the editor's pad grid shows exactly what the app will load: manifest
// pad p goes to Sampler slot p-1; pads 1-8 are bank A, 9-16 bank B.

import { extensionOf, UPLOAD_RULES } from "../upload/directUpload";

export interface SampleEntry {
  file: string;
  name: string;
  root_note: number;
  low_note?: number;
  high_note?: number;
  one_shot: boolean;
  gain_db: number;
  start_ms?: number;
  end_ms?: number;
  loop?: { start_ms: number; end_ms: number };
  tags?: string[];
  pad?: number;
}

export interface SamplePackManifest {
  format: 1;
  pack_id?: string;
  bpm?: number;
  samples: SampleEntry[];
}

export type SampleDraft = Partial<SampleEntry> & {
  file: string;
  name?: string;
};

export interface SamplePackDraft {
  pack_id?: string;
  bpm?: number;
  samples: SampleDraft[];
}

export const PAD_COUNT = 16;
export const MAX_SAMPLES = 64;
export const PACK_ID_RE = /^[a-z0-9-]{3,40}$/;

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const noteName = (n: number): string =>
  `${NOTES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;

const isInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v);
const inRange = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

const isAudio = (file: string) => !!UPLOAD_RULES.audio.types[extensionOf(file)];

/** "Kick_Hard-02.wav" -> "Kick Hard 02" */
export const nameFromFile = (file: string): string =>
  file
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim() || file;

export function buildSamplePack(
  draft: SamplePackDraft,
  attachedFiles: string[]
): { manifest: SamplePackManifest; errors: string[] } {
  const errors: string[] = [];
  const attached = new Set(attachedFiles);

  if (
    draft.pack_id !== undefined &&
    draft.pack_id !== "" &&
    !PACK_ID_RE.test(draft.pack_id)
  ) {
    errors.push("pack_id invalid");
  }
  if (draft.bpm !== undefined && !inRange(draft.bpm, 20, 400)) {
    errors.push("bpm must be 20..400");
  }
  if (draft.samples.length < 1 || draft.samples.length > MAX_SAMPLES) {
    errors.push(`samples must have 1..${MAX_SAMPLES} entries`);
  }

  // Pads the creator chose, first come first served.
  const used = new Set<number>();
  draft.samples.forEach((s, i) => {
    if (s.pad === undefined) return;
    if (!isInt(s.pad) || s.pad < 1 || s.pad > PAD_COUNT) {
      errors.push(`samples[${i}].pad must be 1..${PAD_COUNT}`);
    } else if (used.has(s.pad)) {
      errors.push(`samples[${i}].pad ${s.pad} is already used`);
    } else {
      used.add(s.pad);
    }
  });

  // Then the free pads, in order, for the first 16 samples.
  let next = 1;
  const samples: SampleEntry[] = draft.samples.map((s, i) => {
    const out: SampleEntry = {
      file: s.file,
      name: (s.name || "").trim() || nameFromFile(s.file),
      root_note: s.root_note ?? 60,
      one_shot: s.one_shot ?? true,
      gain_db: s.gain_db ?? 0
    };
    if (s.low_note !== undefined) out.low_note = s.low_note;
    if (s.high_note !== undefined) out.high_note = s.high_note;
    if (s.start_ms !== undefined) out.start_ms = s.start_ms;
    if (s.end_ms !== undefined) out.end_ms = s.end_ms;
    if (s.loop) out.loop = s.loop;
    if (s.tags?.length) out.tags = s.tags;
    if (s.pad !== undefined) {
      out.pad = s.pad;
    } else if (i < PAD_COUNT) {
      while (used.has(next) && next <= PAD_COUNT) next++;
      if (next <= PAD_COUNT) {
        out.pad = next;
        used.add(next);
      }
    }

    const at = `samples[${i}]`;
    if (!attached.has(s.file)) errors.push(`file "${s.file}" is not attached`);
    if (!isAudio(s.file)) errors.push(`${at}.file "${s.file}" is not audio`);
    if (!isInt(out.root_note) || out.root_note < 0 || out.root_note > 127)
      errors.push(`${at}.root_note must be 0..127`);
    for (const k of ["low_note", "high_note"] as const) {
      const v = out[k];
      if (v !== undefined && (!isInt(v) || v < 0 || v > 127))
        errors.push(`${at}.${k} must be 0..127`);
    }
    if ((out.low_note === undefined) !== (out.high_note === undefined)) {
      errors.push(
        out.low_note !== undefined
          ? `${at}.low_note given without high_note`
          : `${at}.high_note given without low_note`
      );
    } else if (
      out.low_note !== undefined &&
      out.high_note !== undefined &&
      out.low_note > out.high_note
    ) {
      errors.push(`${at}.low_note must not be above high_note`);
    }
    if (!inRange(out.gain_db, -24, 12))
      errors.push(`${at}.gain_db must be -24..12`);
    if (
      out.start_ms !== undefined &&
      out.end_ms !== undefined &&
      out.start_ms >= out.end_ms
    )
      errors.push(`${at}.start_ms must be before end_ms`);
    if (out.loop && !(out.loop.start_ms < out.loop.end_ms))
      errors.push(`${at}.loop.start_ms must be before loop.end_ms`);
    return out;
  });

  const manifest: SamplePackManifest = { format: 1, samples };
  if (draft.pack_id) manifest.pack_id = draft.pack_id;
  if (draft.bpm !== undefined) manifest.bpm = draft.bpm;
  return { manifest, errors };
}
