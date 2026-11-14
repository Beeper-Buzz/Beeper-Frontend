import React, { useMemo, useState } from "react";
import { Play, Square } from "lucide-react";
import { cn } from "@lib/utils";
import {
  buildSamplePack,
  MAX_SAMPLES,
  noteName,
  PAD_COUNT,
  padConflicts,
  SampleEntry
} from "../../../lib/manifests/samplePack";
import type {
  DraftFile,
  ProductDraft,
  SampleSettings
} from "../../../lib/creator/productDraft";
import { extensionOf, UPLOAD_RULES } from "../../../lib/upload/directUpload";
import { Field, inputCls, labelCls, numCls, NumInput, selectCls } from "../kit";
import { useSamplePlayer } from "./useSamplePlayer";

const isAudio = (name: string) => !!UPLOAD_RULES.audio.types[extensionOf(name)];

const smallInput = cn(inputCls, "px-2 py-1.5 text-[13px]");

const padName = (pad: number) => (pad <= 8 ? `A${pad}` : `B${pad - 8}`);

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
  const built = useMemo(() => {
    const ready = files
      .filter((f) => f.status === "done" && (f.signedId || f.existingId))
      .map((f) => f.name);
    return buildSamplePack(
      {
        pack_id: draft.packId.trim() || undefined,
        bpm: draft.bpm.trim() ? Number(draft.bpm) : undefined,
        samples: ready.map((file) => ({ file, ...(draft.samples[file] || {}) }))
      },
      ready
    );
  }, [draft, files]);
  const samples = built.manifest.samples as SampleEntry[];
  const conflicts = useMemo(() => padConflicts(samples), [samples]);
  const byPad = useMemo(() => {
    const m = new Map<number, SampleEntry>();
    samples.forEach((s) => s.pad && !m.has(s.pad) && m.set(s.pad, s));
    return m;
  }, [samples]);
  const builtByFile = useMemo(
    () => new Map(samples.map((s) => [s.file, s])),
    [samples]
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
          <NumInput
            id="sp-bpm"
            className={cn(smallInput, numCls)}
            value={draft.bpm.trim() ? Number(draft.bpm) : undefined}
            invalid={!!draft.bpm.trim() && !Number.isFinite(Number(draft.bpm))}
            placeholder="120"
            onCommit={(v) =>
              setDraft((d) => ({
                ...d,
                bpm: v === undefined ? "" : String(v)
              }))
            }
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
                const clash = conflicts.get(pad);
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
                      clash
                        ? `Pad ${pad}: ${
                            clash.length
                          } samples claim it (${clash.join(", ")}). Play ${
                            s?.name
                          }`
                        : s
                        ? `Pad ${pad}: ${s.name}. Play`
                        : `Pad ${pad}: empty`
                    }
                    className={cn(
                      "relative flex aspect-[4/3] flex-col justify-between rounded-md border p-1.5 text-left transition-colors",
                      on
                        ? "border-neon-cyan/50 bg-neon-cyan/[0.12] hover:bg-neon-cyan/20"
                        : "border-white/10 bg-white/[0.02]",
                      clash && "border-neon-pink bg-neon-pink/[0.12]",
                      selected &&
                        s?.file === selected &&
                        "ring-1 ring-neon-magenta",
                      isPlaying &&
                        "border-neon-magenta bg-neon-magenta/25 shadow-[0_0_12px_rgba(255,0,255,0.45)]"
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className={`${numCls} text-[11px] text-white/60`}>
                        {padName(pad)}
                      </span>
                      {clash && (
                        <span
                          className={`${numCls} text-[11px] text-neon-pink`}
                          aria-hidden
                        >
                          ×{clash.length}
                        </span>
                      )}
                    </span>
                    <span className="truncate font-title-condensed text-[11px] text-white">
                      {s?.name || ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {conflicts.size > 0 && (
        <p className="font-body-bold text-xs text-neon-pink">
          Two samples can&apos;t share a pad. Pads marked ×2 or more need one
          sample moved.
        </p>
      )}
      {samples.length > PAD_COUNT && (
        <p className="font-body-bold text-xs text-white/60">
          Up to {MAX_SAMPLES} samples ({PAD_COUNT} load on pads). Samples after
          the 16th get no pad; they play from the keys if you give them a key
          zone.
        </p>
      )}
      {player.error && (
        <p className="font-body-bold text-xs text-neon-pink">{player.error}</p>
      )}

      {/* Sample rows */}
      {audio.length === 0 ? (
        <p className="font-body text-sm text-white/60">
          Add audio files above. Each file becomes one sample.
        </p>
      ) : (
        <ul className="divide-y divide-glass-border rounded-md border border-glass-border">
          {audio.map((f) => {
            const st = draft.samples[f.name] || {};
            const b = builtByFile.get(f.name);
            const rowErrors = built.rowErrors[f.name] || [];
            const root = st.root_note ?? 60;
            const id = `s-${f.key}`;
            const src = sourceFor(f);
            // Pads other samples hold, as built (their choice or auto).
            const taken = new Map<number, string>();
            samples.forEach(
              (s) => s.pad && s.file !== f.name && taken.set(s.pad, s.file)
            );
            return (
              <li
                key={f.key}
                className={cn(
                  "px-3 py-2.5",
                  selected === f.name && "bg-neon-magenta/[0.05]",
                  rowErrors.length > 0 && "bg-neon-pink/[0.04]"
                )}
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] sm:items-end">
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
                  <Field
                    label={`Root ${
                      Number.isInteger(root) && root >= 0 && root <= 127
                        ? noteName(root)
                        : ""
                    }`}
                    htmlFor={`${id}-root`}
                  >
                    <NumInput
                      id={`${id}-root`}
                      className={cn(smallInput, numCls)}
                      value={root}
                      invalid={
                        !Number.isInteger(root) || root < 0 || root > 127
                      }
                      onCommit={(v) => update(f.name, { root_note: v ?? 60 })}
                    />
                  </Field>
                  <Field label="Gain dB" htmlFor={`${id}-gain`}>
                    <NumInput
                      id={`${id}-gain`}
                      className={cn(smallInput, numCls)}
                      value={st.gain_db ?? 0}
                      invalid={
                        !Number.isFinite(st.gain_db ?? 0) ||
                        (st.gain_db ?? 0) < -24 ||
                        (st.gain_db ?? 0) > 12
                      }
                      onCommit={(v) => update(f.name, { gain_db: v ?? 0 })}
                    />
                  </Field>
                  <Field label="Pad" htmlFor={`${id}-pad`}>
                    <select
                      id={`${id}-pad`}
                      className={cn(
                        selectCls,
                        "px-2 py-1.5 text-[13px]",
                        st.pad !== undefined &&
                          conflicts.has(st.pad) &&
                          "border-neon-pink/60"
                      )}
                      value={st.pad ?? ""}
                      onChange={(e) =>
                        update(f.name, {
                          pad: e.target.value
                            ? Number(e.target.value)
                            : undefined
                        })
                      }
                    >
                      <option value="">
                        Auto{b?.pad ? ` (${padName(b.pad)})` : " (none)"}
                      </option>
                      {Array.from({ length: PAD_COUNT }, (_, i) => {
                        const pad = i + 1;
                        const holder = taken.get(pad);
                        return (
                          <option key={pad} value={pad}>
                            {padName(pad)}
                            {holder ? ` · used by ${holder}` : ""}
                          </option>
                        );
                      })}
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
                      <NumInput
                        id={`${id}-lo`}
                        aria-label={`Lowest note for ${f.name}`}
                        placeholder="lo"
                        className={cn(smallInput, numCls, "min-w-0")}
                        value={st.low_note}
                        onCommit={(v) => update(f.name, { low_note: v })}
                      />
                      <NumInput
                        aria-label={`Highest note for ${f.name}`}
                        placeholder="hi"
                        className={cn(smallInput, numCls, "min-w-0")}
                        value={st.high_note}
                        onCommit={(v) => update(f.name, { high_note: v })}
                      />
                    </div>
                  </Field>
                </div>
                {rowErrors.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5" aria-live="polite">
                    {rowErrors.map((e) => (
                      <li
                        key={e}
                        className="font-body-bold text-xs text-neon-pink"
                      >
                        {e}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
