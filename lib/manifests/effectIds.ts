// The Beeper app's nine effects, their parameters and ranges.
//
// Copied from BeeperNative origin/main @ f483f2b:
//   src/atoms/studio.ts  (EffectId, EFFECT_ORDER)
//   src/data/effects.ts  (EFFECTS: ids, labels, params, min/max/default/step)
// The backend's effect_preset validator (beeper-admin config/beeper_effects.yml)
// is copied from the same source. When the app adds or changes an effect,
// update all three together.

export type EffectId =
  | "drive"
  | "crush"
  | "eq"
  | "chorus"
  | "phaser"
  | "echo"
  | "reverb"
  | "pump"
  | "compressor";

export const EFFECT_IDS: EffectId[] = [
  "drive",
  "crush",
  "eq",
  "chorus",
  "phaser",
  "echo",
  "reverb",
  "pump",
  "compressor"
];

export interface EffectParamDef {
  id: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
  kind: "continuous" | "toggle" | "choice";
  unit?: "percent" | "hz" | "ms" | "s" | "db" | "ratio" | "bits" | "factor";
  choices?: readonly string[];
}

export interface EffectDef {
  id: EffectId;
  label: string;
  description: string;
  params: EffectParamDef[];
}

const ECHO_DIVISIONS = [
  "1/4",
  "1/8",
  "1/8 dotted",
  "1/16",
  "1/4 dotted",
  "1/2"
] as const;
const PUMP_DIVISIONS = ["1/4", "1/8", "1/2", "1 bar"] as const;

const pct = (
  id: string,
  label: string,
  def: number,
  max = 1
): EffectParamDef => ({
  id,
  label,
  min: 0,
  max,
  default: def,
  step: 0.01,
  kind: "continuous",
  unit: "percent"
});
const toggle = (id: string, label: string, def: 0 | 1): EffectParamDef => ({
  id,
  label,
  min: 0,
  max: 1,
  default: def,
  step: 1,
  kind: "toggle"
});
const choice = (
  id: string,
  label: string,
  def: number,
  choices: readonly string[]
): EffectParamDef => ({
  id,
  label,
  min: 0,
  max: choices.length - 1,
  default: def,
  step: 1,
  kind: "choice",
  choices
});
const gainDb = (id: string, label: string): EffectParamDef => ({
  id,
  label,
  min: -12,
  max: 12,
  default: 0,
  step: 0.5,
  kind: "continuous",
  unit: "db"
});
const rateHz = (def: number): EffectParamDef => ({
  id: "rate",
  label: "Rate",
  min: 0.05,
  max: 5,
  default: def,
  step: 0.01,
  kind: "continuous",
  unit: "hz"
});

export const EFFECT_DEFS: Record<EffectId, EffectDef> = {
  drive: {
    id: "drive",
    label: "Drive",
    description: "Warm saturation that thickens and roughens the tone.",
    params: [
      pct("amount", "Amount", 0.4),
      pct("tone", "Tone", 0.6),
      pct("mix", "Mix", 1)
    ]
  },
  crush: {
    id: "crush",
    label: "Crush",
    description: "Lo-fi bit and sample-rate reduction with a little hiss.",
    params: [
      {
        id: "bits",
        label: "Bits",
        min: 2,
        max: 16,
        default: 8,
        step: 1,
        kind: "continuous",
        unit: "bits"
      },
      {
        id: "downsample",
        label: "Downsample",
        min: 1,
        max: 32,
        default: 4,
        step: 1,
        kind: "continuous",
        unit: "factor"
      },
      pct("noise", "Noise", 0.1),
      pct("mix", "Mix", 1)
    ]
  },
  eq: {
    id: "eq",
    label: "EQ",
    description:
      "Three-band tone shaping: low shelf, sweepable mid, high shelf.",
    params: [
      gainDb("low", "Low"),
      gainDb("mid", "Mid"),
      {
        id: "midFreq",
        label: "Mid freq",
        min: 200,
        max: 5000,
        default: 1000,
        step: 10,
        kind: "continuous",
        unit: "hz"
      },
      gainDb("high", "High")
    ]
  },
  chorus: {
    id: "chorus",
    label: "Chorus",
    description: "Detuned copies that widen and shimmer.",
    params: [rateHz(0.8), pct("depth", "Depth", 0.4), pct("mix", "Mix", 0.5)]
  },
  phaser: {
    id: "phaser",
    label: "Phaser",
    description: "A sweeping notch filter that swirls through the sound.",
    params: [
      rateHz(0.4),
      pct("depth", "Depth", 0.6),
      pct("feedback", "Feedback", 0.5, 0.9),
      pct("mix", "Mix", 0.5)
    ]
  },
  echo: {
    id: "echo",
    label: "Echo",
    description: "Repeats that can lock to the tempo or bounce left and right.",
    params: [
      {
        id: "time",
        label: "Time",
        min: 0.02,
        max: 2,
        default: 0.375,
        step: 0.005,
        kind: "continuous",
        unit: "s"
      },
      toggle("sync", "Sync", 1),
      choice("division", "Division", 2, ECHO_DIVISIONS),
      pct("feedback", "Feedback", 0.4, 0.95),
      pct("tone", "Tone", 0.5),
      toggle("pingPong", "Ping-pong", 0),
      pct("mix", "Mix", 0.35)
    ]
  },
  reverb: {
    id: "reverb",
    label: "Reverb",
    description: "A room around the sound, from a booth to a hall.",
    params: [
      pct("size", "Size", 0.6),
      pct("damping", "Damping", 0.5),
      pct("width", "Width", 1),
      pct("mix", "Mix", 0.3)
    ]
  },
  pump: {
    id: "pump",
    label: "Pump",
    description: "Side-chain-style ducking locked to the beat.",
    params: [
      pct("depth", "Depth", 0.6),
      pct("shape", "Shape", 0.5),
      choice("division", "Division", 0, PUMP_DIVISIONS)
    ]
  },
  compressor: {
    id: "compressor",
    label: "Compressor",
    description: "Evens out the level so quiet notes come forward.",
    params: [
      {
        id: "threshold",
        label: "Threshold",
        min: -60,
        max: 0,
        default: -18,
        step: 0.5,
        kind: "continuous",
        unit: "db"
      },
      {
        id: "ratio",
        label: "Ratio",
        min: 1,
        max: 20,
        default: 4,
        step: 0.1,
        kind: "continuous",
        unit: "ratio"
      },
      {
        id: "attack",
        label: "Attack",
        min: 0.1,
        max: 100,
        default: 10,
        step: 0.1,
        kind: "continuous",
        unit: "ms"
      },
      {
        id: "release",
        label: "Release",
        min: 10,
        max: 1000,
        default: 120,
        step: 1,
        kind: "continuous",
        unit: "ms"
      },
      {
        id: "makeup",
        label: "Makeup",
        min: 0,
        max: 24,
        default: 4,
        step: 0.5,
        kind: "continuous",
        unit: "db"
      }
    ]
  }
};

export const isEffectId = (v: unknown): v is EffectId =>
  typeof v === "string" && (EFFECT_IDS as string[]).includes(v);

/** Value in its units, as the app shows it: "62%", "1.2 kHz", "−18 dB". */
export function formatEffectValue(p: EffectParamDef, v: number): string {
  if (p.kind === "toggle") return v >= 0.5 ? "On" : "Off";
  if (p.kind === "choice") return p.choices?.[Math.round(v)] ?? String(v);
  switch (p.unit) {
    case "percent":
      return `${Math.round(v * 100)}%`;
    case "hz":
      return v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${+v.toFixed(2)} Hz`;
    case "ms":
      return `${+v.toFixed(1)} ms`;
    case "s":
      return v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`;
    case "db":
      return `${v > 0 ? "+" : ""}${+v.toFixed(1)} dB`;
    case "ratio":
      return `${v.toFixed(1)}:1`;
    case "bits":
      return `${Math.round(v)} bit`;
    case "factor":
      return `÷${Math.round(v)}`;
    default:
      return String(v);
  }
}
