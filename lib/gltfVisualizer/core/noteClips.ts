// Note → clip switching (spec §4.6). Matching runs on the note bus (touch path): O(1) table
// lookups into a preallocated PendingNote, no allocation. The state machine is pure (no three):
// it tells a sink which clip slot to fade to and with what speed/weight, so it is unit-testable
// and the rig implements the sink with AnimationActions.

import { DRUM_VOICES, NormalizedNoteClips, NormalizedNoteRule } from './manifest';

/** Parts as the app's note bus reports them. */
export type NoteEventPart = 'synth' | 'samplerKeys' | 'sampler' | 'drums';

export interface TransportState {
  playing: boolean;
  bpm: number;
  /** 0..1 ramp within the beat. */
  beatPhase: number;
  /** 0..1 ramp within the bar. */
  barPhase: number;
}

/** Note/slot/voice → first matching rule index, or −1. */
export class NoteRuleTables {
  readonly synth = new Int16Array(128).fill(-1);
  readonly samplerKeys = new Int16Array(128).fill(-1);
  readonly sampler = new Int16Array(16).fill(-1);
  readonly drums = new Int16Array(DRUM_VOICES.length).fill(-1);

  /** Rule index for an event (note = MIDI for keys parts, slot for sampler, voice index for drums). */
  match(part: NoteEventPart | string, note: number): number {
    const i = note | 0;
    if (i !== note || i < 0) return -1;
    switch (part) {
      case 'synth':
        return i < 128 ? this.synth[i] : -1;
      case 'samplerKeys':
        return i < 128 ? this.samplerKeys[i] : -1;
      case 'sampler':
        return i < 16 ? this.sampler[i] : -1;
      case 'drums':
        return i < this.drums.length ? this.drums[i] : -1;
      default:
        return -1;
    }
  }
}

function fill(table: Int16Array, lo: number, hi: number, rule: number): void {
  for (let i = Math.max(lo, 0); i <= hi && i < table.length; i++) if (table[i] < 0) table[i] = rule;
}

/** Precompiles the rules; the first rule that matches an event wins. */
export function compileNoteRules(noteClips: NormalizedNoteClips | null): NoteRuleTables {
  const t = new NoteRuleTables();
  if (!noteClips) return t;
  for (let r = 0; r < noteClips.rules.length; r++) {
    const m = noteClips.rules[r].match;
    switch (m.part) {
      case 'synth':
        fill(t.synth, m.lo, m.hi, r);
        break;
      case 'samplerKeys':
        fill(t.samplerKeys, m.lo, m.hi, r);
        break;
      case 'keys':
        fill(t.synth, m.lo, m.hi, r);
        fill(t.samplerKeys, m.lo, m.hi, r);
        break;
      case 'sampler':
        fill(t.sampler, m.lo, m.hi, r);
        break;
      case 'drums':
        if (m.voices) for (let v = 0; v < m.voices.length; v++) fill(t.drums, m.voices[v], m.voices[v], r);
        break;
    }
  }
  return t;
}

/**
 * The frame's winning note-on, kept by priority: 'last' takes every new match; 'velocity' takes
 * a match whose velocity is ≥ the pending one (ties → last). Preallocate one; the rig clears it.
 */
export class PendingNote {
  rule = -1;
  velocity = 0;
  note = 0;
  part: NoteEventPart | null = null;
  constructor(public priority: 'last' | 'velocity' = 'last') {}

  get has(): boolean {
    return this.rule >= 0;
  }

  /** Offers a matched event; returns true when it became the pending winner. */
  offer(rule: number, velocity: number, part: NoteEventPart | null = null, note = 0): boolean {
    if (rule < 0) return false;
    if (this.rule >= 0 && this.priority === 'velocity' && velocity < this.velocity) return false;
    this.rule = rule;
    this.velocity = velocity;
    this.part = part;
    this.note = note;
    return true;
  }

  clear(): void {
    this.rule = -1;
    this.velocity = 0;
    this.note = 0;
    this.part = null;
  }
}

/** Bus listener body: note-offs are ignored; a matching note-on is offered to `pending`. */
export function offerNoteEvent(tables: NoteRuleTables, pending: PendingNote, part: NoteEventPart | string, note: number, velocity: number, on: boolean): boolean {
  if (!on) return false;
  const rule = tables.match(part, note);
  if (rule < 0) return false;
  return pending.offer(rule, velocity, part as NoteEventPart, note);
}

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
const lerpVelocity = (range: readonly [number, number], velocity: number): number => {
  const v = clamp(velocity / 127, 0, 1);
  return range[0] + (range[1] - range[0]) * v;
};

/** rule.timeScale × tempo sync (playing only, clamped 0.25..4) × velocity (when velocity.to = timeScale). */
export function clipTimeScale(rule: NormalizedNoteRule, bpm: number, playing: boolean, velocity: number): number {
  let ts = rule.timeScale;
  if (rule.clipBpm > 0 && playing) ts *= clamp(bpm / rule.clipBpm, 0.25, 4);
  if (rule.velocity && rule.velocity.to === 'timeScale') ts *= lerpVelocity(rule.velocity.range, velocity);
  return ts;
}

/** Velocity-scaled weight when velocity.to = weight, else 1. */
export function clipWeight(rule: NormalizedNoteRule, velocity: number): number {
  return rule.velocity && rule.velocity.to === 'weight' ? lerpVelocity(rule.velocity.range, velocity) : 1;
}

/** Distinct clip names the switcher uses: slot 0 is `initial`, then rule clips in order. */
export function noteClipSlots(noteClips: NormalizedNoteClips): string[] {
  const slots = [noteClips.initial];
  for (let r = 0; r < noteClips.rules.length; r++) if (slots.indexOf(noteClips.rules[r].clip) < 0) slots.push(noteClips.rules[r].clip);
  return slots;
}

/** What the machine drives. Slots index `noteClipSlots()`. */
export interface NoteClipsSink {
  /** Fade `slot` in and every other switcher slot out over `fadeSec`; restart from 0 if asked; once = play one time and hold. */
  crossfade(slot: number, fadeSec: number, restart: boolean, once: boolean): void;
  /** Per-frame speed and weight of a slot. */
  setParams(slot: number, timeScale: number, weight: number): void;
}

const MAX_VELOCITY = 127;

/**
 * The switcher: a current loop clip, an optional active once clip (returns to the loop it
 * interrupted `fadeMs` before its end), an optional pending synced switch (waits for the beat
 * or bar to wrap, i.e. phase < previous phase; immediate when stopped), onStop and returnAfterMs.
 */
export class NoteClipsMachine {
  readonly slots: string[];
  /** Rule index → slot. */
  readonly ruleSlot: Int16Array;
  loopSlot = 0;
  loopRule = -1;
  loopVelocity = MAX_VELOCITY;
  onceSlot = -1;
  onceRule = -1;
  onceVelocity = MAX_VELOCITY;
  /** Clip-time seconds the once clip has played. */
  onceTime = 0;
  pendingRule = -1;
  pendingVelocity = 0;
  /** Seconds since the last matching note. */
  silence = 0;

  private started = false;
  private wasPlaying = false;
  private prevBeat = 0;
  private prevBar = 0;

  constructor(
    readonly config: NormalizedNoteClips,
    /** Clip duration in seconds per slot. */
    readonly durations: ArrayLike<number>,
    private readonly sink: NoteClipsSink,
  ) {
    this.slots = noteClipSlots(config);
    this.ruleSlot = new Int16Array(config.rules.length);
    for (let r = 0; r < config.rules.length; r++) this.ruleSlot[r] = this.slots.indexOf(config.rules[r].clip);
  }

  /** The slot currently faded in. */
  get visibleSlot(): number {
    return this.onceSlot >= 0 ? this.onceSlot : this.loopSlot;
  }

  /** Shows `initial` at once; called by the first update if not before. */
  start(): void {
    this.started = true;
    this.loopSlot = 0;
    this.loopRule = -1;
    this.loopVelocity = MAX_VELOCITY;
    this.onceSlot = -1;
    this.pendingRule = -1;
    this.silence = 0;
    this.sink.crossfade(0, 0, true, false);
    this.sink.setParams(0, 1, 1);
  }

  /** Advances one frame. `note` is the frame's pending winner (not cleared here). */
  update(dtSec: number, transport: TransportState, note: PendingNote | null): void {
    if (!this.started) this.start();
    const playing = transport.playing;

    if (this.wasPlaying && !playing && this.config.onStop === 'initial') this.goInitial();
    this.wasPlaying = playing;

    const beatWrap = transport.beatPhase < this.prevBeat;
    const barWrap = transport.barPhase < this.prevBar;
    this.prevBeat = transport.beatPhase;
    this.prevBar = transport.barPhase;

    if (note !== null && note.rule >= 0 && note.rule < this.config.rules.length) {
      this.silence = 0;
      const rule = this.config.rules[note.rule];
      if (rule.sync !== 'now' && playing) {
        this.pendingRule = note.rule;
        this.pendingVelocity = note.velocity;
      } else {
        this.pendingRule = -1;
        this.apply(note.rule, note.velocity);
      }
    } else {
      this.silence += dtSec;
    }

    if (this.pendingRule >= 0) {
      const sync = this.config.rules[this.pendingRule].sync;
      if (!playing || (sync === 'beat' && beatWrap) || (sync === 'bar' && barWrap)) {
        const r = this.pendingRule;
        this.pendingRule = -1;
        this.apply(r, this.pendingVelocity);
      }
    }

    const returnAfter = this.config.returnAfterMs / 1000;
    if (
      returnAfter > 0 &&
      this.silence >= returnAfter &&
      this.onceSlot < 0 &&
      this.pendingRule < 0 &&
      (this.loopSlot !== 0 || this.loopRule !== -1)
    ) {
      this.goInitial();
    }

    if (this.onceSlot >= 0) {
      const rule = this.config.rules[this.onceRule];
      const ts = clipTimeScale(rule, transport.bpm, playing, this.onceVelocity);
      this.onceTime += dtSec * ts;
      this.sink.setParams(this.onceSlot, ts, clipWeight(rule, this.onceVelocity));
      const fade = rule.fadeMs / 1000;
      if (this.onceTime >= this.durations[this.onceSlot] - fade * ts) {
        this.onceSlot = -1;
        this.onceRule = -1;
        this.sink.crossfade(this.loopSlot, fade, false, false);
      }
    }

    if (this.loopRule >= 0) {
      const rule = this.config.rules[this.loopRule];
      this.sink.setParams(this.loopSlot, clipTimeScale(rule, transport.bpm, playing, this.loopVelocity), clipWeight(rule, this.loopVelocity));
    } else {
      this.sink.setParams(this.loopSlot, 1, 1);
    }
  }

  private apply(r: number, velocity: number): void {
    const rule = this.config.rules[r];
    const slot = this.ruleSlot[r];
    const fade = rule.fadeMs / 1000;
    if (rule.mode === 'once') {
      // A once always restarts; one interrupting another keeps the same loop to return to.
      this.onceSlot = slot;
      this.onceRule = r;
      this.onceVelocity = velocity;
      this.onceTime = 0;
      this.sink.crossfade(slot, fade, true, true);
      return;
    }
    const same = slot === this.loopSlot;
    this.loopSlot = slot;
    this.loopRule = r;
    this.loopVelocity = velocity;
    if (this.onceSlot >= 0) {
      this.onceSlot = -1;
      this.onceRule = -1;
      this.sink.crossfade(slot, fade, !same, false);
    } else if (!same) {
      this.sink.crossfade(slot, fade, true, false);
    }
    // Same loop clip already showing: no restart; velocity updates speed/weight via setParams.
  }

  private goInitial(): void {
    const same = this.loopSlot === 0;
    const wasOnce = this.onceSlot >= 0;
    this.loopSlot = 0;
    this.loopRule = -1;
    this.loopVelocity = MAX_VELOCITY;
    this.onceSlot = -1;
    this.onceRule = -1;
    this.pendingRule = -1;
    if (!same || wasOnce) this.sink.crossfade(0, this.config.fadeMs / 1000, !same, false);
  }
}
