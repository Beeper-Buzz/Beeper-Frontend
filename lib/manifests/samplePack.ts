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

/** Pads claimed by more than one sample: pad -> the files, in order. */
export function padConflicts(
  samples: { file: string; pad?: number }[]
): Map<number, string[]> {
  const byPad = new Map<number, string[]>();
  for (const s of samples) {
    if (s.pad === undefined) continue;
    byPad.set(s.pad, [...(byPad.get(s.pad) || []), s.file]);
  }
  return new Map(Array.from(byPad).filter(([, files]) => files.length > 1));
}

/**
 * `errors` mirror the server's wording (by index); `rowErrors` say the same
 * things in words, keyed by file name, for the editor's rows.
 */
export function buildSamplePack(
  draft: SamplePackDraft,
  attachedFiles: string[]
): {
  manifest: SamplePackManifest;
  errors: string[];
  rowErrors: Record<string, string[]>;
} {
  const errors: string[] = [];
  const rowErrors: Record<string, string[]> = {};
  const row = (file: string, msg: string) => {
    (rowErrors[file] = rowErrors[file] || []).push(msg);
  };
  const attached = new Set(attachedFiles);

  if (
    draft.pack_id !== undefined &&
    draft.pack_id !== "" &&
    !PACK_ID_RE.test(draft.pack_id)
  ) {
    errors.push("pack_id invalid");
  }
  // The server keeps bpm as given; it only has to be a number.
  if (draft.bpm !== undefined && !Number.isFinite(draft.bpm)) {
    errors.push("bpm must be a number");
  }
  if (draft.samples.length < 1 || draft.samples.length > MAX_SAMPLES) {
    errors.push(`samples must have 1..${MAX_SAMPLES} entries`);
  }

  // Pads the creator chose, first come first served.
  const used = new Map<number, string>();
  draft.samples.forEach((s, i) => {
    if (s.pad === undefined) return;
    if (!isInt(s.pad) || s.pad < 1 || s.pad > PAD_COUNT) {
      errors.push(`samples[${i}].pad must be 1..${PAD_COUNT}`);
      row(s.file, `Pad must be 1 to ${PAD_COUNT}.`);
    } else if (used.has(s.pad)) {
      errors.push(`samples[${i}].pad ${s.pad} is already used`);
      row(s.file, `Pad ${s.pad} is already used by ${used.get(s.pad)}.`);
    } else {
      used.set(s.pad, s.file);
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
        used.set(next, s.file);
      }
    }

    const at = `samples[${i}]`;
    if (!attached.has(s.file)) {
      errors.push(`file "${s.file}" is not attached`);
      row(s.file, "This file isn't uploaded yet.");
    }
    if (!isAudio(s.file)) {
      errors.push(`${at}.file "${s.file}" is not audio`);
      row(s.file, "Only audio files can be samples.");
    }
    if (!isInt(out.root_note) || out.root_note < 0 || out.root_note > 127) {
      errors.push(`${at}.root_note must be 0..127`);
      row(s.file, "Root note must be a whole number from 0 to 127.");
    }
    for (const k of ["low_note", "high_note"] as const) {
      const v = out[k];
      if (v !== undefined && (!isInt(v) || v < 0 || v > 127)) {
        errors.push(`${at}.${k} must be 0..127`);
        row(
          s.file,
          `${
            k === "low_note" ? "Lowest" : "Highest"
          } note must be a whole number from 0 to 127.`
        );
      }
    }
    if ((out.low_note === undefined) !== (out.high_note === undefined)) {
      errors.push(
        out.low_note !== undefined
          ? `${at}.low_note given without high_note`
          : `${at}.high_note given without low_note`
      );
      row(s.file, "A key zone needs both a lowest and a highest note.");
    } else if (
      out.low_note !== undefined &&
      out.high_note !== undefined &&
      out.low_note > out.high_note
    ) {
      errors.push(`${at}.low_note must not be above high_note`);
      row(s.file, "The key zone's lowest note is above its highest.");
    }
    if (!inRange(out.gain_db, -24, 12)) {
      errors.push(`${at}.gain_db must be -24..12`);
      row(s.file, "Gain must be from -24 to 12 dB.");
    }
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
  return { manifest, errors, rowErrors };
}
