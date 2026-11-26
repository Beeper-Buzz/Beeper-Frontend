import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@lib/utils";

// The hero's 4x4 pad grid, played as a 16-step loop like Beeper's pads. Each
// row is a voice (kick, snare, hat, blip). The playhead runs silently; tapping
// a pad toggles its step and plays it, and "Sound on" makes the loop audible.
// Audio only ever starts from a tap. Reduced motion stops the playhead.

const STEPS = 16;
const BPM = 112;
// Kick-and-hat groove, bank A on top.
export const DEFAULT_PATTERN = [0, 2, 5, 7, 8, 10, 13, 15];
const VOICES = ["Kick", "Snare", "Hat", "Blip"];
const BLIP_NOTES = [440, 523.25, 659.25, 783.99];

type Ctx = AudioContext;

function noise(ctx: Ctx, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(
    1,
    Math.ceil(ctx.sampleRate * seconds),
    ctx.sampleRate
  );
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function play(ctx: Ctx, pad: number, at = ctx.currentTime) {
  const row = Math.floor(pad / 4);
  const col = pad % 4;
  const out = ctx.createGain();
  out.connect(ctx.destination);

  if (row === 0) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.18);
    out.gain.setValueAtTime(0.9, at);
    out.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
    o.connect(out);
    o.start(at);
    o.stop(at + 0.3);
    return;
  }
  if (row === 1 || row === 2) {
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx, 0.25);
    const f = ctx.createBiquadFilter();
    f.type = row === 1 ? "bandpass" : "highpass";
    f.frequency.value = row === 1 ? 1800 : 7000;
    const len = row === 1 ? 0.18 : 0.05;
    out.gain.setValueAtTime(row === 1 ? 0.5 : 0.25, at);
    out.gain.exponentialRampToValueAtTime(0.001, at + len);
    src.connect(f).connect(out);
    src.start(at);
    src.stop(at + len + 0.02);
    return;
  }
  const o = ctx.createOscillator();
  o.type = "square";
  o.frequency.value = BLIP_NOTES[col];
  out.gain.setValueAtTime(0.12, at);
  out.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
  o.connect(out);
  o.start(at);
  o.stop(at + 0.17);
}

interface PadSequencerProps {
  pattern?: number[];
  hint?: string | null;
}

export const PadSequencer: React.FC<PadSequencerProps> = ({
  pattern = DEFAULT_PATTERN,
  hint
}) => {
  const [on, setOn] = useState<Set<number>>(
    () => new Set(pattern.filter((p) => p >= 0 && p < STEPS))
  );
  const [step, setStep] = useState(-1);
  const [sound, setSound] = useState(false);
  const [hit, setHit] = useState<number | null>(null);
  const ctxRef = useRef<Ctx | null>(null);
  const onRef = useRef(on);
  const soundRef = useRef(sound);
  onRef.current = on;
  soundRef.current = sound;

  const audio = useCallback((): Ctx | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  // Playhead. Steps run in reading order, one 16th note each.
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (reduce?.matches) return;
    let i = 0;
    const id = window.setInterval(() => {
      setStep(i);
      if (soundRef.current && onRef.current.has(i) && ctxRef.current)
        play(ctxRef.current, i);
      i = (i + 1) % STEPS;
    }, 60_000 / BPM / 4);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => void ctxRef.current?.close(), []);

  const tap = (pad: number) => {
    const ctx = audio();
    if (ctx) play(ctx, pad);
    setHit(pad);
    window.setTimeout(() => setHit((h) => (h === pad ? null : h)), 160);
    setOn((prev) => {
      const next = new Set(prev);
      next.has(pad) ? next.delete(pad) : next.add(pad);
      return next;
    });
  };

  const toggleSound = () => {
    if (!sound) audio();
    setSound((s) => !s);
  };

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div
        role="group"
        aria-label="Beeper pads, a 16-step loop"
        className="grid grid-cols-4 gap-2.5 rounded-[22px] border border-white/10 bg-surface-deep/90 p-3.5 shadow-[0_0_60px_rgba(0,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.06)] sm:gap-3 sm:p-4"
      >
        {Array.from({ length: STEPS }, (_, i) => {
          const lit = on.has(i);
          const head = step === i;
          const firing = (head && lit) || hit === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => tap(i)}
              aria-pressed={lit}
              aria-label={`${VOICES[Math.floor(i / 4)]}, step ${i + 1}`}
              className={cn(
                "aspect-square rounded-lg border transition-[background-color,box-shadow,border-color] duration-75",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan",
                firing
                  ? "border-neon-magenta bg-neon-magenta/50 shadow-[0_0_22px_rgba(255,0,255,0.7)]"
                  : lit
                  ? "border-neon-cyan/60 bg-neon-cyan/20 shadow-[0_0_12px_rgba(0,255,255,0.35)] hover:bg-neon-cyan/30"
                  : head
                  ? "border-white/30 bg-white/[0.09]"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
              )}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between px-1">
        <span className="font-body text-xs text-white/45">
          {hint || "Tap a pad to play it"}
        </span>
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={sound}
          className={cn(
            "rounded-full border px-3 py-1 font-mono-semibold text-[11px] transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan",
            sound
              ? "border-neon-cyan/60 text-neon-cyan"
              : "border-white/15 text-white/55 hover:text-white"
          )}
        >
          {sound ? "Sound off" : "Sound on"}
        </button>
      </div>
    </div>
  );
};
