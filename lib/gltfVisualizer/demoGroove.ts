// The studio's stand-in for the app's audio frame and note bus (spec §9.3): a deterministic
// 120 BPM 4/4 groove (kick on 1 and 3, snare on 2 and 4, hats on eighths, a synth arpeggio
// through Am–F–C–G) that fills the core's 20-source vector and emits note events, a Silent mode
// (transport stopped: only the idle layer moves), and manual triggers for keys, pads and drums.
// Pure: no DOM, no WebAudio, no clock. The caller ticks it with the frame's dt.
//
// Pulses use the app's hit constants (τ 0.06 s, amplitude 0.4..1 by velocity). The band
// envelopes, onset and notePulse are simulated: shaped like the app's, not measured from audio.

import { createSourceBuffer, SOURCE_INDEX } from "./core/bindings";
import { DRUM_VOICES, DrumVoice } from "./core/manifest";
import type { NoteEventPart, TransportState } from "./core/noteClips";

export const HIT_TAU = 0.06;
export const HIT_MIN_AMP = 0.4;
export const GROOVE_BPM = 120;
/** `beat` falls from 1 to 0 over this fraction of a beat. */
export const BEAT_RAMP = 0.25;
/** Simulated decays (seconds). */
const NOTE_PULSE_TAU = 0.2;
const BASS_TAU = 0.2;
const MID_TAU = 0.15;
const HIGH_TAU = 0.05;

export type GrooveMode = "groove" | "silent";

export interface GrooveEvent {
  part: NoteEventPart;
  /** MIDI for synth / samplerKeys, slot 0–15 for sampler, voice index for drums. */
  note: number;
  velocity: number;
}

/** Am – F – C – G, one chord per bar (MIDI). */
export const PROGRESSION: readonly (readonly number[])[] = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62]
];
/** Arp pattern over [root, third, fifth, root + 12], one step per eighth. */
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];

const VOICE = (v: DrumVoice) => DRUM_VOICES.indexOf(v);
const KICK = VOICE("kick");
const SNARE = VOICE("snare");
const CLOSED_HAT = VOICE("closed-hat");
const OPEN_HAT = VOICE("open-hat");

type Register = "kick" | "snare" | "hats";
/** Drum voice → register (spec §4.1): kick + low tom; snare + clap, rim, toms; hats. */
export const VOICE_REGISTER: Record<DrumVoice, Register> = {
  kick: "kick",
  "low-tom": "kick",
  snare: "snare",
  clap: "snare",
  rim: "snare",
  "mid-tom": "snare",
  "high-tom": "snare",
  "closed-hat": "hats",
  "open-hat": "hats"
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Pulse amplitude for a velocity: HIT_MIN_AMP..1. */
export const hitAmp = (velocity: number): number =>
  HIT_MIN_AMP + (1 - HIT_MIN_AMP) * clamp01(velocity / 127);

export const noteHz = (note: number): number =>
  440 * Math.pow(2, (note - 69) / 12);

/** Velocity from where a pad was pressed: 127 at the top, 20 at the bottom. */
export function velocityFromY(y: number, height: number): number {
  if (!(height > 0)) return 100;
  return Math.round(20 + 107 * (1 - clamp01(y / height)));
}

// Pulse slots.
const P_HIT = 0;
const P_DRUMS = 1;
const P_SAMPLER = 2;
const P_SYNTH = 3;
const P_KICK = 4;
const P_SNARE = 5;
const P_HATS = 6;
const P_NOTE = 7;
const P_ONSET = 8;
const P_BASS = 9;
const P_MID = 10;
const P_HIGH = 11;
const TAU = [
  HIT_TAU,
  HIT_TAU,
  HIT_TAU,
  HIT_TAU,
  HIT_TAU,
  HIT_TAU,
  HIT_TAU,
  NOTE_PULSE_TAU,
  HIT_TAU,
  BASS_TAU,
  MID_TAU,
  HIGH_TAU
];

export class DemoGroove {
  /** One slot per source, SOURCE_INDEX order; rewritten by every tick and trigger. */
  readonly sources: Float32Array = createSourceBuffer();
  readonly transport: TransportState = {
    playing: true,
    bpm: GROOVE_BPM,
    beatPhase: 0,
    barPhase: 0
  };

  private _mode: GrooveMode;
  private _bpm: number;
  /** Beats since the groove (re)started. */
  private beatPos = 0;
  /** The next eighth-note grid index to play. */
  private nextEighth = 0;
  private readonly pulse = new Float64Array(TAU.length);
  private note = -1;
  private queue: GrooveEvent[] = [];

  constructor(opts: { bpm?: number; mode?: GrooveMode } = {}) {
    this._bpm = opts.bpm || GROOVE_BPM;
    this._mode = opts.mode || "groove";
    this.write();
  }

  get mode(): GrooveMode {
    return this._mode;
  }

  /** Silent stops the transport; groove restarts it from bar 1. */
  setMode(mode: GrooveMode): void {
    if (mode === this._mode) return;
    this._mode = mode;
    this.beatPos = 0;
    this.nextEighth = 0;
    this.write();
  }

  get bpm(): number {
    return this._bpm;
  }

  set bpm(v: number) {
    if (Number.isFinite(v) && v > 0) this._bpm = v;
    this.write();
  }

  /** Back to bar 1 with every pulse at rest. */
  reset(): void {
    this.beatPos = 0;
    this.nextEighth = 0;
    this.pulse.fill(0);
    this.note = -1;
    this.queue = [];
    this.write();
  }

  /**
   * A hand-played note-on: raises its pulses now and is returned by the next tick, so the
   * preview offers it to the note rules like a bus event.
   */
  trigger(part: NoteEventPart, note: number, velocity: number): GrooveEvent {
    const e: GrooveEvent = { part, note, velocity };
    this.hit(e, 0);
    this.queue.push(e);
    this.write();
    return e;
  }

  /** Advances `dtSec`; returns the note-ons of this frame (queued manual ones first). */
  tick(dtSec: number): GrooveEvent[] {
    const dt = dtSec > 0 ? dtSec : 0;
    for (let i = 0; i < this.pulse.length; i++)
      this.pulse[i] *= Math.exp(-dt / TAU[i]);
    const out = this.queue;
    this.queue = [];
    if (this._mode === "groove") {
      const secPerBeat = 60 / this._bpm;
      const b1 = this.beatPos + dt / secPerBeat;
      // Every eighth whose time falls in [b0, b1).
      while (this.nextEighth / 2 < b1) {
        const k = this.nextEighth++;
        const age = (b1 - k / 2) * secPerBeat;
        for (const e of this.eighth(k)) {
          this.hit(e, age);
          out.push(e);
        }
      }
      this.beatPos = b1;
    }
    this.write();
    return out;
  }

  /** The pattern at eighth `k` (beat k/2). */
  private eighth(k: number): GrooveEvent[] {
    const evs: GrooveEvent[] = [];
    const onBeat = k % 2 === 0;
    const beatInBar = Math.floor(k / 2) % 4;
    if (onBeat) {
      evs.push(
        beatInBar % 2 === 0
          ? { part: "drums", note: KICK, velocity: 118 }
          : { part: "drums", note: SNARE, velocity: 104 }
      );
    }
    evs.push({
      part: "drums",
      note: k % 8 === 7 ? OPEN_HAT : CLOSED_HAT,
      velocity: onBeat ? 84 : 56
    });
    const chord = PROGRESSION[Math.floor(k / 8) % PROGRESSION.length];
    const step = ARP[k % 8];
    evs.push({
      part: "synth",
      note: step === 3 ? chord[0] + 12 : chord[step],
      velocity: onBeat ? 96 : 72
    });
    return evs;
  }

  /** Raises the pulses for a note-on that happened `age` seconds ago. */
  private hit(e: GrooveEvent, age: number): void {
    const amp = hitAmp(e.velocity);
    const raise = (slot: number, a: number) => {
      const v = a * Math.exp(-age / TAU[slot]);
      if (v > this.pulse[slot]) this.pulse[slot] = v;
    };
    raise(P_HIT, amp);
    raise(P_NOTE, 1);
    switch (e.part) {
      case "drums": {
        raise(P_DRUMS, amp);
        raise(P_ONSET, 1);
        const voice = DRUM_VOICES[e.note];
        const reg = voice ? VOICE_REGISTER[voice] : null;
        if (reg === "kick") {
          raise(P_KICK, amp);
          raise(P_BASS, amp);
        } else if (reg === "snare") {
          raise(P_SNARE, amp);
          raise(P_MID, amp);
        } else if (reg === "hats") {
          raise(P_HATS, amp);
          raise(P_HIGH, amp);
        }
        break;
      }
      case "sampler":
        raise(P_SAMPLER, amp);
        raise(P_SNARE, amp / 2);
        raise(P_ONSET, 1);
        raise(P_MID, amp / 2);
        break;
      case "samplerKeys":
        raise(P_SAMPLER, amp);
        raise(P_MID, amp * 0.6);
        this.note = e.note;
        break;
      case "synth":
        raise(P_SYNTH, amp);
        raise(P_MID, amp * 0.6);
        this.note = e.note;
        break;
    }
  }

  private write(): void {
    const s = this.sources;
    const p = this.pulse;
    const playing = this._mode === "groove";
    const beatPhase = playing ? this.beatPos % 1 : 0;
    const barPhase = playing ? (this.beatPos / 4) % 1 : 0;
    const base = playing ? 1 : 0;
    const bass = clamp01(0.15 * base + 0.8 * p[P_BASS]);
    const mid = clamp01(0.1 * base + 0.7 * p[P_MID]);
    const high = clamp01(0.05 * base + 0.85 * p[P_HIGH]);
    s[SOURCE_INDEX.bass] = bass;
    s[SOURCE_INDEX.mid] = mid;
    s[SOURCE_INDEX.high] = high;
    s[SOURCE_INDEX.level] = clamp01(0.45 * bass + 0.35 * mid + 0.2 * high);
    s[SOURCE_INDEX.beat] = playing ? Math.max(0, 1 - beatPhase / BEAT_RAMP) : 0;
    s[SOURCE_INDEX.onset] = clamp01(p[P_ONSET]);
    s[SOURCE_INDEX.beatPhase] = beatPhase;
    s[SOURCE_INDEX.barPhase] = barPhase;
    s[SOURCE_INDEX.bpm] = this._bpm;
    s[SOURCE_INDEX.playing] = playing ? 1 : 0;
    s[SOURCE_INDEX.notePulse] = clamp01(p[P_NOTE]);
    s[SOURCE_INDEX.note] = this.note;
    s[SOURCE_INDEX.noteHz] = this.note >= 0 ? noteHz(this.note) : 0;
    s[SOURCE_INDEX.hit] = clamp01(p[P_HIT]);
    s[SOURCE_INDEX.drums] = clamp01(p[P_DRUMS]);
    s[SOURCE_INDEX.sampler] = clamp01(p[P_SAMPLER]);
    s[SOURCE_INDEX.synth] = clamp01(p[P_SYNTH]);
    s[SOURCE_INDEX.kick] = clamp01(p[P_KICK]);
    s[SOURCE_INDEX.snare] = clamp01(p[P_SNARE]);
    s[SOURCE_INDEX.hats] = clamp01(p[P_HATS]);
    const t = this.transport;
    t.playing = playing;
    t.bpm = this._bpm;
    t.beatPhase = beatPhase;
    t.barPhase = barPhase;
  }
}
