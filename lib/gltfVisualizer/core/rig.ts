// The three.js runtime (spec §4.3–4.8, §8.3): resolves manifest names to the loaded glTF's
// objects through parser.associations, applies toon overrides and inverted-hull outlines, sets up
// camera, lights and the AnimationMixer, then drives everything per frame from the binding
// outputs and the note switcher. Uses only three APIs stable across r167 (web) and r182 (app).
//
// update() must not allocate: every temporary is preallocated, per-binding data lives in typed
// arrays, and the update path has no closures, array/object literals, spread or `new`.

import * as THREE from 'three';
import { CompiledBindings, compileBindings } from './bindings';
import { NormalizedGltfManifest, NormalizedMaterialOverride } from './manifest';
import { NoteClipsMachine, NoteClipsSink, PendingNote, TransportState, noteClipSlots } from './noteClips';

/** What GLTFLoader returns, structurally (so neither loader version's types are imported). */
export interface GltfLike {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parser: { json: any; associations: Map<any, any> };
}

export interface RigOptions {
  /** Viewport width / height for the first framing (default 1); call setAspect on resize. */
  aspect?: number;
}

export interface Rig {
  /** Add to the host scene: the glTF scene plus the rig's lights. */
  readonly root: THREE.Group;
  /** Render with this camera. */
  readonly camera: THREE.PerspectiveCamera;
  /** For renderer.toneMappingExposure (with ACESFilmicToneMapping). */
  readonly exposure: number;
  /** view.background, for scene.background or the clear colour. */
  readonly background: THREE.Color;
  /** Bounding sphere of the glTF scene at load (world space). */
  readonly center: THREE.Vector3;
  readonly radius: number;
  readonly mixer: THREE.AnimationMixer | null;
  readonly bindings: CompiledBindings;
  /** Binding outputs of the last update, by binding index. */
  readonly outputs: Float32Array;
  readonly noteClips: NoteClipsMachine | null;
  readonly outlineCount: number;
  /** Mesh draw calls at load, outlines included. */
  readonly drawCalls: number;
  /** Advances one frame; clears `note` after consuming it. No allocation. */
  update(dtSec: number, sources: Float32Array, transport: TransportState, note: PendingNote | null): void;
  setAspect(aspect: number): void;
  dispose(): void;
}

/** Builds the rig; throws "<manifest path>: <message>" when a name doesn't resolve (host falls back). */
export function createRig(gltf: GltfLike, normalized: NormalizedGltfManifest, opts: RigOptions = {}): Rig {
  return new GltfRig(gltf, normalized, opts);
}

// ---------------------------------------------------------------------------------------------

const DEG = Math.PI / 180;
/** Larger frame gaps (backgrounding, a stall) are clamped so fades and spins don't jump. */
const MAX_DT = 0.25;

const KIND_CLIP = 0;
const KIND_MORPH = 1;
const KIND_NODE = 2;
const KIND_MATERIAL = 3;
const KIND_LIGHT = 4;
const KIND_CAMERA = 5;

const CLIP_SPEED = 0;
const CLIP_WEIGHT = 1;
const CLIP_SCRUB = 2;
const CLIP_PLAY = 3;
const CLIP_TRIGGER = 4;

const NODE_POSITION = 0;
const NODE_ROTATION = 1;
const NODE_SCALE = 2;
const NODE_SPIN = 3;
const AXIS_CODE: { [axis: string]: number } = { x: 0, y: 1, z: 2, xyz: 3 };

const MAT_EMISSIVE_INTENSITY = 0;
const MAT_EMISSIVE_COLOR = 1;
const MAT_COLOR = 2;
const MAT_HUE = 3;
const MAT_OPACITY = 4;
const MAT_ROUGHNESS = 5;
const MAT_METALNESS = 6;
const MAT_CODE: { [property: string]: number } = {
  emissiveIntensity: MAT_EMISSIVE_INTENSITY,
  emissiveColor: MAT_EMISSIVE_COLOR,
  color: MAT_COLOR,
  hueShift: MAT_HUE,
  opacity: MAT_OPACITY,
  roughness: MAT_ROUGHNESS,
  metalness: MAT_METALNESS,
};

const CAMERA_ORBIT = 0;
const CAMERA_DOLLY = 1;

/** The material fields bindings touch (present depending on the material type). */
interface MatLike {
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  opacity: number;
  transparent: boolean;
  roughness?: number;
  metalness?: number;
  needsUpdate: boolean;
}

type Flags = { isMesh?: boolean; isSkinnedMesh?: boolean; isLight?: boolean; isCamera?: boolean; isPerspectiveCamera?: boolean; isTexture?: boolean };
const flags = (o: unknown): Flags => o as Flags;
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => flags(o).isMesh === true;
const isSkinned = (o: THREE.Object3D): o is THREE.SkinnedMesh => flags(o).isSkinnedMesh === true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isObj = (v: unknown): v is { [k: string]: any } => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Index of the one entry of a glTF array named `name`; throws on none or several. */
function uniqueIndex(list: unknown, name: string, what: string, path: string): number {
  const arr = Array.isArray(list) ? list : [];
  let found = -1;
  for (let i = 0; i < arr.length; i++) {
    if (isObj(arr[i]) && arr[i].name === name) {
      if (found >= 0) throw new Error(`${path}: "${name}" names more than one ${what}`);
      found = i;
    }
  }
  if (found < 0) throw new Error(`${path}: "${name}" is not a ${what} in the scene`);
  return found;
}

/** Vertex push along the (morphed, skinned) normal; objectNormal exists in basic materials only with envmap/skinning. */
const OUTLINE_NORMAL =
  '#if !defined( USE_ENVMAP ) && !defined( USE_SKINNING )\n\t#include <beginnormal_vertex>\n\t#include <morphnormal_vertex>\n#endif\n\t#include <begin_vertex>';
const OUTLINE_PUSH = '#include <skinning_vertex>\n\ttransformed += normalize( objectNormal ) * outlineWidth;';

class GltfRig implements Rig, NoteClipsSink {
  readonly root = new THREE.Group();
  readonly camera: THREE.PerspectiveCamera;
  readonly exposure: number;
  readonly background: THREE.Color;
  readonly center = new THREE.Vector3();
  readonly radius: number;
  readonly mixer: THREE.AnimationMixer | null = null;
  readonly bindings: CompiledBindings;
  readonly outputs: Float32Array;
  readonly noteClips: NoteClipsMachine | null = null;
  outlineCount = 0;
  drawCalls = 0;

  private readonly scene: THREE.Object3D;
  private readonly json: { [k: string]: unknown };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly assoc: Map<any, any>;
  private readonly normalized: NormalizedGltfManifest;
  private disposed = false;

  // Managed AnimationActions (idle, default, clip bindings, note slots): weight = fade × param.
  private readonly actions: THREE.AnimationAction[] = [];
  private fadeW = new Float32Array(0);
  private fadeTarget = new Float32Array(0);
  private fadeRate = new Float32Array(0);
  private paramW = new Float32Array(0);
  private duration = new Float32Array(0);
  private noteAction = new Int32Array(0);

  // Per binding: kind, a reference (action / node / first entry / light), entry count, property, axis.
  private readonly kind: Uint8Array;
  private readonly ref: Int32Array;
  private readonly refCount: Int32Array;
  private readonly prop: Uint8Array;
  private readonly axis: Uint8Array;
  private readonly spin: Float64Array;

  // Node offsets (undo-last: restore the pre-offset pose, run the mixer, re-apply).
  private readonly offsetNodes: THREE.Object3D[] = [];
  private readonly basePos: THREE.Vector3[] = [];
  private readonly baseQuat: THREE.Quaternion[] = [];
  private readonly baseScale: THREE.Vector3[] = [];
  private hasBase = new Uint8Array(0);
  private posOff = new Float64Array(0);
  private rotOff = new Float64Array(0);
  private sclOff = new Float64Array(0);

  // Morph entries: mesh + influence index.
  private readonly morphMeshes: THREE.Mesh[] = [];
  private morphIndex = new Int32Array(0);

  // Material entries with authored colours (and HSL for hueShift); colour pairs per binding.
  private readonly matList: MatLike[] = [];
  private readonly matColor: THREE.Color[] = [];
  private readonly matEmissive: THREE.Color[] = [];
  private matHsl = new Float32Array(0);
  private readonly colorA: (THREE.Color | null)[] = [];
  private readonly colorB: (THREE.Color | null)[] = [];

  // Lights with authored intensity.
  private readonly lights: THREE.Light[] = [];
  private lightBase = new Float32Array(0);

  // Camera.
  private readonly cameraNode: THREE.Object3D | null = null;
  private orbitDeg = 0;
  private fitted = 1;

  // Update temporaries.
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpS = new THREE.Vector3();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly orbitQ = new THREE.Quaternion();
  private readonly offQ = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(gltf: GltfLike, normalized: NormalizedGltfManifest, opts: RigOptions) {
    this.scene = gltf.scene;
    this.json = isObj(gltf.parser.json) ? gltf.parser.json : {};
    this.assoc = gltf.parser.associations;
    this.normalized = normalized;
    const view = normalized.view;
    this.exposure = view.exposure;
    this.background = new THREE.Color(view.background);
    this.root.name = 'gltf-visualizer';
    this.root.add(this.scene);

    // Index the loaded objects by glTF index.
    const nodeObjects: THREE.Object3D[][] = [];
    const meshObjects: THREE.Mesh[][] = [];
    this.scene.traverse((o) => {
      const a = this.assoc.get(o);
      if (!a) return;
      if (typeof a.nodes === 'number') (nodeObjects[a.nodes] = nodeObjects[a.nodes] || []).push(o);
      if (typeof a.meshes === 'number' && isMesh(o)) (meshObjects[a.meshes] = meshObjects[a.meshes] || []).push(o);
    });
    const nodeByName = (name: string, path: string): THREE.Object3D => {
      const index = uniqueIndex(this.json.nodes, name, 'node', path);
      const list = nodeObjects[index] || [];
      if (list.length === 1) return list[0];
      // r167 can share one association between instanced copies; fall back to the original name.
      let found: THREE.Object3D | null = null;
      let count = 0;
      this.scene.traverse((o) => {
        if (o.userData && o.userData.name === name) {
          found = o;
          count++;
        }
      });
      if (count !== 1 || !found) throw new Error(`${path}: node "${name}" could not be found in the loaded scene`);
      return found;
    };

    // Toon overrides, then the final materials per glTF material index.
    const materialObjects = this.applyToon(normalized.materials);

    // Bounds (before outlines), with skinned bounds from the bind pose.
    this.scene.updateMatrixWorld(true);
    this.scene.traverse((o) => {
      if (isSkinned(o)) o.skeleton.update();
    });
    const box = new THREE.Box3().setFromObject(this.scene);
    const sphere = new THREE.Sphere();
    if (box.isEmpty()) sphere.set(new THREE.Vector3(), 1);
    else box.getBoundingSphere(sphere);
    this.center.copy(sphere.center);
    this.radius = sphere.radius > 0 ? sphere.radius : 1;

    this.addOutlines(normalized.materials);

    // Camera.
    this.camera = new THREE.PerspectiveCamera(view.camera.fov, opts.aspect && opts.aspect > 0 ? opts.aspect : 1, 0.01, 1000);
    if (view.camera.node !== null) {
      const node = nodeByName(view.camera.node, 'view.camera.node');
      const cam = flags(node).isCamera ? node : node.children.find((c) => flags(c).isCamera) || null;
      if (!cam) throw new Error(`view.camera.node: node "${view.camera.node}" carries no camera`);
      this.cameraNode = cam;
    }
    this.frame();

    // Lighting.
    if (view.lighting === 'studio') this.addStudioLights();
    else this.root.add(new THREE.AmbientLight(0xffffff, 0.15));

    // Animation.
    const animJson = this.json.animations;
    const clipByName = (name: string, path: string): THREE.AnimationClip => {
      const index = uniqueIndex(animJson, name, 'animation', path);
      const clip = gltf.animations[index];
      if (!clip) throw new Error(`${path}: animation "${name}" did not load`);
      return clip;
    };
    const audio = normalized.audio;
    const bindingList = audio.bindings;
    const namesClip = audio.idle.length > 0 || audio.noteClips !== null || bindingList.some((b) => b.target.kind === 'clip');
    if (gltf.animations.length > 0) this.mixer = new THREE.AnimationMixer(this.scene);
    const fadeW: number[] = [];
    const fadeTarget: number[] = [];
    const fadeRate: number[] = [];
    const paramW: number[] = [];
    const addAction = (clip: THREE.AnimationClip, visible: boolean): number => {
      const mixer = this.mixer as THREE.AnimationMixer;
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      this.actions.push(action);
      fadeW.push(visible ? 1 : 0);
      fadeTarget.push(visible ? 1 : 0);
      fadeRate.push(Infinity);
      paramW.push(1);
      action.weight = visible ? 1 : 0;
      return this.actions.length - 1;
    };

    for (let i = 0; i < audio.idle.length; i++) {
      const a = addAction(clipByName(audio.idle[i].clip, `audio.idle.clips[${i}].clip`), true);
      this.actions[a].timeScale = audio.idle[i].timeScale;
    }
    if (!namesClip && this.mixer) addAction(gltf.animations[0], true);

    // Bindings.
    this.bindings = compileBindings(bindingList);
    const n = bindingList.length;
    this.outputs = new Float32Array(n);
    this.kind = new Uint8Array(n);
    this.ref = new Int32Array(n);
    this.refCount = new Int32Array(n);
    this.prop = new Uint8Array(n);
    this.axis = new Uint8Array(n);
    this.spin = new Float64Array(n);
    const clipActions: { [clip: string]: number } = {};
    const morphIndex: number[] = [];
    const hsl: number[] = [];
    const lightBase: number[] = [];
    const hslTmp = { h: 0, s: 0, l: 0 };
    for (let i = 0; i < n; i++) {
      const b = bindingList[i];
      const t = b.target;
      const path = `audio.bindings[${b.index}].target`;
      this.colorA.push(null);
      this.colorB.push(null);
      switch (t.kind) {
        case 'clip': {
          this.kind[i] = KIND_CLIP;
          let a = clipActions[t.clip];
          if (a === undefined) {
            a = addAction(clipByName(t.clip, `${path}.clip`), t.mode !== 'play' && t.mode !== 'trigger');
            clipActions[t.clip] = a;
          }
          const action = this.actions[a];
          this.ref[i] = a;
          const rate = t.fadeMs > 0 ? 1000 / t.fadeMs : Infinity;
          if (t.mode === 'speed') this.prop[i] = CLIP_SPEED;
          else if (t.mode === 'weight') this.prop[i] = CLIP_WEIGHT;
          else if (t.mode === 'scrub') {
            this.prop[i] = CLIP_SCRUB;
            action.paused = true;
          } else if (t.mode === 'play') {
            this.prop[i] = CLIP_PLAY;
            fadeRate[a] = rate;
          } else {
            this.prop[i] = CLIP_TRIGGER;
            fadeRate[a] = rate;
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          break;
        }
        case 'morph': {
          this.kind[i] = KIND_MORPH;
          const m = uniqueIndex(this.json.meshes, t.mesh, 'mesh', `${path}.mesh`);
          const meshes = meshObjects[m] || [];
          if (meshes.length === 0) throw new Error(`${path}.mesh: mesh "${t.mesh}" is not in the loaded scene`);
          let index = -1;
          if (typeof t.morph === 'number') {
            index = t.morph;
          } else {
            const meshJson = (this.json.meshes as unknown[])[m];
            const names = isObj(meshJson) && isObj(meshJson.extras) && Array.isArray(meshJson.extras.targetNames) ? meshJson.extras.targetNames : [];
            index = names.indexOf(t.morph);
            if (index < 0) throw new Error(`${path}.morph: "${t.morph}" is not a morph target of "${t.mesh}"`);
          }
          this.ref[i] = this.morphMeshes.length;
          this.refCount[i] = meshes.length;
          for (let j = 0; j < meshes.length; j++) {
            const infl = meshes[j].morphTargetInfluences;
            if (!infl || index >= infl.length) throw new Error(`${path}.morph: mesh "${t.mesh}" has no morph target ${t.morph}`);
            this.morphMeshes.push(meshes[j]);
            morphIndex.push(index);
          }
          break;
        }
        case 'node': {
          this.kind[i] = KIND_NODE;
          const node = nodeByName(t.node, `${path}.node`);
          let k = this.offsetNodes.indexOf(node);
          if (k < 0) {
            k = this.offsetNodes.length;
            this.offsetNodes.push(node);
            this.basePos.push(new THREE.Vector3());
            this.baseQuat.push(new THREE.Quaternion());
            this.baseScale.push(new THREE.Vector3());
          }
          this.ref[i] = k;
          this.prop[i] = t.property === 'position' ? NODE_POSITION : t.property === 'rotation' ? NODE_ROTATION : t.property === 'scale' ? NODE_SCALE : NODE_SPIN;
          this.axis[i] = AXIS_CODE[t.axis];
          break;
        }
        case 'material': {
          this.kind[i] = KIND_MATERIAL;
          const m = uniqueIndex(this.json.materials, t.material, 'material', `${path}.material`);
          const mats = materialObjects[m] || [];
          if (mats.length === 0) throw new Error(`${path}.material: material "${t.material}" is not used by any mesh`);
          const code = MAT_CODE[t.property];
          this.prop[i] = code;
          this.ref[i] = this.matList.length;
          this.refCount[i] = mats.length;
          if (t.colors) {
            this.colorA[i] = new THREE.Color(t.colors[0]);
            this.colorB[i] = new THREE.Color(t.colors[1]);
          }
          for (let j = 0; j < mats.length; j++) {
            const mat = mats[j] as unknown as MatLike;
            if (code === MAT_OPACITY && !mat.transparent) {
              mat.transparent = true;
              mat.needsUpdate = true;
            }
            this.matList.push(mat);
            this.matColor.push(mat.color ? mat.color.clone() : new THREE.Color());
            this.matEmissive.push(mat.emissive ? mat.emissive.clone() : new THREE.Color());
            if (mat.color) mat.color.getHSL(hslTmp, THREE.SRGBColorSpace);
            else hslTmp.h = hslTmp.s = hslTmp.l = 0;
            hsl.push(hslTmp.h, hslTmp.s, hslTmp.l);
            if (mat.emissive) mat.emissive.getHSL(hslTmp, THREE.SRGBColorSpace);
            else hslTmp.h = hslTmp.s = hslTmp.l = 0;
            hsl.push(hslTmp.h, hslTmp.s, hslTmp.l);
          }
          break;
        }
        case 'light': {
          this.kind[i] = KIND_LIGHT;
          const node = nodeByName(t.light, `${path}.light`);
          const light = (flags(node).isLight ? node : node.children.find((c) => flags(c).isLight)) as THREE.Light | undefined;
          if (!light) throw new Error(`${path}.light: node "${t.light}" carries no light`);
          this.ref[i] = this.lights.length;
          this.lights.push(light);
          lightBase.push(light.intensity);
          break;
        }
        case 'camera': {
          this.kind[i] = KIND_CAMERA;
          this.prop[i] = t.property === 'orbitSpeed' ? CAMERA_ORBIT : CAMERA_DOLLY;
          break;
        }
      }
    }

    // Note switcher.
    const nc = audio.noteClips;
    if (nc) {
      const slots = noteClipSlots(nc);
      const durations = new Float32Array(slots.length);
      this.noteAction = new Int32Array(slots.length);
      for (let s = 0; s < slots.length; s++) {
        const clip = clipByName(slots[s], s === 0 ? 'audio.noteClips.initial' : `audio.noteClips.rules[${nc.rules.findIndex((r) => r.clip === slots[s])}].clip`);
        durations[s] = clip.duration;
        this.noteAction[s] = addAction(clip, false);
      }
      this.noteClips = new NoteClipsMachine(nc, durations, this);
    }

    const count = this.actions.length;
    this.fadeW = Float32Array.from(fadeW);
    this.fadeTarget = Float32Array.from(fadeTarget);
    this.fadeRate = Float32Array.from(fadeRate);
    this.paramW = Float32Array.from(paramW);
    this.duration = new Float32Array(count);
    for (let a = 0; a < count; a++) this.duration[a] = this.actions[a].getClip().duration;
    const nodes = this.offsetNodes.length;
    this.hasBase = new Uint8Array(nodes);
    this.posOff = new Float64Array(nodes * 3);
    this.rotOff = new Float64Array(nodes * 3);
    this.sclOff = new Float64Array(nodes * 3);
    this.morphIndex = Int32Array.from(morphIndex);
    this.matHsl = Float32Array.from(hsl);
    this.lightBase = Float32Array.from(lightBase);

    if (this.noteClips) this.noteClips.start();
    this.root.traverse((o) => {
      if (isMesh(o)) this.drawCalls++;
    });
  }

  // -------------------------------------------------------------------------------------------
  // Build helpers

  /** Replaces overridden materials with MeshToonMaterial; returns final materials per glTF index. */
  private applyToon(overrides: NormalizedMaterialOverride[]): THREE.Material[][] {
    const named: { [name: string]: NormalizedMaterialOverride } = {};
    let star: NormalizedMaterialOverride | null = null;
    for (let i = 0; i < overrides.length; i++) {
      if (overrides[i].material === '*') star = overrides[i];
      else named[overrides[i].material] = overrides[i];
    }
    const jsonMaterials = Array.isArray(this.json.materials) ? (this.json.materials as unknown[]) : [];
    const overrideFor = (index: number): NormalizedMaterialOverride | null => {
      const def = jsonMaterials[index];
      const name = isObj(def) && typeof def.name === 'string' ? def.name : '';
      return name !== '' && Object.prototype.hasOwnProperty.call(named, name) ? named[name] : star;
    };
    const gradients = new Map<number, THREE.DataTexture>();
    const toonOf = new Map<THREE.Material, THREE.Material>();
    const result: THREE.Material[][] = [];
    this.scene.traverse((o) => {
      if (!isMesh(o) || Array.isArray(o.material)) return;
      const src = o.material as THREE.Material;
      const a = this.assoc.get(src);
      const index = a && typeof a.materials === 'number' ? a.materials : -1;
      if (index < 0) return;
      const ov = overrideFor(index);
      if (ov) {
        let toon = toonOf.get(src);
        if (!toon) {
          toon = makeToon(src, ov.steps, gradients);
          toonOf.set(src, toon);
        }
        o.material = toon;
        o.userData.toonOverride = ov;
      }
      const list = (result[index] = result[index] || []);
      if (list.indexOf(o.material as THREE.Material) < 0) list.push(o.material as THREE.Material);
    });
    toonOf.forEach((_toon, src) => src.dispose());
    return result;
  }

  /** Inverted hulls for meshes whose (toon) override has an outline. */
  private addOutlines(overrides: NormalizedMaterialOverride[]): void {
    if (!overrides.some((o) => o.outline)) return;
    const targets: THREE.Mesh[] = [];
    this.scene.traverse((o) => {
      if (isMesh(o) && o.userData.toonOverride && (o.userData.toonOverride as NormalizedMaterialOverride).outline) targets.push(o);
    });
    for (let i = 0; i < targets.length; i++) {
      const mesh = targets[i];
      const outline = (mesh.userData.toonOverride as NormalizedMaterialOverride).outline as { width: number; color: string };
      // The push happens in mesh space, so divide out the mesh's world scale to keep width × radius in world units.
      const scale = mesh.matrixWorld.getMaxScaleOnAxis() || 1;
      mesh.add(makeOutline(mesh, (outline.width * this.radius) / scale, outline.color));
      this.outlineCount++;
    }
  }

  private addStudioLights(): void {
    const r = this.radius;
    const c = this.center;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2a35, 1.1);
    hemi.name = 'studio-hemisphere';
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.name = 'studio-key';
    key.position.set(c.x + r * 1.5, c.y + r * 2.5, c.z + r * 2);
    key.target.position.copy(c);
    const rim = new THREE.DirectionalLight(0xcfe0ff, 1.6);
    rim.name = 'studio-rim';
    rim.position.set(c.x - r * 2, c.y + r * 1.5, c.z - r * 2.5);
    rim.target.position.copy(c);
    this.root.add(hemi, key, key.target, rim, rim.target);
  }

  /** Fitted distance (sphere fits the narrower field of view) and clip planes. */
  private frame(): void {
    const cam = this.camera;
    const vfov = cam.fov * DEG;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
    this.fitted = this.radius / Math.sin(Math.min(vfov, hfov) / 2);
    if (this.cameraNode === null) {
      cam.near = Math.max(this.radius * 0.01, 1e-4);
      cam.far = this.fitted * 10 * 5 + this.radius * 4; // max distance × max dolly, plus depth
    }
    cam.updateProjectionMatrix();
    this.placeCamera(1);
  }

  // -------------------------------------------------------------------------------------------
  // NoteClipsSink

  crossfade(slot: number, fadeSec: number, restart: boolean, once: boolean): void {
    const rate = fadeSec > 0 ? 1 / fadeSec : Infinity;
    const target = this.noteAction[slot];
    for (let s = 0; s < this.noteAction.length; s++) {
      const a = this.noteAction[s];
      this.fadeTarget[a] = a === target ? 1 : 0;
      this.fadeRate[a] = rate;
    }
    const action = this.actions[target];
    // A finished once clip is left paused (clampWhenFinished); resuming it as a loop must unpause.
    action.paused = false;
    action.enabled = true;
    if (once) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }
    if (restart) {
      action.reset();
      action.play();
    }
  }

  setParams(slot: number, timeScale: number, weight: number): void {
    const a = this.noteAction[slot];
    this.actions[a].timeScale = timeScale;
    this.paramW[a] = weight;
  }

  // -------------------------------------------------------------------------------------------
  // Per frame

  update(dtSec: number, sources: Float32Array, transport: TransportState, note: PendingNote | null): void {
    if (this.disposed) return;
    const dt = dtSec > 0 ? (dtSec < MAX_DT ? dtSec : MAX_DT) : 0;
    const out = this.outputs;
    const n = this.bindings.count;
    this.bindings.evaluate(sources, dt, out);

    // Undo last frame's node offsets (restore the pose the mixer/author left).
    const nodes = this.offsetNodes.length;
    for (let k = 0; k < nodes; k++) {
      if (this.hasBase[k] === 0) continue;
      const o = this.offsetNodes[k];
      o.position.copy(this.basePos[k]);
      o.quaternion.copy(this.baseQuat[k]);
      o.scale.copy(this.baseScale[k]);
    }

    if (this.noteClips) this.noteClips.update(dt, transport, note);
    if (note) note.clear();

    // Clip bindings.
    const active = this.bindings.active;
    const fired = this.bindings.fired;
    for (let i = 0; i < n; i++) {
      if (this.kind[i] !== KIND_CLIP) continue;
      const a = this.ref[i];
      const action = this.actions[a];
      switch (this.prop[i]) {
        case CLIP_SPEED:
          action.timeScale = out[i];
          break;
        case CLIP_WEIGHT:
          this.paramW[a] = out[i];
          break;
        case CLIP_SCRUB: {
          const v = out[i];
          action.time = (v > 0 ? (v < 1 ? v : 1) : 0) * this.duration[a];
          break;
        }
        case CLIP_PLAY: {
          const on = active[i] === 1 ? 1 : 0;
          if (on === 1 && this.fadeTarget[a] === 0 && this.fadeW[a] === 0) action.reset();
          this.fadeTarget[a] = on;
          break;
        }
        case CLIP_TRIGGER:
          if (fired[i] === 1) {
            action.reset();
            action.play();
            this.fadeW[a] = this.fadeRate[a] === Infinity ? 1 : 0;
            this.fadeTarget[a] = 1;
          }
          break;
      }
    }

    // Fades → action weights.
    const actions = this.actions;
    for (let a = 0; a < actions.length; a++) {
      let w = this.fadeW[a];
      const target = this.fadeTarget[a];
      if (w !== target) {
        const step = this.fadeRate[a] * dt;
        const gap = target > w ? target - w : w - target;
        if (!(step < gap)) w = target; // also handles an infinite rate at dt 0
        else w += target > w ? step : -step;
        this.fadeW[a] = w;
      }
      actions[a].weight = w * this.paramW[a];
    }

    if (this.mixer) this.mixer.update(dt);

    // Node offsets: capture the base pose, then add this frame's offsets.
    if (nodes > 0) {
      const pos = this.posOff;
      const rot = this.rotOff;
      const scl = this.sclOff;
      pos.fill(0);
      rot.fill(0);
      scl.fill(1);
      for (let i = 0; i < n; i++) {
        if (this.kind[i] !== KIND_NODE) continue;
        const k3 = this.ref[i] * 3;
        const ax = this.axis[i];
        const p = this.prop[i];
        let v = out[i];
        if (p === NODE_SPIN) {
          let angle = this.spin[i] + v * dt;
          angle -= Math.floor(angle / 360) * 360;
          this.spin[i] = angle;
          v = angle;
        }
        for (let c = 0; c < 3; c++) {
          if (ax !== 3 && ax !== c) continue;
          if (p === NODE_POSITION) pos[k3 + c] += v;
          else if (p === NODE_SCALE) scl[k3 + c] *= v;
          else rot[k3 + c] += v;
        }
      }
      for (let k = 0; k < nodes; k++) {
        const o = this.offsetNodes[k];
        this.basePos[k].copy(o.position);
        this.baseQuat[k].copy(o.quaternion);
        this.baseScale[k].copy(o.scale);
        this.hasBase[k] = 1;
        const k3 = k * 3;
        o.position.x += pos[k3];
        o.position.y += pos[k3 + 1];
        o.position.z += pos[k3 + 2];
        if (rot[k3] !== 0 || rot[k3 + 1] !== 0 || rot[k3 + 2] !== 0) {
          this.euler.set(rot[k3] * DEG, rot[k3 + 1] * DEG, rot[k3 + 2] * DEG, 'XYZ');
          this.offQ.setFromEuler(this.euler);
          o.quaternion.multiply(this.offQ);
        }
        o.scale.x *= scl[k3];
        o.scale.y *= scl[k3 + 1];
        o.scale.z *= scl[k3 + 2];
      }
    }

    // Morphs, materials, lights.
    let dolly = 1;
    let orbit = this.normalized.view.camera.orbitSpeed;
    for (let i = 0; i < n; i++) {
      const v = out[i];
      switch (this.kind[i]) {
        case KIND_MORPH: {
          const end = this.ref[i] + this.refCount[i];
          for (let j = this.ref[i]; j < end; j++) {
            const infl = this.morphMeshes[j].morphTargetInfluences;
            if (infl) infl[this.morphIndex[j]] = v;
          }
          break;
        }
        case KIND_MATERIAL:
          this.applyMaterial(i, v);
          break;
        case KIND_LIGHT:
          this.lights[this.ref[i]].intensity = this.lightBase[this.ref[i]] * v;
          break;
        case KIND_CAMERA:
          if (this.prop[i] === CAMERA_ORBIT) orbit += v;
          else dolly = v;
          break;
      }
    }

    this.orbitDeg += orbit * dt;
    this.orbitDeg -= Math.floor(this.orbitDeg / 360) * 360;
    this.placeCamera(dolly);
  }

  private applyMaterial(i: number, v: number): void {
    const end = this.ref[i] + this.refCount[i];
    const code = this.prop[i];
    const ca = this.colorA[i];
    const cb = this.colorB[i];
    for (let j = this.ref[i]; j < end; j++) {
      const m = this.matList[j];
      switch (code) {
        case MAT_EMISSIVE_INTENSITY:
          if (m.emissiveIntensity !== undefined) m.emissiveIntensity = v;
          break;
        case MAT_EMISSIVE_COLOR:
          if (m.emissive && ca && cb) m.emissive.copy(ca).lerp(cb, v);
          break;
        case MAT_COLOR:
          if (m.color && ca && cb) m.color.copy(ca).lerp(cb, v);
          break;
        case MAT_HUE: {
          const h = this.matHsl;
          const shift = v / 360;
          if (m.color) m.color.setHSL(h[j * 6] + shift - Math.floor(h[j * 6] + shift), h[j * 6 + 1], h[j * 6 + 2], THREE.SRGBColorSpace);
          if (m.emissive) m.emissive.setHSL(h[j * 6 + 3] + shift - Math.floor(h[j * 6 + 3] + shift), h[j * 6 + 4], h[j * 6 + 5], THREE.SRGBColorSpace);
          break;
        }
        case MAT_OPACITY:
          m.opacity = v;
          break;
        case MAT_ROUGHNESS:
          if (m.roughness !== undefined) m.roughness = v; // toon materials have none: skipped
          break;
        case MAT_METALNESS:
          if (m.metalness !== undefined) m.metalness = v;
          break;
      }
    }
  }

  private placeCamera(dolly: number): void {
    const cam = this.camera;
    const c = this.center;
    const orbit = this.orbitDeg * DEG;
    if (this.cameraNode !== null) {
      const node = this.cameraNode;
      node.updateWorldMatrix(true, false);
      node.matrixWorld.decompose(this.tmpV, this.tmpQ, this.tmpS);
      this.orbitQ.setFromAxisAngle(this.up, orbit);
      this.tmpV.sub(c).multiplyScalar(dolly).applyQuaternion(this.orbitQ).add(c);
      cam.position.copy(this.tmpV);
      cam.quaternion.multiplyQuaternions(this.orbitQ, this.tmpQ);
      const src = node as THREE.PerspectiveCamera;
      if (flags(node).isPerspectiveCamera && (src.fov !== cam.fov || src.near !== cam.near || src.far !== cam.far)) {
        cam.fov = src.fov;
        cam.near = src.near;
        cam.far = src.far;
        cam.updateProjectionMatrix();
      }
      return;
    }
    const view = this.normalized.view.camera;
    const dist = this.fitted * view.distance * dolly;
    const el = view.elevation * DEG;
    const az = view.azimuth * DEG + orbit;
    cam.position.set(c.x + dist * Math.cos(el) * Math.sin(az), c.y + dist * Math.sin(el), c.z + dist * Math.cos(el) * Math.cos(az));
    cam.lookAt(c);
  }

  setAspect(aspect: number): void {
    if (!(aspect > 0)) return;
    this.camera.aspect = aspect;
    this.frame();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.scene);
    }
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    const outlines: THREE.Object3D[] = [];
    this.root.traverse((o) => {
      if (isMesh(o)) {
        geometries.add(o.geometry);
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (let i = 0; i < mats.length; i++) materials.add(mats[i]);
        if (o.userData.outline) outlines.push(o);
      }
      const light = o as unknown as { isLight?: boolean; dispose?: () => void };
      if (light.isLight && typeof light.dispose === 'function') light.dispose();
    });
    materials.forEach((m) => {
      const fields = m as unknown as { [k: string]: unknown };
      const keys = Object.keys(fields);
      for (let i = 0; i < keys.length; i++) {
        const v = fields[keys[i]];
        if (v && flags(v).isTexture) textures.add(v as THREE.Texture);
      }
      m.dispose();
    });
    textures.forEach((t) => t.dispose());
    geometries.forEach((g) => g.dispose());
    for (let i = 0; i < outlines.length; i++) outlines[i].removeFromParent();
    this.root.removeFromParent();
    this.actions.length = 0;
  }
}

// ---------------------------------------------------------------------------------------------

function gradientTexture(steps: number, cache: Map<number, THREE.DataTexture>): THREE.DataTexture {
  const hit = cache.get(steps);
  if (hit) return hit;
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) data[i] = Math.round((255 * i) / (steps - 1));
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cache.set(steps, tex);
  return tex;
}

/** MeshToonMaterial carrying the source's colour, maps, emissive, alpha and side. */
function makeToon(src: THREE.Material, steps: number, gradients: Map<number, THREE.DataTexture>): THREE.MeshToonMaterial {
  const s = src as unknown as {
    color?: THREE.Color;
    map?: THREE.Texture | null;
    emissive?: THREE.Color;
    emissiveMap?: THREE.Texture | null;
    emissiveIntensity?: number;
    normalMap?: THREE.Texture | null;
    normalScale?: THREE.Vector2;
    alphaMap?: THREE.Texture | null;
  };
  const toon = new THREE.MeshToonMaterial();
  toon.name = src.name;
  if (s.color) toon.color.copy(s.color);
  toon.map = s.map || null;
  if (s.emissive) toon.emissive.copy(s.emissive);
  toon.emissiveMap = s.emissiveMap || null;
  if (typeof s.emissiveIntensity === 'number') toon.emissiveIntensity = s.emissiveIntensity;
  toon.normalMap = s.normalMap || null;
  if (s.normalScale) toon.normalScale.copy(s.normalScale);
  toon.alphaMap = s.alphaMap || null;
  toon.alphaTest = src.alphaTest;
  toon.transparent = src.transparent;
  toon.opacity = src.opacity;
  toon.side = src.side;
  toon.depthWrite = src.depthWrite;
  toon.vertexColors = src.vertexColors;
  toon.gradientMap = gradientTexture(steps, gradients);
  return toon;
}

/** An inverted hull sharing the mesh's geometry, skeleton and morph influences. */
function makeOutline(mesh: THREE.Mesh, width: number, color: string): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.BackSide });
  mat.name = 'outline';
  const uniform = { value: width };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.outlineWidth = uniform;
    shader.vertexShader =
      'uniform float outlineWidth;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', OUTLINE_NORMAL).replace('#include <skinning_vertex>', OUTLINE_PUSH);
  };
  mat.customProgramCacheKey = () => 'gltf-visualizer-outline';
  mat.userData.outlineWidth = uniform;
  if (!mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals();
  let outline: THREE.Mesh;
  if (isSkinned(mesh)) {
    const skinned = new THREE.SkinnedMesh(mesh.geometry, mat);
    skinned.bindMode = mesh.bindMode;
    skinned.bind(mesh.skeleton, mesh.bindMatrix);
    outline = skinned;
  } else {
    outline = new THREE.Mesh(mesh.geometry, mat);
  }
  // Same array objects, so morph bindings and morph animation drive both.
  outline.morphTargetInfluences = mesh.morphTargetInfluences;
  outline.morphTargetDictionary = mesh.morphTargetDictionary;
  outline.name = `${mesh.name}_outline`;
  outline.userData.outline = true;
  outline.frustumCulled = mesh.frustumCulled;
  outline.castShadow = false;
  outline.receiveShadow = false;
  return outline;
}
