// Optional sound for the demo groove: tiny WebAudio voices for each note event, so a creator
// can hear what the preview is reacting to. Off by default; the AudioContext is created on the
// click that turns it on (browsers only allow audio after a gesture).

import {
  DRUM_VOICES,
  DrumVoice
} from "../../../../lib/gltfVisualizer/core/manifest";
import type { GrooveEvent } from "../../../../lib/gltfVisualizer/demoGroove";
import { noteHz } from "../../../../lib/gltfVisualizer/demoGroove";

type Ctx = AudioContext;

const TOM_HZ: Partial<Record<DrumVoice, number>> = {
  "low-tom": 90,
  "mid-tom": 130,
  "high-tom": 180
};

export class GrooveSound {
  private ctx: Ctx | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = false;

  /** Call from a click: creates or resumes the context; false when there's no WebAudio. */
  enable(): boolean {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          typeof window !== "undefined"
            ? window.AudioContext ||
              (
                window as unknown as {
                  webkitAudioContext?: typeof AudioContext;
                }
              ).webkitAudioContext
            : undefined;
        if (!AC) return false;
        this.ctx = new AC();
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.35;
        this.out.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 0.5);
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      // Not awaited: without a real gesture resume() can stay pending; voices play once it runs.
      if (this.ctx.state === "suspended")
        this.ctx.resume().catch(() => undefined);
      this.enabled = true;
      return true;
    } catch {
      this.enabled = false;
      return false;
    }
  }

  disable(): void {
    this.enabled = false;
  }

  close(): void {
    this.enabled = false;
    const ctx = this.ctx;
    this.ctx = null;
    this.out = null;
    if (ctx) ctx.close().catch(() => undefined);
  }

  play(e: GrooveEvent): void {
    if (!this.enabled || !this.ctx || !this.out) return;
    try {
      const v = Math.max(0.05, Math.min(1, e.velocity / 127));
      if (e.part === "drums") this.drum(DRUM_VOICES[e.note], v);
      else if (e.part === "sampler")
        this.tone(noteHz(60 + e.note), v, "square", 0.18);
      else this.tone(noteHz(e.note), v, "triangle", 0.22);
    } catch {
      // a dropped sound never breaks the preview
    }
  }

  private env(peak: number, decay: number): GainNode {
    const ctx = this.ctx as Ctx;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    g.connect(this.out as GainNode);
    return g;
  }

  private tone(hz: number, v: number, type: OscillatorType, decay: number) {
    const ctx = this.ctx as Ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.connect(this.env(0.25 * v, decay));
    o.start();
    o.stop(ctx.currentTime + decay + 0.02);
  }

  private sweep(from: number, to: number, v: number, decay: number) {
    const ctx = this.ctx as Ctx;
    const o = ctx.createOscillator();
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + decay * 0.6);
    o.connect(this.env(0.9 * v, decay));
    o.start();
    o.stop(t + decay + 0.02);
  }

  private hiss(v: number, cutoff: number, decay: number, peak = 0.5) {
    const ctx = this.ctx as Ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = cutoff;
    s.connect(f);
    f.connect(this.env(peak * v, decay));
    s.start();
    s.stop(ctx.currentTime + decay + 0.02);
  }

  private drum(voice: DrumVoice | undefined, v: number) {
    switch (voice) {
      case "kick":
        return this.sweep(150, 45, v, 0.3);
      case "snare":
        this.hiss(v, 1500, 0.16);
        return this.tone(190, v, "triangle", 0.08);
      case "closed-hat":
        return this.hiss(v, 7000, 0.04, 0.3);
      case "open-hat":
        return this.hiss(v, 7000, 0.3, 0.25);
      case "clap":
        return this.hiss(v, 1000, 0.12, 0.6);
      case "rim":
        return this.tone(800, v, "square", 0.03);
      default: {
        const hz = voice ? TOM_HZ[voice] : undefined;
        if (hz) this.sweep(hz * 1.6, hz, v, 0.25);
      }
    }
  }
}
