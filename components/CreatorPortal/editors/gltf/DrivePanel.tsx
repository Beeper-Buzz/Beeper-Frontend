// DRIVE (spec §9.3): the demo groove or silence, its tempo, live meters of the sources the
// bindings read, and hand-played keys, pads and drums that fire note events (velocity by how
// high on the button you press) so note → clip rules can be tried without an instrument.

import React, { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@lib/utils";
import { SOURCE_INDEX } from "../../../../lib/gltfVisualizer/core/bindings";
import {
  DRUM_VOICES,
  SourceName
} from "../../../../lib/gltfVisualizer/core/manifest";
import type { NoteEventPart } from "../../../../lib/gltfVisualizer/core/noteClips";
import {
  GrooveMode,
  velocityFromY
} from "../../../../lib/gltfVisualizer/demoGroove";
import { noteName } from "../../../../lib/manifests/samplePack";
import { btnGhost, numCls } from "../../kit";
import { panelTitle, Segmented, smallSelect } from "./fields";
import { LiveMeter, LiveNumber, useLive } from "./live";

const METERS: { name: SourceName; label: string }[] = [
  { name: "bass", label: "bass" },
  { name: "mid", label: "mid" },
  { name: "high", label: "high" },
  { name: "level", label: "level" },
  { name: "beat", label: "beat" },
  { name: "onset", label: "onset" },
  { name: "kick", label: "kick" },
  { name: "snare", label: "snare" },
  { name: "hats", label: "hats" },
  { name: "hit", label: "hit" },
  { name: "synth", label: "synth" },
  { name: "notePulse", label: "note pulse" }
];

const KEYS = Array.from({ length: 24 }, (_, i) => 48 + i); // C3..B4
const BLACK = [1, 3, 6, 8, 10];
const PADS = Array.from({ length: 16 }, (_, i) => i);
const DRUM_LABEL: Record<string, string> = {
  kick: "Kick",
  snare: "Snare",
  "closed-hat": "Hat",
  "open-hat": "Open hat",
  clap: "Clap",
  "low-tom": "Low tom",
  "high-tom": "High tom",
  rim: "Rim",
  "mid-tom": "Mid tom"
};

type Tab = "keys" | "pads" | "drums";

/** A button that fires on pointer down, velocity by height. */
const Trigger: React.FC<{
  label: string;
  onFire: (velocity: number) => void;
  className?: string;
  children: React.ReactNode;
}> = ({ label, onFire, className, children }) => (
  <button
    type="button"
    aria-label={label}
    title={`${label} (press higher for louder)`}
    onPointerDown={(e) => {
      const r = e.currentTarget.getBoundingClientRect();
      onFire(velocityFromY(e.clientY - r.top, r.height));
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onFire(100);
      }
    }}
    className={cn(
      "select-none touch-manipulation rounded border transition-colors active:border-neon-cyan active:bg-neon-cyan/25 active:text-neon-cyan",
      className
    )}
  >
    {children}
  </button>
);

export const DrivePanel: React.FC<{ className?: string }> = ({ className }) => {
  const { groove, sound } = useLive();
  const [soundOn, setSoundOn] = useState(sound.enabled);
  const toggleSound = () => {
    if (sound.enabled) {
      sound.disable();
      setSoundOn(false);
    } else {
      setSoundOn(sound.enable());
    }
  };
  const [mode, setModeState] = useState<GrooveMode>(groove.mode);
  const [bpm, setBpmState] = useState(groove.bpm);
  const [tab, setTab] = useState<Tab>("keys");
  const [keysPart, setKeysPart] = useState<NoteEventPart>("synth");

  const setMode = (m: GrooveMode) => {
    groove.setMode(m);
    setModeState(m);
  };
  const fire = (part: NoteEventPart, note: number) => (velocity: number) =>
    groove.trigger(part, note, velocity);
  const read = (name: SourceName) => () => groove.sources[SOURCE_INDEX[name]];

  return (
    <section
      className={cn(
        "rounded-md border border-glass-border bg-white/[0.02] p-3",
        className
      )}
      aria-label="Drive"
    >
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className={panelTitle}>Drive</h3>
        <Segmented
          label="What drives the preview"
          value={mode}
          onChange={setMode}
          options={[
            { value: "groove", label: "Demo groove" },
            { value: "silent", label: "Silent" }
          ]}
        />
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundOn}
          title={
            soundOn
              ? "Mute the demo sound"
              : "Hear the groove and what you play"
          }
          className={cn(
            btnGhost,
            "px-2 py-1 text-xs",
            soundOn && "border-neon-cyan/60 text-neon-cyan"
          )}
        >
          {soundOn ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <VolumeX className="h-3.5 w-3.5" />
          )}
          Sound
        </button>
        <label className="ml-auto flex items-center gap-2 font-mono-semibold text-[11px] text-white/70">
          <span className="sr-only">Tempo</span>
          <input
            type="range"
            min={60}
            max={180}
            value={bpm}
            disabled={mode === "silent"}
            onChange={(e) => {
              const v = Number(e.target.value);
              groove.bpm = v;
              setBpmState(v);
            }}
            className="w-20 accent-neon-cyan disabled:opacity-40"
            aria-label="Tempo"
          />
          <span className={cn(numCls, "w-14 text-white/80")}>{bpm} BPM</span>
        </label>
      </header>

      <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 sm:grid-cols-4">
        {METERS.map((m) => (
          <div key={m.name} className="min-w-0">
            <div className="flex items-baseline justify-between font-mono-semibold text-[11px] text-white/60">
              <span className="truncate">{m.label}</span>
            </div>
            <LiveMeter read={read(m.name)} label={`${m.label} level`} />
          </div>
        ))}
        <div className="min-w-0 font-mono-semibold text-[11px] text-white/60">
          note{" "}
          <LiveNumber
            read={read("note")}
            digits={0}
            className="text-white/80"
          />
        </div>
      </div>
      <p className="mt-1.5 font-body-bold text-[11px] text-white/60">
        Simulated: bands, onset and note pulse are shaped like the app&apos;s,
        not measured from audio. Hits use the app&apos;s decay.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Segmented
          label="Play by hand"
          value={tab}
          onChange={setTab}
          options={[
            { value: "keys", label: "Keys" },
            { value: "pads", label: "Pads" },
            { value: "drums", label: "Drums" }
          ]}
        />
        {tab === "keys" && (
          <select
            aria-label="Keys play as"
            className={cn(smallSelect, "w-auto py-1")}
            value={keysPart}
            onChange={(e) => setKeysPart(e.target.value as NoteEventPart)}
          >
            <option value="synth">as Synth</option>
            <option value="samplerKeys">as Sampler keys</option>
          </select>
        )}
      </div>

      <div className="mt-2">
        {tab === "keys" && (
          <div className="flex h-16 gap-px overflow-x-auto scrollbar-hide">
            {KEYS.map((n) => {
              const black = BLACK.includes(n % 12);
              return (
                <Trigger
                  key={n}
                  label={`${noteName(n)} (MIDI ${n})`}
                  onFire={fire(keysPart, n)}
                  className={cn(
                    "flex min-w-[22px] flex-1 items-end justify-center pb-1 font-mono-semibold text-[10px]",
                    black
                      ? "h-10 border-white/10 bg-white/10 text-white/60"
                      : "border-white/20 bg-white/[0.85] text-black/70"
                  )}
                >
                  {n % 12 === 0 ? noteName(n) : ""}
                </Trigger>
              );
            })}
          </div>
        )}
        {tab === "pads" && (
          <div className="grid grid-cols-8 gap-1">
            {PADS.map((p) => (
              <Trigger
                key={p}
                label={`Pad ${p + 1}`}
                onFire={fire("sampler", p)}
                className="aspect-square border-glass-border bg-white/[0.04] font-mono-semibold text-[11px] text-white/70"
              >
                {p + 1}
              </Trigger>
            ))}
          </div>
        )}
        {tab === "drums" && (
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-5">
            {DRUM_VOICES.map((v, i) => (
              <Trigger
                key={v}
                label={DRUM_LABEL[v] || v}
                onFire={fire("drums", i)}
                className="h-11 border-glass-border bg-white/[0.04] font-body-bold text-xs text-white/75"
              >
                {DRUM_LABEL[v] || v}
              </Trigger>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
