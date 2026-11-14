import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { EFFECT_DEFS, EFFECT_IDS } from "../manifests/effectIds";
import {
  buildEffectPreset,
  defaultEffectEntry
} from "../manifests/effectPreset";
import { buildSamplePack, noteName } from "../manifests/samplePack";
import {
  buildVisualizer,
  checkShaderSource,
  SHADER_MAX_BYTES
} from "../manifests/visualizer";
import { buildPreviewShader, PRELUDE_UNIFORMS } from "../shader/source";

const sample = (file: string, extra: Record<string, unknown> = {}) => ({
  file,
  name: file.replace(/\..*$/, ""),
  ...extra
});

describe("sample pack builder", () => {
  test("assigns free pads in order, keeping pads the creator chose", () => {
    const { manifest, errors } = buildSamplePack(
      {
        samples: [
          sample("kick.wav"),
          sample("snare.wav", { pad: 1 }),
          sample("hat.wav")
        ]
      },
      ["kick.wav", "snare.wav", "hat.wav"]
    );
    assert.deepEqual(errors, []);
    assert.equal(manifest.format, 1);
    assert.deepEqual(
      manifest.samples.map((s) => [s.file, s.pad]),
      [
        ["kick.wav", 2],
        ["snare.wav", 1],
        ["hat.wav", 3]
      ]
    );
  });

  test("fills defaults: root 60, one-shot, 0 dB", () => {
    const { manifest } = buildSamplePack({ samples: [sample("a.wav")] }, [
      "a.wav"
    ]);
    assert.equal(manifest.samples[0].root_note, 60);
    assert.equal(manifest.samples[0].one_shot, true);
    assert.equal(manifest.samples[0].gain_db, 0);
  });

  test("only the first 16 samples get pads", () => {
    const files = Array.from({ length: 18 }, (_, i) => `s${i}.wav`);
    const { manifest, errors } = buildSamplePack(
      { samples: files.map((f) => sample(f)) },
      files
    );
    assert.deepEqual(errors, []);
    assert.equal(manifest.samples[15].pad, 16);
    assert.equal(manifest.samples[16].pad, undefined);
  });

  test("rejects root_note out of range", () => {
    const { errors } = buildSamplePack(
      { samples: [sample("a.wav", { root_note: 128 })] },
      ["a.wav"]
    );
    assert.ok(
      errors.includes("samples[0].root_note must be 0..127"),
      errors.join()
    );
  });

  test("rejects a key zone with only one end", () => {
    const { errors } = buildSamplePack(
      { samples: [sample("a.wav"), sample("b.wav", { low_note: 40 })] },
      ["a.wav", "b.wav"]
    );
    assert.ok(errors.includes("samples[1].low_note given without high_note"));
  });

  test("rejects gain outside -24..12 and pads outside 1..16", () => {
    const { errors } = buildSamplePack(
      { samples: [sample("a.wav", { gain_db: 13, pad: 17 })] },
      ["a.wav"]
    );
    assert.ok(errors.includes("samples[0].gain_db must be -24..12"));
    assert.ok(errors.includes("samples[0].pad must be 1..16"));
  });

  test("rejects a pad used twice", () => {
    const { errors } = buildSamplePack(
      {
        samples: [sample("a.wav", { pad: 2 }), sample("b.wav", { pad: 2 })]
      },
      ["a.wav", "b.wav"]
    );
    assert.ok(errors.includes("samples[1].pad 2 is already used"));
  });

  test("rejects files that aren't attached and non-audio files", () => {
    const { errors } = buildSamplePack(
      { samples: [sample("kick.wav"), sample("cover.png")] },
      ["cover.png"]
    );
    assert.ok(errors.includes('file "kick.wav" is not attached'));
    assert.ok(errors.includes('samples[1].file "cover.png" is not audio'));
  });

  test("rejects an invalid pack_id and an empty pack", () => {
    assert.ok(
      buildSamplePack({ pack_id: "No Caps", samples: [] }, []).errors.includes(
        "pack_id invalid"
      )
    );
    assert.ok(
      buildSamplePack({ samples: [] }, []).errors.includes(
        "samples must have 1..64 entries"
      )
    );
  });

  test("noteName", () => {
    assert.equal(noteName(60), "C4");
    assert.equal(noteName(61), "C#4");
    assert.equal(noteName(0), "C-1");
  });
});

describe("effect preset builder", () => {
  test("the effect list mirrors the app's nine effects", () => {
    assert.deepEqual(EFFECT_IDS, [
      "drive",
      "crush",
      "eq",
      "chorus",
      "phaser",
      "echo",
      "reverb",
      "pump",
      "compressor"
    ]);
    assert.equal(EFFECT_DEFS.reverb.params.length, 4);
  });

  test("a default entry is valid", () => {
    const { manifest, errors } = buildEffectPreset([
      defaultEffectEntry("reverb")
    ]);
    assert.deepEqual(errors, []);
    assert.deepEqual(manifest, {
      format: 1,
      effects: [
        {
          id: "reverb",
          enabled: true,
          params: { size: 0.6, damping: 0.5, width: 1, mix: 0.3 }
        }
      ]
    });
  });

  test("rejects unknown ids", () => {
    const { errors } = buildEffectPreset([
      { id: "flanger", enabled: true, params: {} }
    ]);
    assert.ok(errors.includes('effects[0].id "flanger" unknown'));
  });

  test("rejects unknown params, out-of-range values and duplicates", () => {
    const { errors } = buildEffectPreset([
      { id: "echo", enabled: true, params: { mix: 2, wobble: 1 } },
      { id: "echo", enabled: false, params: {} }
    ]);
    assert.ok(errors.includes("effects[0].params.mix must be 0..1"));
    assert.ok(errors.includes('effects[0].params.wobble unknown for "echo"'));
    assert.ok(errors.includes('effects[1].id "echo" is listed twice'));
  });

  test("rejects an empty preset", () => {
    assert.ok(buildEffectPreset([]).errors.includes("add at least one effect"));
  });
});

describe("visualizer builder", () => {
  const param = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    label: name,
    min: 0,
    max: 1,
    default: 0.5,
    ...extra
  });

  test("a valid manifest passes", () => {
    const { manifest, errors } = buildVisualizer(
      {
        shader: "scene.glsl",
        params: [param("speed", { drive: "bass" })]
      },
      ["scene.glsl"]
    );
    assert.deepEqual(errors, []);
    assert.equal(manifest.format, 1);
    assert.equal(manifest.params[0].drive, "bass");
  });

  test("rejects bad param names", () => {
    const { errors } = buildVisualizer(
      {
        shader: "scene.glsl",
        params: [param("ok"), param("ok2"), param("Bad-Name"), param("9lives")]
      },
      ["scene.glsl"]
    );
    assert.ok(errors.includes("params[2].name invalid"), errors.join());
    assert.ok(errors.includes("params[3].name invalid"));
  });

  test("rejects more than 8 params, duplicates, bad ranges and drives", () => {
    const many = Array.from({ length: 9 }, (_, i) => param(`p${i}`));
    assert.ok(
      buildVisualizer({ shader: "s.glsl", params: many }, [
        "s.glsl"
      ]).errors.includes("params must have at most 8 entries")
    );
    const { errors } = buildVisualizer(
      {
        shader: "s.glsl",
        params: [
          param("a", { min: 1, max: 0 }),
          param("a"),
          param("b", { default: 2 }),
          param("c", { drive: "treble" })
        ]
      },
      ["s.glsl"]
    );
    assert.ok(errors.includes("params[0].min must be below max"));
    assert.ok(errors.includes('params[1].name "a" is used twice'));
    assert.ok(errors.includes("params[2].default must be within min..max"));
    assert.ok(errors.includes("params[3].drive invalid"));
  });

  test("the shader must be an attached .glsl file", () => {
    assert.ok(
      buildVisualizer({ shader: "", params: [] }, []).errors.includes(
        "add a .glsl shader file"
      )
    );
    assert.ok(
      buildVisualizer({ shader: "s.glsl", params: [] }, []).errors.includes(
        'file "s.glsl" is not attached'
      )
    );
  });
});

describe("shader source checks", () => {
  const ok = "vec4 beeperMain(vec2 uv) { return vec4(uv, uBass, 1.0); }";

  test("accepts a beeperMain-only file", () => {
    assert.deepEqual(checkShaderSource(ok), []);
  });

  test("names each forbidden construct", () => {
    const src = [
      "#version 100",
      "#extension GL_OES_standard_derivatives : enable",
      "#include <x>",
      "precision highp float;",
      "uniform float uFoo;",
      "attribute vec2 a;",
      "varying vec2 v;",
      "void main() {}",
      ok
    ].join("\n");
    const errors = checkShaderSource(src);
    for (const e of [
      "#version not allowed",
      "#extension not allowed",
      "#include not allowed",
      "precision declarations not allowed",
      "uniform declarations not allowed",
      "attribute declarations not allowed",
      "varying declarations not allowed",
      "void main not allowed (the host provides main)"
    ]) {
      assert.ok(errors.includes(e), `${e} in ${errors.join(" | ")}`);
    }
  });

  test("requires beeperMain and ignores comments", () => {
    assert.ok(
      checkShaderSource("// vec4 beeperMain(vec2 uv)\n").includes(
        "shader must define beeperMain"
      )
    );
    assert.deepEqual(checkShaderSource(`// uniform float x;\n${ok}`), []);
  });

  test("rejects files over 64 KB", () => {
    const big = ok + " ".repeat(SHADER_MAX_BYTES);
    assert.ok(checkShaderSource(big).includes("shader too large (max 64 KB)"));
  });
});

describe("preview shader", () => {
  test("declares exactly the contract uniforms plus uP_ params", () => {
    const src = buildPreviewShader(
      "vec4 beeperMain(vec2 uv) { return vec4(1.0); }",
      [{ name: "speed" }, { name: "glow" }]
    );
    const uniforms = Array.from(
      src.matchAll(/uniform\s+\w+\s+([\w,\s]+);/g)
    ).flatMap((m) => m[1].split(",").map((s) => s.trim()));
    assert.deepEqual(
      uniforms.sort(),
      [...PRELUDE_UNIFORMS, "uP_glow", "uP_speed"].sort()
    );
    assert.match(src, /void main\(\)/);
    assert.match(src, /beeperMain\(gl_FragCoord\.xy \/ uResolution\)/);
    assert.match(src, /^precision mediump float;/);
  });

  test("refuses param names outside the manifest rule", () => {
    assert.throws(() =>
      buildPreviewShader("vec4 beeperMain(vec2 uv){return vec4(0.);}", [
        { name: "x; uniform sampler2D t" }
      ])
    );
  });
});
