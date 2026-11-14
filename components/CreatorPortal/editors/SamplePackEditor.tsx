import React, { useMemo, useState } from "react";
import { Play, Square } from "lucide-react";
import { cn } from "@lib/utils";
import {
  noteName,
  PAD_COUNT,
  SampleEntry
} from "../../../lib/manifests/samplePack";
import type {
  DraftFile,
  ProductDraft,
  SampleSettings
} from "../../../lib/creator/productDraft";
import { draftManifest } from "../../../lib/creator/productDraft";
import { extensionOf, UPLOAD_RULES } from "../../../lib/upload/directUpload";
import { Field, inputCls, labelCls, numCls, selectCls } from "../kit";
import { useSamplePlayer } from "./useSamplePlayer";

const isAudio = (name: string) => !!UPLOAD_RULES.audio.types[extensionOf(name)];

const smallInput = cn(inputCls, "px-2 py-1.5 text-[13px]");

/**
 * Per-sample settings plus the 16-pad grid the app will load (pad p -> slot
 * p-1; bank A is pads 1-8, bank B 9-16). Tap a pad to hear its sample.
 */
export const SamplePackEditor: React.FC<{
  draft: ProductDraft;
  setDraft: (fn: (d: ProductDraft) => ProductDraft) => void;
  files: DraftFile[];
  sourceFor: (f: DraftFile) => Blob | string | null;
}> = ({ draft, setDraft, files, sourceFor }) => {
  const player = useSamplePlayer();
  const [selected, setSelected] = useState<string | null>(null);
  const audio = files.filter((f) => isAudio(f.name));

  // The manifest as it will be saved: pads assigned exactly as the app maps them.
  const built = useMemo(
    () =>
      draftManifest(draft, files).manifest.samples as SampleEntry[] | undefined,
    [draft, files]
  );
  const byPad = useMemo(() => {
    const m = new Map<number, SampleEntry>();
    (built || []).forEach((s) => s.pad && m.set(s.pad, s));
    return m;
  }, [built]);
  const builtByFile = useMemo(
    () => new Map((built || []).map((s) => [s.file, s])),
    [built]
  );

  const update = (file: string, patch: Partial<SampleSettings>) =>
    setDraft((d) => ({
      ...d,
      samples: {
        ...d.samples,
        [file]: { ...(d.samples[file] || {}), ...patch }
      }
    }));

  const audition = (file: string) => {
    const f = audio.find((x) => x.name === file);
    const src = f && sourceFor(f);
    if (!src) return;
    if (player.playing === file) return player.stop();
    const s = builtByFile.get(file);
    player.play(file, src, { gainDb: s?.gain_db ?? 0 });
  };

  const num = (v: string): number | undefined =>
    v.trim() === "" ? undefined : Number(v);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Field
          label="Pack id (optional)"
          htmlFor="sp-packid"
          hint="Keeps the pack the same across versions. a-z, 0-9, -"
        >
          <input
            id="sp-packid"
            className={smallInput}
            value={draft.packId}
            placeholder="dusty-drums"
            onChange={(e) =>
              setDraft((d) => ({ ...d, packId: e.target.value.toLowerCase() }))
            }
          />
        </Field>
        <Field label="Tempo (optional)" htmlFor="sp-bpm" hint="BPM of loops">
          <input
            id="sp-bpm"
            className={smallInput}
            inputMode="decimal"
            value={draft.bpm}
            placeholder="120"
            onChange={(e) => setDraft((d) => ({ ...d, bpm: e.target.value }))}
          />
        </Field>
      </div>

      {/* Pad grid: bank A | bank B */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((bank) => (
          <div key={bank}>
            <div className={labelCls}>Bank {bank === 0 ? "A" : "B"}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 8 }, (_, i) => {
                const pad = bank * 8 + i + 1;
                const s = byPad.get(pad);
                const on = !!s;
                const isPlaying = s && player.playing === s.file;
                return (
                  <button
                    key={pad}
                    type="button"
                    disabled={!on}
                    onClick={() => {
                      if (!s) return;
                      setSelected(s.file);
                      audition(s.file);
                    }}
                    aria-label={
                      s ? `Pad ${pad}: ${s.name}. Play` : `Pad ${pad}: empty`
                    }
                    className={cn(
                      "relative flex aspect-[4/3] flex-col justify-between rounded-md border p-1.5 text-left transition-all",
                      on
                        ? "border-neon-cyan/50 bg-neon-cyan/[0.12] hover:bg-neon-cyan/20"
                        : "border-white/10 bg-white/[0.02]",
                      selected &&
                        s?.file === selected &&
                        "ring-1 ring-neon-magenta",
                      isPlaying &&
                        "border-neon-magenta bg-neon-magenta/25 shadow-[0_0_12px_rgba(255,0,255,0.45)]"
                    )}
                  >
                    <span className={`${numCls} text-[10px] text-white/40`}>
                      {pad}
                    </span>
                    <span className="truncate font-body text-[11px] text-white">
                      {s?.name || ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {(built?.length || 0) > PAD_COUNT && (
        <p className="font-body text-xs text-white/50">
          Samples after the 16th get no pad. They play from the keys if you give
          them a key zone.
        </p>
      )}
      {player.error && (
        <p className="font-body text-xs text-neon-pink">{player.error}</p>
      )}

      {/* Sample rows */}
      {audio.length === 0 ? (
        <p className="font-body text-sm text-white/50">
          Add audio files above. Each file becomes one sample.
        </p>
      ) : (
        <ul className="divide-y divide-glass-border rounded-md border border-glass-border">
          {audio.map((f) => {
            const st = draft.samples[f.name] || {};
            const b = builtByFile.get(f.name);
            const root = st.root_note ?? 60;
            const id = `s-${f.key}`;
            const src = sourceFor(f);
            return (
              <li
                key={f.key}
                className={cn(
                  "grid grid-cols-2 gap-2 px-3 py-2.5 sm:grid-cols-[auto_minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] sm:items-end",
                  selected === f.name && "bg-neon-magenta/[0.05]"
                )}
              >
                <button
                  type="button"
                  onClick={() => audition(f.name)}
                  disabled={!src}
                  aria-label={
                    player.playing === f.name
                      ? `Stop ${f.name}`
                      : `Play ${f.name}`
                  }
                  className="col-span-2 flex h-8 w-8 items-center justify-center rounded-md border border-glass-border text-neon-cyan hover:border-neon-cyan/60 disabled:opacity-30 sm:col-span-1"
                >
                  {player.playing === f.name ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </button>
                <Field
                  label={f.name}
                  htmlFor={`${id}-name`}
                  className="col-span-2 min-w-0 sm:col-span-1"
                >
                  <input
                    id={`${id}-name`}
                    className={smallInput}
                    value={st.name ?? b?.name ?? ""}
                    maxLength={40}
                    onChange={(e) => update(f.name, { name: e.target.value })}
                  />
                </Field>
                <Field label={`Root ${noteName(root)}`} htmlFor={`${id}-root`}>
                  <input
                    id={`${id}-root`}
                    type="number"
                    min={0}
                    max={127}
                    className={cn(smallInput, numCls)}
                    value={root}
                    onChange={(e) =>
                      update(f.name, { root_note: num(e.target.value) ?? 60 })
                    }
                  />
                </Field>
                <Field label="Gain dB" htmlFor={`${id}-gain`}>
                  <input
                    id={`${id}-gain`}
                    type="number"
                    min={-24}
                    max={12}
                    step={0.5}
                    className={cn(smallInput, numCls)}
                    value={st.gain_db ?? 0}
                    onChange={(e) =>
                      update(f.name, { gain_db: num(e.target.value) ?? 0 })
                    }
                  />
                </Field>
                <Field label="Pad" htmlFor={`${id}-pad`}>
                  <select
                    id={`${id}-pad`}
                    className={cn(selectCls, "px-2 py-1.5 text-[13px]")}
                    value={st.pad ?? ""}
                    onChange={(e) =>
                      update(f.name, {
                        pad: e.target.value ? Number(e.target.value) : undefined
                      })
                    }
                  >
                    <option value="">Auto{b?.pad ? ` (${b.pad})` : ""}</option>
                    {Array.from({ length: PAD_COUNT }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i < 8 ? `A${i + 1}` : `B${i - 7}`} ({i + 1})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Plays" htmlFor={`${id}-mode`}>
                  <select
                    id={`${id}-mode`}
                    className={cn(selectCls, "px-2 py-1.5 text-[13px]")}
                    value={st.one_shot ?? true ? "one" : "gated"}
                    onChange={(e) =>
                      update(f.name, { one_shot: e.target.value === "one" })
                    }
                  >
                    <option value="one">To the end</option>
                    <option value="gated">While held</option>
                  </select>
                </Field>
                <Field label="Key zone" htmlFor={`${id}-lo`}>
                  <div className="flex gap-1">
                    <input
                      id={`${id}-lo`}
                      aria-label="Lowest note"
                      type="number"
                      min={0}
                      max={127}
                      placeholder="lo"
                      className={cn(smallInput, numCls, "min-w-0")}
                      value={st.low_note ?? ""}
                      onChange={(e) =>
                        update(f.name, { low_note: num(e.target.value) })
                      }
                    />
                    <input
                      aria-label="Highest note"
                      type="number"
                      min={0}
                      max={127}
                      placeholder="hi"
                      className={cn(smallInput, numCls, "min-w-0")}
                      value={st.high_note ?? ""}
                      onChange={(e) =>
                        update(f.name, { high_note: num(e.target.value) })
                      }
                    />
                  </div>
                </Field>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
