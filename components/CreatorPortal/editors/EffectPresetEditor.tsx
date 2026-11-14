import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@lib/utils";
import {
  EFFECT_DEFS,
  EFFECT_IDS,
  EffectId,
  formatEffectValue,
  isEffectId
} from "../../../lib/manifests/effectIds";
import { defaultEffectEntry } from "../../../lib/manifests/effectPreset";
import type { ProductDraft } from "../../../lib/creator/productDraft";
import { btnGhost, numCls, selectCls } from "../kit";

/**
 * The preset as an effects chain: the app applies it to its rack (known ids
 * only, values clamped), in the rack's own order.
 */
export const EffectPresetEditor: React.FC<{
  draft: ProductDraft;
  setDraft: (fn: (d: ProductDraft) => ProductDraft) => void;
}> = ({ draft, setDraft }) => {
  const used = new Set(draft.effects.map((e) => e.id));
  const free = EFFECT_IDS.filter((id) => !used.has(id));
  const [toAdd, setToAdd] = useState<EffectId | "">("");

  const add = (id: EffectId) =>
    setDraft((d) => ({
      ...d,
      effects: [...d.effects, defaultEffectEntry(id)].sort(
        (a, b) =>
          EFFECT_IDS.indexOf(a.id as EffectId) -
          EFFECT_IDS.indexOf(b.id as EffectId)
      )
    }));

  const patch = (
    i: number,
    fn: (e: ProductDraft["effects"][number]) => ProductDraft["effects"][number]
  ) =>
    setDraft((d) => ({
      ...d,
      effects: d.effects.map((e, j) => (j === i ? fn(e) : e))
    }));

  return (
    <div className="space-y-3">
      {draft.effects.length === 0 && (
        <p className="font-body text-sm text-white/50">
          Add the effects this preset turns on. Effects you leave out keep
          whatever the player has set.
        </p>
      )}

      {draft.effects.map((e, i) => {
        if (!isEffectId(e.id)) {
          return (
            <div
              key={`${e.id}-${i}`}
              className="flex items-center justify-between rounded-md border border-neon-pink/40 px-3 py-2 font-body text-sm text-neon-pink"
            >
              Unknown effect &ldquo;{e.id}&rdquo;
              <button
                type="button"
                className="rounded p-1 hover:bg-white/5"
                aria-label={`Remove ${e.id}`}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    effects: d.effects.filter((_, j) => j !== i)
                  }))
                }
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        }
        const def = EFFECT_DEFS[e.id];
        return (
          <fieldset
            key={e.id}
            className={cn(
              "rounded-md border px-3 pb-3 pt-2",
              e.enabled
                ? "border-neon-cyan/30"
                : "border-glass-border opacity-70"
            )}
          >
            <legend className="sr-only">{def.label}</legend>
            <div className="flex items-center gap-3">
              <span className="font-michroma text-xs text-white">
                {def.label}
              </span>
              <span className="hidden min-w-0 flex-1 truncate font-body text-xs text-white/40 sm:block">
                {def.description}
              </span>
              <label className="ml-auto flex items-center gap-1.5 font-body text-xs text-white/70">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-neon-cyan"
                  checked={e.enabled}
                  onChange={(ev) =>
                    patch(i, (x) => ({ ...x, enabled: ev.target.checked }))
                  }
                />
                On
              </label>
              <button
                type="button"
                className="rounded p-1 text-white/40 hover:text-neon-pink"
                aria-label={`Remove ${def.label}`}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    effects: d.effects.filter((_, j) => j !== i)
                  }))
                }
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
              {def.params.map((p) => {
                const v = e.params[p.id] ?? p.default;
                const id = `fx-${e.id}-${p.id}`;
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2"
                  >
                    <label
                      htmlFor={id}
                      className="truncate font-body text-xs text-white/60"
                    >
                      {p.label}
                    </label>
                    {p.kind === "toggle" ? (
                      <input
                        id={id}
                        type="checkbox"
                        className="h-4 w-4 justify-self-start accent-neon-cyan"
                        checked={v >= 0.5}
                        onChange={(ev) =>
                          patch(i, (x) => ({
                            ...x,
                            params: {
                              ...x.params,
                              [p.id]: ev.target.checked ? 1 : 0
                            }
                          }))
                        }
                      />
                    ) : (
                      <input
                        id={id}
                        type="range"
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        value={v}
                        className="w-full accent-neon-cyan"
                        onChange={(ev) =>
                          patch(i, (x) => ({
                            ...x,
                            params: {
                              ...x.params,
                              [p.id]: Number(ev.target.value)
                            }
                          }))
                        }
                      />
                    )}
                    <span
                      className={`${numCls} text-right text-xs text-white/80`}
                    >
                      {formatEffectValue(p, v)}
                    </span>
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {free.length > 0 && (
        <div className="flex gap-2">
          <select
            aria-label="Effect to add"
            className={cn(selectCls, "w-auto py-1.5")}
            value={toAdd}
            onChange={(e) => setToAdd(e.target.value as EffectId | "")}
          >
            <option value="">Choose an effect</option>
            {free.map((id) => (
              <option key={id} value={id}>
                {EFFECT_DEFS[id].label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={btnGhost}
            disabled={!toAdd}
            onClick={() => {
              if (toAdd) add(toAdd);
              setToAdd("");
            }}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      )}
    </div>
  );
};
