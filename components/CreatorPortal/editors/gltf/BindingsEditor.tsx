// The BINDINGS panel (spec §9.2): which musical features move which parts of the scene.

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@lib/utils";
import { DEFAULT_LIMITS } from "../../../../lib/gltfVisualizer/core/limits";
import type { BindingConfig } from "../../../../lib/gltfVisualizer/core/manifest";
import {
  defaultBinding,
  errorsAt,
  moveItem,
  TargetChoices
} from "../../../../lib/gltfVisualizer/edit";
import { btnGhost, numCls } from "../../kit";
import { BindingCard } from "./BindingCard";
import { FieldErrors, newRowId, panelTitle, useRowIds } from "./fields";

export const BindingsEditor: React.FC<{
  bindings: BindingConfig[];
  onChange: (next: BindingConfig[]) => void;
  /** Every manifest error; cards pick theirs by path (audio.bindings[i]…). */
  errors: readonly string[];
  choices: TargetChoices;
  /** The preview's rig was built from exactly these bindings (meters are live). */
  rigCurrent: boolean;
}> = ({ bindings, onChange, errors, choices, rigCurrent }) => {
  // Stable React keys and open state that follow cards through reorders; a list swapped in from
  // outside (an import) gets new keys.
  const { ids: list, track } = useRowIds(bindings);
  // Cards with problems start open.
  const [openKeys, setOpenKeys] = useState<Set<string>>(
    () =>
      new Set(
        list.filter(
          (_, i) => errorsAt(errors, `audio.bindings[${i}]`).length > 0
        )
      )
  );
  const emit = (next: BindingConfig[], nextIds: string[]) => {
    track(next, nextIds);
    onChange(next);
  };

  const max = DEFAULT_LIMITS.maxBindings;
  const toggle = (k: string) =>
    setOpenKeys((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const add = () => {
    const k = newRowId();
    setOpenKeys((s) => new Set(s).add(k));
    emit(
      [
        ...bindings,
        defaultBinding(
          choices,
          bindings.map((b) => b.id)
        )
      ],
      [...list, k]
    );
  };
  const move = (i: number, d: number) => {
    emit(moveItem(bindings, i, d), moveItem(list, i, d));
  };
  const remove = (i: number) => {
    emit(
      bindings.filter((_, j) => j !== i),
      list.filter((_, j) => j !== i)
    );
  };

  return (
    <section aria-label="Bindings" className="space-y-2">
      <header className="flex items-center justify-between gap-2">
        <h3 className={panelTitle}>
          Bindings{" "}
          <span className={cn(numCls, "text-[11px] text-white/60")}>
            {bindings.length}/{max}
          </span>
        </h3>
        <button
          type="button"
          className={cn(btnGhost, "px-2 py-1 text-xs")}
          disabled={bindings.length >= max}
          onClick={add}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </header>
      <FieldErrors errors={errors} path="audio.bindings" exact />
      {bindings.length === 0 ? (
        <p className="font-body-bold text-xs text-white/60">
          A binding moves part of the scene with the music: the kick pumping a
          speaker, the bass lighting a material, the beat scrubbing a clip. Add
          one to start.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {bindings.map((b, i) => {
            const k = list[i];
            return (
              <BindingCard
                key={k}
                binding={b}
                index={i}
                count={bindings.length}
                open={openKeys.has(k)}
                onToggle={() => toggle(k)}
                onChange={(nb) =>
                  emit(
                    bindings.map((x, j) => (j === i ? nb : x)),
                    list
                  )
                }
                onMove={(d) => move(i, d)}
                onRemove={() => remove(i)}
                errors={errors}
                choices={choices}
                rigCurrent={rigCurrent}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
};
