// effect_preset manifest (spec §1.5): a preset for the app's own effects rack.

import { EFFECT_DEFS, EffectId, isEffectId } from "./effectIds";

export interface EffectEntry {
  id: string;
  enabled: boolean;
  params: Record<string, number>;
}

export interface EffectPresetManifest {
  format: 1;
  effects: EffectEntry[];
}

export function defaultEffectEntry(id: EffectId): EffectEntry {
  const params: Record<string, number> = {};
  for (const p of EFFECT_DEFS[id].params) params[p.id] = p.default;
  return { id, enabled: true, params };
}

export function buildEffectPreset(entries: EffectEntry[]): {
  manifest: EffectPresetManifest;
  errors: string[];
} {
  const errors: string[] = [];
  if (!entries.length) errors.push("add at least one effect");
  const seen = new Set<string>();
  const effects = entries.map((e, i) => {
    if (!isEffectId(e.id)) {
      errors.push(`effects[${i}].id "${e.id}" unknown`);
    } else {
      if (seen.has(e.id))
        errors.push(`effects[${i}].id "${e.id}" is listed twice`);
      seen.add(e.id);
      const defs = EFFECT_DEFS[e.id].params;
      for (const [name, value] of Object.entries(e.params || {})) {
        const def = defs.find((p) => p.id === name);
        if (!def) {
          errors.push(`effects[${i}].params.${name} unknown for "${e.id}"`);
        } else if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < def.min ||
          value > def.max
        ) {
          errors.push(
            `effects[${i}].params.${name} must be ${def.min}..${def.max}`
          );
        }
      }
    }
    return { id: e.id, enabled: e.enabled !== false, params: { ...e.params } };
  });
  return { manifest: { format: 1, effects }, errors };
}
