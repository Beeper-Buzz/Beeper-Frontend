// Typed copy of visualizer-gltf.limits.json. The JSON stays canonical (the server reads it);
// this object must equal it exactly, which __tests__/limits.test.ts asserts. It is a TS const
// rather than a JSON import because the app (Metro) and the web (Next/webpack) bundlers and
// both tsconfigs treat JSON imports differently.

export type Range = readonly [number, number];

/** Keys of `outputBounds` / `outputDefaults`: `<target kind>.<property or mode>`, or `morph`. */
export type OutputKey =
  | 'clip.speed'
  | 'clip.weight'
  | 'clip.scrub'
  | 'morph'
  | 'node.position'
  | 'node.rotation'
  | 'node.scale'
  | 'node.spin'
  | 'material.emissiveIntensity'
  | 'material.emissiveColor'
  | 'material.color'
  | 'material.hueShift'
  | 'material.opacity'
  | 'material.roughness'
  | 'material.metalness'
  | 'light.intensity'
  | 'camera.orbitSpeed'
  | 'camera.dolly';

export interface GltfLimits {
  readonly limitsVersion: number;
  readonly glbMaxBytes: number;
  readonly jsonChunkMaxBytes: number;
  readonly posterMaxBytes: number;
  readonly maxNodes: number;
  readonly maxMeshes: number;
  readonly maxDrawCalls: number;
  readonly maxTriangles: number;
  readonly maxVertices: number;
  readonly maxMaterials: number;
  readonly maxImages: number;
  readonly maxTextureSize: number;
  readonly maxTexturePixels: number;
  readonly maxAnimations: number;
  readonly maxAnimationSeconds: number;
  readonly maxKeyframes: number;
  readonly maxMorphTargets: number;
  readonly maxSkins: number;
  readonly maxJoints: number;
  readonly maxLights: number;
  readonly maxCameras: number;
  readonly maxBindings: number;
  readonly maxSourcesPerBinding: number;
  readonly maxNoteClipRules: number;
  readonly maxIdleClips: number;
  readonly maxMaterialOverrides: number;
  readonly allowedExtensions: readonly string[];
  /** Extension name → the reason shown to the creator. */
  readonly rejectedExtensions: { readonly [name: string]: string };
  readonly imageMimeTypes: readonly string[];
  readonly outputBounds: { readonly [K in OutputKey]: Range };
  readonly outputDefaults: { readonly [K in OutputKey]: Range };
  readonly velocityBounds: { readonly weight: Range; readonly timeScale: Range };
}

export const DEFAULT_LIMITS: GltfLimits = {
  limitsVersion: 1,
  glbMaxBytes: 20971520,
  jsonChunkMaxBytes: 2097152,
  posterMaxBytes: 2097152,
  maxNodes: 512,
  maxMeshes: 128,
  maxDrawCalls: 128,
  maxTriangles: 300000,
  maxVertices: 400000,
  maxMaterials: 32,
  maxImages: 16,
  maxTextureSize: 2048,
  maxTexturePixels: 16777216,
  maxAnimations: 32,
  maxAnimationSeconds: 120,
  maxKeyframes: 250000,
  maxMorphTargets: 32,
  maxSkins: 4,
  maxJoints: 128,
  maxLights: 4,
  maxCameras: 4,
  maxBindings: 64,
  maxSourcesPerBinding: 4,
  maxNoteClipRules: 64,
  maxIdleClips: 8,
  maxMaterialOverrides: 32,
  allowedExtensions: [
    'KHR_lights_punctual',
    'KHR_materials_emissive_strength',
    'KHR_materials_unlit',
    'KHR_texture_transform',
    'KHR_mesh_quantization',
    'KHR_materials_ior',
    'KHR_materials_specular',
  ],
  rejectedExtensions: {
    KHR_draco_mesh_compression: "Draco needs a WebAssembly decoder the app can't run; export without Draco",
    EXT_meshopt_compression: "meshopt needs a WebAssembly decoder the app can't run; export without meshopt",
    KHR_texture_basisu: "KTX2/Basis textures need a WebAssembly transcoder the app can't run; use PNG or JPEG",
    EXT_texture_webp: "WebP textures can't be decoded in the app; use PNG or JPEG",
    EXT_texture_avif: "AVIF textures can't be decoded in the app; use PNG or JPEG",
  },
  imageMimeTypes: ['image/png', 'image/jpeg'],
  outputBounds: {
    'clip.speed': [-4, 4],
    'clip.weight': [0, 1],
    'clip.scrub': [0, 1],
    morph: [0, 1],
    'node.position': [-100, 100],
    'node.rotation': [-360, 360],
    'node.scale': [0, 10],
    'node.spin': [-720, 720],
    'material.emissiveIntensity': [0, 50],
    'material.emissiveColor': [0, 1],
    'material.color': [0, 1],
    'material.hueShift': [-360, 360],
    'material.opacity': [0, 1],
    'material.roughness': [0, 1],
    'material.metalness': [0, 1],
    'light.intensity': [0, 20],
    'camera.orbitSpeed': [-180, 180],
    'camera.dolly': [0.2, 5],
  },
  outputDefaults: {
    'clip.speed': [0, 2],
    'clip.weight': [0, 1],
    'clip.scrub': [0, 1],
    morph: [0, 1],
    'node.position': [0, 0.5],
    'node.rotation': [0, 45],
    'node.scale': [1, 1.5],
    'node.spin': [0, 180],
    'material.emissiveIntensity': [0, 5],
    'material.emissiveColor': [0, 1],
    'material.color': [0, 1],
    'material.hueShift': [0, 180],
    'material.opacity': [0, 1],
    'material.roughness': [0, 1],
    'material.metalness': [0, 1],
    'light.intensity': [0.5, 2],
    'camera.orbitSpeed': [0, 30],
    'camera.dolly': [1, 0.8],
  },
  velocityBounds: {
    weight: [0, 1],
    timeScale: [0.1, 4],
  },
};
