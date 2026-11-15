import { describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { NoteClipsConfig, normalizeManifest, NormalizedNoteClips } from '../manifest';
import {
  NoteClipsMachine,
  NoteClipsSink,
  PendingNote,
  TransportState,
  clipTimeScale,
  clipWeight,
  compileNoteRules,
  noteClipSlots,
  offerNoteEvent,
} from '../noteClips';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

function noteClips(nc: Omit<NoteClipsConfig, 'initial'> & { initial?: string }): NormalizedNoteClips {
  const n = normalizeManifest({ format: 1, type: 'gltf', scene: 's.glb', audio: { schemaVersion: 1, noteClips: { initial: 'Idle', ...nc } } });
  return n.audio.noteClips as NormalizedNoteClips;
}

describe('rule tables', () => {
  const nc = noteClips({
    rules: [
      { match: { part: 'keys', notes: [48, 59] }, clip: 'A' },
      { match: { part: 'synth', note: 50 }, clip: 'B' }, // shadowed by rule 0
      { match: { part: 'samplerKeys', notes: [60, 61] }, clip: 'C' },
      { match: { part: 'sampler', slots: [0, 3] }, clip: 'D' },
      { match: { part: 'drums', voices: ['clap', 'rim'] }, clip: 'E' },
      { match: { part: 'drums', voice: 'kick' }, clip: 'F' },
      { match: { part: 'synth', notes: [60, 127] }, clip: 'G' },
    ],
  });
  const t = compileNoteRules(nc);

  test('keys covers synth and samplerKeys; first matching rule wins', () => {
    assert.equal(t.match('synth', 48), 0);
    assert.equal(t.match('samplerKeys', 59), 0);
    assert.equal(t.match('synth', 50), 0);
    assert.equal(t.match('synth', 47), -1);
    assert.equal(t.match('samplerKeys', 60), 2);
    assert.equal(t.match('synth', 60), 6);
    assert.equal(t.match('synth', 127), 6);
  });

  test('sampler slots, drum voices (DRUM_VOICES order), bad input', () => {
    assert.equal(t.match('sampler', 3), 3);
    assert.equal(t.match('sampler', 4), -1);
    assert.equal(t.match('drums', 4), 4); // clap
    assert.equal(t.match('drums', 7), 4); // rim
    assert.equal(t.match('drums', 0), 5); // kick
    assert.equal(t.match('drums', 1), -1);
    assert.equal(t.match('drums', 9), -1);
    assert.equal(t.match('synth', 60.5), -1);
    assert.equal(t.match('synth', 128), -1);
    assert.equal(t.match('keys', 50), -1); // events carry synth | samplerKeys, never keys
    assert.equal(compileNoteRules(null).match('synth', 60), -1);
  });

  test('note-offs are ignored; priority last vs velocity (ties → last)', () => {
    const last = new PendingNote('last');
    assert.equal(offerNoteEvent(t, last, 'synth', 48, 100, false), false);
    assert.equal(last.has, false);
    offerNoteEvent(t, last, 'synth', 48, 100, true);
    offerNoteEvent(t, last, 'sampler', 2, 20, true);
    offerNoteEvent(t, last, 'synth', 20, 127, true); // no rule
    assert.deepStrictEqual([last.rule, last.velocity, last.part, last.note], [3, 20, 'sampler', 2]);

    const loud = new PendingNote('velocity');
    offerNoteEvent(t, loud, 'synth', 48, 100, true);
    offerNoteEvent(t, loud, 'sampler', 2, 20, true);
    assert.equal(loud.rule, 0);
    offerNoteEvent(t, loud, 'drums', 0, 100, true);
    assert.equal(loud.rule, 5);
    loud.clear();
    assert.equal(loud.has, false);
  });
});

describe('time scale and weight', () => {
  const nc = noteClips({
    rules: [
      { match: { part: 'synth', note: 1 }, clip: 'A', clipBpm: 120, timeScale: 0.5 },
      { match: { part: 'synth', note: 2 }, clip: 'B', velocity: { to: 'timeScale', range: [0.8, 1.2] } },
      { match: { part: 'synth', note: 3 }, clip: 'C', velocity: { to: 'weight', range: [0.5, 1] } },
    ],
  });
  test('clipBpm while playing, clamped 0.25..4', () => {
    assert.equal(clipTimeScale(nc.rules[0], 240, true, 100), 1);
    assert.equal(clipTimeScale(nc.rules[0], 240, false, 100), 0.5);
    assert.equal(clipTimeScale(nc.rules[0], 1000, true, 100), 2);
    assert.equal(clipTimeScale(nc.rules[0], 10, true, 100), 0.125);
  });
  test('velocity lerps vel/127', () => {
    close(clipTimeScale(nc.rules[1], 120, true, 0), 0.8);
    close(clipTimeScale(nc.rules[1], 120, true, 127), 1.2);
    assert.equal(clipWeight(nc.rules[2], 127), 1);
    assert.equal(clipWeight(nc.rules[2], 0), 0.5);
    assert.equal(clipWeight(nc.rules[1], 0), 1);
  });
});

type Call = ['crossfade', number, number, boolean, boolean] | ['params', number, number, number];

class RecordingSink implements NoteClipsSink {
  calls: Call[] = [];
  crossfade(slot: number, fadeSec: number, restart: boolean, once: boolean): void {
    this.calls.push(['crossfade', slot, fadeSec, restart, once]);
  }
  setParams(slot: number, timeScale: number, weight: number): void {
    this.calls.push(['params', slot, timeScale, weight]);
  }
  fades(): Call[] {
    const f = this.calls.filter((c) => c[0] === 'crossfade');
    this.calls = [];
    return f;
  }
}

function machine(nc: NormalizedNoteClips, durations?: number[]) {
  const sink = new RecordingSink();
  const slots = noteClipSlots(nc);
  const m = new NoteClipsMachine(nc, durations || slots.map(() => 1), sink);
  const transport: TransportState = { playing: false, bpm: 120, beatPhase: 0, barPhase: 0 };
  const pending = new PendingNote(nc.priority);
  const tables = compileNoteRules(nc);
  const frame = (dt = 0.016, part?: string, note?: number, velocity = 100) => {
    if (part !== undefined) offerNoteEvent(tables, pending, part, note as number, velocity, true);
    m.update(dt, transport, pending);
    pending.clear();
  };
  return { m, sink, transport, frame, slots };
}

describe('NoteClipsMachine', () => {
  const nc = noteClips({
    fadeMs: 200,
    rules: [
      { match: { part: 'synth', note: 60 }, clip: 'Dance1' },
      { match: { part: 'synth', note: 62 }, clip: 'Dance2', sync: 'beat', fadeMs: 100 },
      { match: { part: 'synth', note: 64 }, clip: 'Dance1', sync: 'bar' },
      { match: { part: 'sampler', slot: 15 }, clip: 'Wave', mode: 'once', fadeMs: 100 },
      { match: { part: 'drums', voice: 'kick' }, clip: 'Pump', mode: 'once', fadeMs: 0 },
    ],
  });

  test('slots: initial first, then rule clips', () => {
    assert.deepStrictEqual(noteClipSlots(nc), ['Idle', 'Dance1', 'Dance2', 'Wave', 'Pump']);
  });

  test('starts in initial; loop switch now; same loop is not restarted', () => {
    const { sink, frame } = machine(nc);
    frame();
    assert.deepStrictEqual(sink.fades(), [['crossfade', 0, 0, true, false]]);
    frame(0.016, 'synth', 60);
    assert.deepStrictEqual(sink.fades(), [['crossfade', 1, 0.2, true, false]]);
    frame(0.016, 'synth', 60);
    assert.deepStrictEqual(sink.fades(), []);
  });

  test('sync beat waits for the beat to wrap while playing; bar for the bar', () => {
    const { sink, transport, frame } = machine(nc);
    transport.playing = true;
    transport.beatPhase = 0.5;
    transport.barPhase = 0.5;
    frame();
    sink.fades();
    frame(0.016, 'synth', 62);
    transport.beatPhase = 0.9;
    frame();
    assert.deepStrictEqual(sink.fades(), []);
    transport.beatPhase = 0.05; // wrapped
    frame();
    assert.deepStrictEqual(sink.fades(), [['crossfade', 2, 0.1, true, false]]);

    frame(0.016, 'synth', 64);
    transport.beatPhase = 0.01; // a beat wrap does not release a bar-synced switch
    frame();
    transport.beatPhase = 0.5;
    frame();
    assert.deepStrictEqual(sink.fades(), []);
    transport.barPhase = 0.1;
    frame();
    assert.deepStrictEqual(sink.fades(), [['crossfade', 1, 0.2, true, false]]);
  });

  test('synced switch happens at once when stopped', () => {
    const { sink, frame } = machine(nc);
    frame();
    sink.fades();
    frame(0.016, 'synth', 62);
    assert.deepStrictEqual(sink.fades(), [['crossfade', 2, 0.1, true, false]]);
  });

  test('once returns to the loop it interrupted, fadeMs before its end; once over once keeps that loop', () => {
    const { m, sink, frame } = machine(nc, [2, 2, 2, 1, 0.5]);
    frame();
    frame(0.016, 'synth', 60); // loop Dance1
    sink.fades();
    frame(0.1, 'sampler', 15); // once Wave (1 s, fade 0.1)
    assert.deepStrictEqual(sink.fades(), [['crossfade', 3, 0.1, true, true]]);
    for (let i = 0; i < 7; i++) frame(0.1);
    assert.deepStrictEqual(sink.fades(), []);
    frame(0.1, 'drums', 0); // once Pump interrupts Wave
    assert.deepStrictEqual(sink.fades(), [['crossfade', 4, 0, true, true]]);
    for (let i = 0; i < 3; i++) frame(0.1);
    assert.deepStrictEqual(sink.fades(), []);
    frame(0.1); // 0.5 s of Pump played
    assert.deepStrictEqual(sink.fades(), [['crossfade', 1, 0, false, false]]);
    assert.equal(m.visibleSlot, 1);
  });

  test('a loop rule during a once switches at once', () => {
    const { sink, frame } = machine(nc, [2, 2, 2, 1, 0.5]);
    frame();
    frame(0.016, 'sampler', 15);
    sink.fades();
    frame(0.016, 'synth', 60);
    assert.deepStrictEqual(sink.fades(), [['crossfade', 1, 0.2, true, false]]);
  });

  test('onStop initial; hold keeps the clip', () => {
    const stop = machine(noteClips({ onStop: 'initial', rules: nc.rules.map((r) => ({ match: { part: 'synth', note: r.match.lo >= 0 ? r.match.lo : 0 }, clip: r.clip })) }));
    stop.transport.playing = true;
    stop.frame();
    stop.frame(0.016, 'synth', 60);
    stop.sink.fades();
    stop.transport.playing = false;
    stop.frame();
    assert.deepStrictEqual(stop.sink.fades(), [['crossfade', 0, 0.25, true, false]]);

    const hold = machine(nc);
    hold.transport.playing = true;
    hold.frame();
    hold.frame(0.016, 'synth', 60);
    hold.sink.fades();
    hold.transport.playing = false;
    hold.frame();
    assert.deepStrictEqual(hold.sink.fades(), []);
  });

  test('returnAfterMs: back to initial after silence', () => {
    const { sink, frame } = machine(noteClips({ returnAfterMs: 500, rules: [{ match: { part: 'synth', note: 60 }, clip: 'Dance1' }] }));
    frame();
    frame(0.016, 'synth', 60);
    sink.fades();
    for (let i = 0; i < 4; i++) frame(0.1);
    frame(0.016, 'synth', 60); // resets the silence
    for (let i = 0; i < 4; i++) frame(0.1);
    assert.deepStrictEqual(sink.fades(), []);
    frame(0.1);
    frame(0.1);
    assert.deepStrictEqual(sink.fades(), [['crossfade', 0, 0.25, true, false]]);
    frame(1);
    assert.deepStrictEqual(sink.fades(), []);
  });

  test('loop params follow tempo each frame (clipBpm)', () => {
    const { sink, transport, frame } = machine(noteClips({ rules: [{ match: { part: 'synth', note: 60 }, clip: 'Dance1', clipBpm: 100, velocity: { to: 'weight', range: [0, 1] } }] }));
    transport.playing = true;
    transport.bpm = 150;
    frame(0.016, 'synth', 60, 127);
    const params = sink.calls.filter((c) => c[0] === 'params');
    assert.deepStrictEqual(params[params.length - 1], ['params', 1, 1.5, 1]);
    sink.calls = [];
    transport.bpm = 2000;
    frame();
    assert.deepStrictEqual(sink.calls[sink.calls.length - 1], ['params', 1, 4, 1]);
  });
});
