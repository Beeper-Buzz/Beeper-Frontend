import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { SOURCE_INDEX } from "../gltfVisualizer/core/bindings";
import {
  compileNoteRules,
  PendingNote,
  offerNoteEvent
} from "../gltfVisualizer/core/noteClips";
import { normalizeManifest } from "../gltfVisualizer/core/manifest";
import {
  DemoGroove,
  GrooveEvent,
  HIT_MIN_AMP,
  HIT_TAU,
  hitAmp,
  noteHz,
  PROGRESSION,
  velocityFromY
} from "../gltfVisualizer/demoGroove";

const DT = 1 / 60;
const src = (g: DemoGroove, name: keyof typeof SOURCE_INDEX) =>
  g.sources[SOURCE_INDEX[name]];

/** Ticks `seconds` of groove at 60 fps and returns every event. */
const run = (g: DemoGroove, seconds: number, dt = DT): GrooveEvent[] => {
  const out: GrooveEvent[] = [];
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i++) out.push(...g.tick(dt));
  return out;
};

const count = (evs: GrooveEvent[], part: string, note?: number) =>
  evs.filter((e) => e.part === part && (note === undefined || e.note === note))
    .length;

describe("demo groove: pattern", () => {
  test("the first tick plays beat 1: kick, closed hat and the first arp note", () => {
    const g = new DemoGroove();
    const evs = g.tick(DT);
    assert.deepEqual(
      evs.map((e) => [e.part, e.note]),
      [
        ["drums", 0],
        ["drums", 2],
        ["synth", PROGRESSION[0][0]]
      ]
    );
    for (const e of evs) assert.ok(e.velocity >= 1 && e.velocity <= 127);
  });

  test("one bar at 120 BPM: kick on 1 and 3, snare on 2 and 4, hats on eighths, 8 arp notes", () => {
    const g = new DemoGroove();
    const evs = run(g, 2);
    assert.equal(count(evs, "drums", 0), 2, "kicks");
    assert.equal(count(evs, "drums", 1), 2, "snares");
    assert.equal(count(evs, "drums", 2) + count(evs, "drums", 3), 8, "hats");
    assert.equal(count(evs, "synth"), 8, "arp");
    // The arp walks the first chord, then the next bar moves to the second.
    for (const e of evs.filter((x) => x.part === "synth")) {
      const tones = [...PROGRESSION[0], PROGRESSION[0][0] + 12];
      assert.ok(tones.includes(e.note), `note ${e.note} in chord 1`);
    }
    const next = run(g, 2).filter((x) => x.part === "synth");
    const tones2 = [...PROGRESSION[1], PROGRESSION[1][0] + 12];
    for (const e of next) assert.ok(tones2.includes(e.note));
  });

  test("is deterministic for the same frame times", () => {
    const a = new DemoGroove();
    const b = new DemoGroove();
    const ea = run(a, 3.3);
    const eb = run(b, 3.3);
    assert.deepEqual(ea, eb);
    assert.deepEqual(Array.from(a.sources), Array.from(b.sources));
  });

  test("events don't depend on the frame rate", () => {
    // 3.9 s: off the eighth grid, so float accumulation can't move the last event.
    const a = run(new DemoGroove(), 3.9, 1 / 60);
    const b = run(new DemoGroove(), 3.9, 1 / 25);
    // 16 eighths (hat + arp note each) and 8 beats (kick or snare).
    assert.equal(a.length, 16 * 2 + 8);
    assert.deepEqual(
      a.map((e) => [e.part, e.note]),
      b.map((e) => [e.part, e.note])
    );
  });

  test("tempo changes keep the beat position and stretch time", () => {
    const g = new DemoGroove({ bpm: 60 });
    const evs = run(g, 4); // one bar at 60 BPM
    assert.equal(count(evs, "drums", 0), 2);
    assert.equal(src(g, "bpm"), 60);
    g.bpm = 120;
    assert.equal(g.transport.bpm, 120);
  });
});

describe("demo groove: transport and sources", () => {
  test("phases, beat ramp and playing", () => {
    const g = new DemoGroove();
    run(g, 0.25, 0.0625); // 4 frames: half a beat
    assert.ok(Math.abs(g.transport.beatPhase - 0.5) < 1e-9);
    assert.ok(Math.abs(g.transport.barPhase - 0.125) < 1e-9);
    assert.equal(g.transport.playing, true);
    assert.equal(src(g, "playing"), 1);
    assert.equal(src(g, "beat"), 0, "beat is 0 past a quarter beat");
    const h = new DemoGroove();
    h.tick(0.0625); // phase 0.125
    assert.ok(Math.abs(src(h, "beat") - 0.5) < 1e-6);
    assert.ok(Math.abs(src(h, "beatPhase") - 0.125) < 1e-6);
  });

  test("hit pulses decay with τ 0.06 s from an amplitude of at least 0.4", () => {
    assert.equal(HIT_TAU, 0.06);
    assert.equal(HIT_MIN_AMP, 0.4);
    assert.equal(hitAmp(0), 0.4);
    assert.equal(hitAmp(127), 1);
    const g = new DemoGroove({ mode: "silent" });
    g.trigger("drums", 0, 127);
    assert.ok(Math.abs(src(g, "kick") - 1) < 1e-6);
    assert.ok(Math.abs(src(g, "drums") - 1) < 1e-6);
    assert.ok(Math.abs(src(g, "hit") - 1) < 1e-6);
    g.tick(HIT_TAU);
    assert.ok(Math.abs(src(g, "kick") - Math.exp(-1)) < 1e-6);
  });

  test("every source is in its natural range over a few bars", () => {
    const g = new DemoGroove();
    for (let i = 0; i < 600; i++) {
      g.tick(DT);
      for (const name of Object.keys(
        SOURCE_INDEX
      ) as (keyof typeof SOURCE_INDEX)[]) {
        const v = src(g, name);
        assert.ok(Number.isFinite(v), name);
        if (name === "bpm") assert.equal(v, 120);
        else if (name === "note") assert.ok(v >= -1 && v <= 127, name);
        else if (name === "noteHz") assert.ok(v >= 0 && v < 13000, name);
        else assert.ok(v >= 0 && v <= 1, `${name} = ${v}`);
      }
    }
    assert.ok(src(g, "bass") > 0, "bass moves");
    assert.ok(src(g, "level") > 0, "level moves");
  });

  test("the bass envelope follows the kick", () => {
    const g = new DemoGroove();
    g.tick(DT); // kick at beat 1
    const onKick = src(g, "bass");
    run(g, 0.4); // late in beat 1, before the snare
    assert.ok(src(g, "bass") < onKick);
  });

  test("note, noteHz and notePulse follow the arp", () => {
    const g = new DemoGroove();
    g.tick(DT);
    assert.equal(src(g, "note"), PROGRESSION[0][0]);
    assert.ok(Math.abs(src(g, "noteHz") - noteHz(PROGRESSION[0][0])) < 1e-3);
    assert.ok(src(g, "notePulse") > 0.9);
    assert.ok(Math.abs(noteHz(69) - 440) < 1e-9);
  });

  test("fills the sources vector in SOURCE_INDEX order", () => {
    const g = new DemoGroove();
    assert.equal(g.sources.length, Object.keys(SOURCE_INDEX).length);
    g.tick(DT);
    assert.equal(g.sources[SOURCE_INDEX.bpm], 120);
    assert.equal(g.sources[SOURCE_INDEX.playing], 1);
  });
});

describe("demo groove: silent and manual triggers", () => {
  test("silent: stopped transport, no events, note −1, quiet bands", () => {
    const g = new DemoGroove({ mode: "silent" });
    const evs = run(g, 2);
    assert.equal(evs.length, 0);
    assert.equal(g.transport.playing, false);
    assert.equal(src(g, "playing"), 0);
    assert.equal(src(g, "note"), -1);
    assert.equal(src(g, "beat"), 0);
    assert.equal(src(g, "bass"), 0);
    assert.equal(src(g, "level"), 0);
  });

  test("switching to silent stops the groove; back to groove restarts at bar 1", () => {
    const g = new DemoGroove();
    run(g, 1.3);
    g.setMode("silent");
    assert.equal(run(g, 1).length, 0);
    g.setMode("groove");
    const evs = g.tick(DT);
    assert.equal(evs[0].part, "drums");
    assert.equal(evs[0].note, 0);
    assert.equal(g.mode, "groove");
  });

  test("a manual trigger is returned by the next tick, once, and raises its pulses", () => {
    const g = new DemoGroove({ mode: "silent" });
    const e = g.trigger("sampler", 15, 100);
    assert.deepEqual(e, { part: "sampler", note: 15, velocity: 100 });
    assert.ok(src(g, "sampler") > 0.8);
    // A sampler pad counts toward the snare register at half amplitude.
    assert.ok(Math.abs(src(g, "snare") - hitAmp(100) / 2) < 1e-6);
    assert.deepEqual(g.tick(DT), [e]);
    assert.deepEqual(g.tick(DT), []);
  });

  test("drum voices map to registers: clap → snare, low tom → kick, open hat → hats", () => {
    const g = new DemoGroove({ mode: "silent" });
    g.trigger("drums", 4, 127); // clap
    assert.ok(src(g, "snare") > 0.99);
    assert.equal(src(g, "kick"), 0);
    g.trigger("drums", 5, 127); // low tom
    assert.ok(src(g, "kick") > 0.99);
    g.trigger("drums", 3, 127); // open hat
    assert.ok(src(g, "hats") > 0.99);
  });

  test("keys set the note; synth and sampler keys raise their part pulse", () => {
    const g = new DemoGroove({ mode: "silent" });
    g.trigger("synth", 60, 80);
    assert.equal(src(g, "note"), 60);
    assert.ok(src(g, "synth") > 0.5);
    g.trigger("samplerKeys", 64, 80);
    assert.equal(src(g, "note"), 64);
    assert.ok(src(g, "sampler") > 0.5);
  });

  test("velocity comes from the click height: top loud, bottom soft", () => {
    assert.equal(velocityFromY(0, 100), 127);
    assert.equal(velocityFromY(100, 100), 20);
    assert.ok(velocityFromY(50, 100) > 60 && velocityFromY(50, 100) < 90);
    assert.equal(velocityFromY(-5, 100), 127);
    assert.equal(velocityFromY(5, 0), 100);
  });
});

describe("demo groove drives noteClips matching", () => {
  test("groove snares and manual pads reach a pending winner", () => {
    const n = normalizeManifest({
      format: 1,
      type: "gltf",
      scene: "a.glb",
      audio: {
        schemaVersion: 1,
        noteClips: {
          initial: "Idle",
          rules: [
            {
              match: { part: "drums", voice: "snare" },
              clip: "Pump",
              mode: "once"
            },
            { match: { part: "sampler", slot: 15 }, clip: "Wave", mode: "once" }
          ]
        }
      }
    });
    const tables = compileNoteRules(n.audio.noteClips);
    const pending = new PendingNote("last");
    const g = new DemoGroove();
    const offer = (evs: GrooveEvent[]) => {
      for (const e of evs)
        offerNoteEvent(tables, pending, e.part, e.note, e.velocity, true);
    };
    offer(run(g, 0.6)); // past the beat-2 snare
    assert.equal(pending.rule, 0);
    pending.clear();
    g.trigger("sampler", 15, 90);
    offer(g.tick(DT));
    assert.equal(pending.rule, 1);
  });
});
