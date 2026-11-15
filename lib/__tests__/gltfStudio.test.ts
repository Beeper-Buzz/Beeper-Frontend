import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { SceneSummary } from "../gltfVisualizer/core/glb";
import type { BindingConfig } from "../gltfVisualizer/core/manifest";
import {
  bindingSources,
  cameraFromView,
  configFromManifest,
  defaultBinding,
  defaultTarget,
  describeBinding,
  describeRule,
  emptyGltfConfig,
  errorMessage,
  errorPath,
  errorsAt,
  gltfManifest,
  IMPORT_MAX_BYTES,
  moveItem,
  parseVisualizerImport,
  targetChoices,
  withSources
} from "../gltfVisualizer/edit";
import {
  SCENE_CHECKING,
  SCENE_DOWNLOAD_FAILED,
  SCENE_OPEN_PREVIEW,
  sceneCheckFrom,
  sceneFileKey
} from "../gltfVisualizer/sceneCheck";
import { buildGltfVisualizer, buildVisualizer } from "../manifests/visualizer";

const summary: SceneSummary = {
  nodes: ["Root", "Cone", "KeyLight", "Cam", "Dup", "Dup", ""],
  meshes: [
    { name: "Body", morphs: ["Smile", "Blink"] },
    { name: "Box", morphs: [] }
  ],
  materials: ["Skin", "Neon", ""],
  animations: [
    { name: "Idle", duration: 2 },
    { name: "Dance1", duration: 1.9 }
  ],
  lights: ["KeyLight"],
  cameras: ["Cam"]
};

describe("config ↔ manifest", () => {
  test("gltfManifest puts the envelope first and leaves out empty parts", () => {
    const m = gltfManifest(emptyGltfConfig(), "dancer.glb", null);
    assert.deepEqual(m, {
      format: 1,
      type: "gltf",
      scene: "dancer.glb",
      audio: { schemaVersion: 1, bindings: [] }
    });
    const withPoster = gltfManifest(
      { view: { background: "#000000" }, audio: { schemaVersion: 1 } },
      "a.glb",
      "poster.jpg"
    );
    assert.equal(withPoster.poster, "poster.jpg");
    assert.deepEqual(withPoster.view, { background: "#000000" });
  });

  test("configFromManifest keeps view, materials and audio and drops the rest", () => {
    const c = configFromManifest({
      format: 1,
      type: "gltf",
      scene: "x.glb",
      files: { "x.glb": "abc" },
      view: { lighting: "scene" },
      audio: { schemaVersion: 1, bindings: [] }
    });
    assert.deepEqual(c, {
      view: { lighting: "scene" },
      audio: { schemaVersion: 1, bindings: [] }
    });
    assert.deepEqual(configFromManifest(null), emptyGltfConfig());
    assert.deepEqual(configFromManifest({ audio: 5 }).audio, {
      schemaVersion: 1,
      bindings: []
    });
  });
});

describe("error paths", () => {
  const errors = [
    'audio.bindings[2].target.node: "X" is not a node in the scene',
    "audio.bindings[2]: needs source or sources",
    "audio.bindings[12].curve: must be one of …",
    "scene: the file is 21.0 MB; the limit is 20.0 MB"
  ];
  test("errorPath and errorMessage split at the first ': '", () => {
    assert.equal(errorPath(errors[0]), "audio.bindings[2].target.node");
    assert.equal(errorMessage(errors[1]), "needs source or sources");
    assert.equal(errorPath("no separator"), "");
  });
  test("errorsAt matches the path or anything under it, not a longer index", () => {
    assert.deepEqual(errorsAt(errors, "audio.bindings[2]"), [
      errors[0],
      errors[1]
    ]);
    assert.deepEqual(errorsAt(errors, "audio.bindings[2]", true), [errors[1]]);
    assert.deepEqual(errorsAt(errors, "audio.bindings[1]"), []);
    assert.deepEqual(errorsAt(errors, "scene"), [errors[3]]);
  });
});

describe("binding sources", () => {
  test("one source reads as one row of weight 1", () => {
    assert.deepEqual(
      bindingSources({
        source: "kick",
        target: { kind: "camera", property: "dolly" }
      }),
      [{ source: "kick", weight: 1 }]
    );
  });
  test("sources keep their weights (default 1)", () => {
    const b: BindingConfig = {
      sources: [{ source: "bass", weight: 0.7 }, { source: "hit" }],
      combine: "max",
      target: { kind: "camera", property: "dolly" }
    };
    assert.deepEqual(bindingSources(b), [
      { source: "bass", weight: 0.7 },
      { source: "hit", weight: 1 }
    ]);
  });
  test("withSources writes source for one plain row, sources + combine otherwise", () => {
    const base: BindingConfig = {
      sources: [{ source: "bass" }, { source: "hit" }],
      combine: "max",
      target: { kind: "camera", property: "dolly" }
    };
    const one = withSources(base, [{ source: "kick", weight: 1 }]);
    assert.equal(one.source, "kick");
    assert.equal("sources" in one, false);
    assert.equal("combine" in one, false);
    const weighted = withSources(base, [{ source: "kick", weight: 0.5 }]);
    assert.deepEqual(weighted.sources, [{ source: "kick", weight: 0.5 }]);
    assert.equal("source" in weighted, false);
    const two = withSources(
      { source: "kick", target: base.target },
      [
        { source: "bass", weight: 1 },
        { source: "hit", weight: 0.5 }
      ],
      "max"
    );
    assert.deepEqual(two.sources, [
      { source: "bass" },
      { source: "hit", weight: 0.5 }
    ]);
    assert.equal(two.combine, "max");
    assert.equal("source" in two, false);
  });
});

describe("target choices", () => {
  test("only unique, non-empty names are offered", () => {
    const c = targetChoices(summary);
    assert.deepEqual(c.nodes, ["Root", "Cone", "KeyLight", "Cam"]);
    assert.deepEqual(c.materials, ["Skin", "Neon"]);
    assert.deepEqual(c.clips, ["Idle", "Dance1"]);
    assert.deepEqual(c.morphMeshes, [
      { name: "Body", morphs: ["Smile", "Blink"] }
    ]);
    assert.deepEqual(c.lights, ["KeyLight"]);
    assert.deepEqual(c.cameras, ["Cam"]);
    assert.deepEqual(targetChoices(null).nodes, []);
  });

  test("defaultTarget picks the first name of the kind", () => {
    const c = targetChoices(summary);
    assert.deepEqual(defaultTarget("node", c), {
      kind: "node",
      node: "Root",
      property: "scale"
    });
    assert.deepEqual(defaultTarget("morph", c), {
      kind: "morph",
      mesh: "Body",
      morph: "Smile"
    });
    assert.deepEqual(defaultTarget("clip", c), {
      kind: "clip",
      clip: "Idle",
      mode: "weight"
    });
    assert.deepEqual(defaultTarget("material", c), {
      kind: "material",
      material: "Skin",
      property: "emissiveIntensity"
    });
    assert.deepEqual(defaultTarget("light", c), {
      kind: "light",
      light: "KeyLight",
      property: "intensity"
    });
    assert.deepEqual(defaultTarget("camera", c), {
      kind: "camera",
      property: "orbitSpeed"
    });
  });

  test("defaultBinding: a kick on the first node, with an unused id", () => {
    const c = targetChoices(summary);
    const b = defaultBinding(c, ["b1", "b2"]);
    assert.equal(b.id, "b3");
    assert.equal(b.source, "kick");
    assert.equal(b.target.kind, "node");
    const none = defaultBinding(targetChoices(null), []);
    assert.deepEqual(none.target, { kind: "camera", property: "orbitSpeed" });
  });
});

describe("summaries", () => {
  test("describeBinding reads like the wireframe", () => {
    assert.equal(
      describeBinding({
        source: "kick",
        outputRange: [1, 1.25],
        target: { kind: "node", node: "Cone", property: "scale", axis: "xyz" }
      }),
      "kick → Cone · scale xyz 1 → 1.25"
    );
    assert.equal(
      describeBinding({
        sources: [
          { source: "bass", weight: 0.7 },
          { source: "hit", weight: 0.5 }
        ],
        combine: "max",
        outputRange: [0.5, 6],
        target: {
          kind: "material",
          material: "Neon",
          property: "emissiveIntensity"
        }
      }),
      "bass+hit max → Neon · emissiveIntensity 0.5 → 6"
    );
    // Defaults come from limits.outputDefaults.
    assert.equal(
      describeBinding({
        source: "level",
        target: { kind: "camera", property: "orbitSpeed" }
      }),
      "level → camera · orbitSpeed 0 → 30"
    );
    assert.equal(
      describeBinding({
        source: "beat",
        target: { kind: "clip", clip: "Dance1", mode: "play" }
      }),
      "beat → Dance1 · play at 0.5"
    );
    assert.equal(
      describeBinding({
        source: "notePulse",
        target: { kind: "morph", mesh: "Body", morph: "Smile" }
      }),
      "notePulse → Body/Smile · morph 0 → 1"
    );
  });

  test("describeRule reads like the wireframe", () => {
    assert.equal(
      describeRule({
        match: { part: "keys", notes: [48, 59] },
        clip: "Dance1",
        mode: "loop",
        sync: "beat",
        clipBpm: 120
      }),
      "keys 48–59 → Dance1 loop · beat · 120 bpm"
    );
    assert.equal(
      describeRule({
        match: { part: "sampler", slot: 15 },
        clip: "Wave",
        mode: "once"
      }),
      "pad 16 → Wave once"
    );
    assert.equal(
      describeRule({
        match: { part: "drums", voices: ["clap", "rim"] },
        clip: "Pump",
        mode: "once"
      }),
      "drums clap, rim → Pump once"
    );
  });
});

describe("helpers", () => {
  test("moveItem moves within bounds and copies", () => {
    const a = [1, 2, 3];
    assert.deepEqual(moveItem(a, 0, 1), [2, 1, 3]);
    assert.deepEqual(moveItem(a, 2, 1), [1, 2, 3]);
    assert.deepEqual(moveItem(a, 0, -1), [1, 2, 3]);
    assert.deepEqual(a, [1, 2, 3]);
  });

  test("cameraFromView inverts the rig's framing", () => {
    const deg = Math.PI / 180;
    const c = { x: 1, y: 2, z: 3 };
    const dist = 4;
    const el = 20 * deg;
    const az = -35 * deg;
    const p = {
      x: c.x + dist * Math.cos(el) * Math.sin(az),
      y: c.y + dist * Math.sin(el),
      z: c.z + dist * Math.cos(el) * Math.cos(az)
    };
    // The rig camera sat at distance 2 with the configured factor 1.5.
    const v = cameraFromView(p, c, 2, 1.5);
    assert.equal(v.distance, 3);
    assert.equal(v.elevation, 20);
    assert.equal(v.azimuth, -35);
    // Clamped to the schema's ranges.
    const far = cameraFromView(
      { x: 0, y: 100, z: 0.001 },
      { x: 0, y: 0, z: 0 },
      1,
      1
    );
    assert.equal(far.distance, 10);
    assert.equal(far.elevation, 80);
  });
});

describe("buildGltfVisualizer", () => {
  const config = {
    audio: {
      schemaVersion: 1 as const,
      bindings: [
        {
          source: "kick" as const,
          target: {
            kind: "node" as const,
            node: "Cone",
            property: "scale" as const
          }
        }
      ]
    }
  };

  test("scene and poster come from the attached files", () => {
    const { manifest, errors } = buildGltfVisualizer(
      { config },
      [
        { name: "dancer.glb", size: 5_000_000 },
        { name: "poster.jpg", size: 200_000 }
      ],
      { errors: [], summary, stats: null }
    );
    assert.deepEqual(errors, []);
    assert.equal(manifest.type, "gltf");
    assert.equal(manifest.scene, "dancer.glb");
    assert.equal(manifest.poster, "poster.jpg");
  });

  test("asks for a .glb, one poster ≤ 2 MB, and no other files", () => {
    const none = buildGltfVisualizer({ config }, [], null);
    assert.deepEqual(
      none.errors.filter((e) => e.startsWith("scene")).length,
      1
    );
    assert.match(none.errors[0], /^scene: add a \.glb/);
    const many = buildGltfVisualizer(
      { config },
      [
        { name: "a.glb", size: 10 },
        { name: "b.glb", size: 10 },
        { name: "p.png", size: 3 * 1024 * 1024 },
        { name: "q.webp", size: 10 },
        { name: "shader.glsl", size: 10 }
      ],
      null
    );
    assert.ok(many.errors.some((e) => /^scene: attach one \.glb/.test(e)));
    assert.ok(many.errors.some((e) => /^poster: attach one/.test(e)));
    assert.ok(
      many.errors.some((e) => /^poster: p\.png is over the 2 MB limit/.test(e))
    );
    assert.ok(many.errors.some((e) => /^files: shader\.glsl/.test(e)));
  });

  test("names resolve against the scene once it's inspected; inspection errors come first", () => {
    const bad = {
      audio: {
        schemaVersion: 1 as const,
        bindings: [
          {
            source: "kick" as const,
            target: {
              kind: "node" as const,
              node: "Nope",
              property: "scale" as const
            }
          }
        ]
      }
    };
    const files = [{ name: "a.glb", size: 10 }];
    assert.deepEqual(
      buildGltfVisualizer({ config: bad }, files, null).errors,
      []
    );
    const checked = buildGltfVisualizer({ config: bad }, files, {
      errors: ["scene.images[0]: too big"],
      summary,
      stats: null
    });
    assert.equal(checked.errors[0], "scene.images[0]: too big");
    assert.ok(
      checked.errors.some((e) =>
        e.startsWith("audio.bindings[0].target.node: ")
      )
    );
  });
});

describe("the wizard's scene check", () => {
  const inspection = (errors: string[] = []) => ({
    errors,
    summary,
    stats: null
  });
  const file = (over: Partial<Parameters<typeof sceneCheckFrom>[0]> = {}) => ({
    key: sceneFileKey("dancer.glb", 5000),
    bytes: new ArrayBuffer(8),
    inspection: inspection(),
    readError: null,
    ...over
  });

  test("keys files by name and size", () => {
    assert.equal(sceneFileKey("dancer.glb", 5000), "dancer.glb:5000");
  });

  test("blocks while the file is unread or being read", () => {
    assert.deepEqual(sceneCheckFrom(null, null).errors, [SCENE_CHECKING]);
    assert.deepEqual(
      sceneCheckFrom(file({ bytes: null, inspection: null }), null).errors,
      [SCENE_CHECKING]
    );
  });

  test("a failed download asks to re-pick the file", () => {
    const c = sceneCheckFrom(
      file({ bytes: null, inspection: null, readError: SCENE_DOWNLOAD_FAILED }),
      { loaded: true, error: null }
    );
    assert.deepEqual(c.errors, [SCENE_DOWNLOAD_FAILED]);
    assert.match(c.errors[0], /re-pick the file/);
  });

  test("the inspector's errors come before anything the preview knows", () => {
    const c = sceneCheckFrom(
      file({ inspection: inspection(["scene: Draco isn't supported"]) }),
      {
        loaded: true,
        error: null
      }
    );
    assert.deepEqual(c.errors, ["scene: Draco isn't supported"]);
    assert.equal(c.summary, summary);
  });

  test("until the preview has built the rig once, it asks to open the Scene step", () => {
    assert.deepEqual(sceneCheckFrom(file(), null).errors, [SCENE_OPEN_PREVIEW]);
    assert.deepEqual(
      sceneCheckFrom(file(), { loaded: false, error: null }).errors,
      [SCENE_OPEN_PREVIEW]
    );
  });

  test("a loader or rig error blocks; a loaded scene passes", () => {
    assert.deepEqual(
      sceneCheckFrom(file(), {
        loaded: true,
        error: "audio.bindings[0].target: no such node"
      }).errors,
      ["audio.bindings[0].target: no such node"]
    );
    const ok = sceneCheckFrom(file(), { loaded: true, error: null });
    assert.deepEqual(ok.errors, []);
    assert.equal(ok.summary, summary);
  });
});

describe("leftover files", () => {
  test("a shader visualizer flags a scene's files", () => {
    const { errors } = buildVisualizer({ shader: "a.glsl", params: [] }, [
      "a.glsl",
      "dancer.glb",
      "poster.png"
    ]);
    assert.deepEqual(errors, [
      "files: dancer.glb isn't part of a shader; remove it",
      "files: poster.png isn't part of a shader; remove it"
    ]);
  });

  test("a 3D scene flags a shader's files", () => {
    const { errors } = buildGltfVisualizer(
      { config: emptyGltfConfig() },
      [
        { name: "dancer.glb", size: 10 },
        { name: "a.glsl", size: 10 }
      ],
      null
    );
    assert.ok(
      errors.includes("files: a.glsl isn't part of a 3D scene; remove it")
    );
  });
});

describe("importing a visualizer.json", () => {
  const good = {
    format: 1,
    type: "gltf",
    scene: "other.glb",
    view: { lighting: "studio" },
    audio: {
      schemaVersion: 1,
      bindings: [
        {
          source: "kick",
          target: { kind: "node", node: "Cone", property: "scale" }
        }
      ]
    }
  };

  test("a valid file imports its config and the scene it was written for", () => {
    const r = parseVisualizerImport(JSON.stringify(good));
    assert.ok("config" in r);
    if (!("config" in r)) return;
    assert.equal(r.scene, "other.glb");
    assert.equal(r.config.audio.bindings?.length, 1);
    assert.deepEqual(r.config.view, { lighting: "studio" });
  });

  test("value problems import (they show in the studio like any edit)", () => {
    const m = structuredClone(good) as any;
    m.audio.bindings[0].outputRange = [1, 99];
    const r = parseVisualizerImport(JSON.stringify(m));
    assert.ok("config" in r);
  });

  test("not JSON, not a 3D scene, or the wrong shape: refused with the reasons", () => {
    assert.deepEqual(parseVisualizerImport("{nope"), {
      errors: ["isn't valid JSON"]
    });
    assert.deepEqual(
      parseVisualizerImport(JSON.stringify({ format: 1, shader: "a.glsl" })),
      { errors: ['isn\'t a 3D scene visualizer.json (no "type": "gltf")'] }
    );
    const bad = parseVisualizerImport(
      JSON.stringify({
        ...good,
        audio: { schemaVersion: 1, bindings: { a: 1 } }
      })
    );
    assert.ok("errors" in bad);
    if ("errors" in bad)
      assert.ok(
        bad.errors.some((e) => e.startsWith("audio.bindings: must be an array"))
      );
    const wrongMaterials = parseVisualizerImport(
      JSON.stringify({ ...good, materials: { material: "*" } })
    );
    assert.ok("errors" in wrongMaterials);
  });

  test("lists at most five reasons", () => {
    const m = structuredClone(good) as any;
    m.audio.bindings = Array.from({ length: 8 }, () => 7);
    const r = parseVisualizerImport(JSON.stringify(m));
    assert.ok("errors" in r);
    if (!("errors" in r)) return;
    assert.equal(r.errors.length, 6);
    assert.match(r.errors[5], /^…and 3 more$/);
  });

  test("the cap on file size is 256 KB", () => {
    assert.equal(IMPORT_MAX_BYTES, 256 * 1024);
  });

  test("configFromManifest drops shapes the editors can't map over", () => {
    const c = configFromManifest({
      type: "gltf",
      view: "dark",
      materials: { material: "*" },
      audio: {
        schemaVersion: 1,
        bindings: [
          7,
          null,
          { source: "kick", target: { kind: "camera", property: "dolly" } }
        ],
        idle: { clips: "Idle" },
        noteClips: { initial: "Idle", rules: { a: 1 } }
      }
    });
    assert.equal(c.view, undefined);
    assert.equal(c.materials, undefined);
    assert.equal(c.audio.bindings?.length, 1);
    assert.equal(c.audio.idle, undefined);
    assert.deepEqual(c.audio.noteClips?.rules, []);
    // A list of objects keeps its objects only.
    const c2 = configFromManifest({
      materials: [{ material: "*", toon: { steps: 3 } }, "x"],
      audio: { idle: { clips: [{ clip: "Idle" }, 3] } }
    });
    assert.equal(c2.materials?.length, 1);
    assert.deepEqual(c2.audio.idle?.clips, [{ clip: "Idle" }]);
  });
});
