// One binding: a summary row (live output, errors, reorder, remove) that opens into its
// sources, target, mapping and smoothing (spec §4.2–4.3, §9.2).

import React from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { cn } from "@lib/utils";
import {
  SOURCE_INDEX,
  SOURCES
} from "../../../../lib/gltfVisualizer/core/bindings";
import { DEFAULT_LIMITS } from "../../../../lib/gltfVisualizer/core/limits";
import {
  BindingConfig,
  COMBINE_MODES,
  CombineMode,
  CURVES,
  CurveName,
  SourceName
} from "../../../../lib/gltfVisualizer/core/manifest";
import {
  bindingSources,
  describeBinding,
  errorsAt,
  SourceRow,
  TargetChoices,
  withSources
} from "../../../../lib/gltfVisualizer/edit";
import { CurveGraph } from "./CurveGraph";
import {
  BindingTarget,
  isTriggerLike,
  outputHint,
  outputPlaceholder
} from "./BindingTarget";
import {
  FieldErrors,
  IconButton,
  miniLabel,
  NumField,
  Segmented,
  Select,
  smallInput
} from "./fields";
import { LiveMeter, LiveNumber, useLive } from "./live";

const SOURCE_OPTIONS = SOURCES.map((s) => ({ value: s.name, label: s.label }));
const RAW_SOURCES: SourceName[] = ["bpm", "note", "noteHz"];
const sourceInfo = (name: SourceName) =>
  SOURCES.find((s) => s.name === name) || SOURCES[0];

/** A copy of `b` without `key`. */
function omit<K extends keyof BindingConfig>(
  b: BindingConfig,
  key: K
): BindingConfig {
  const out = { ...b };
  delete out[key];
  return out;
}

/** Two NumFields committed together; a missing end takes its placeholder. */
const RangeFields: React.FC<{
  label: string;
  value: [number, number] | undefined;
  placeholder: [number, number];
  onCommit: (v: [number, number] | undefined) => void;
  errors: readonly string[];
  path: string;
  hint?: string;
}> = ({ label, value, placeholder, onCommit, errors, path, hint }) => {
  const set = (i: 0 | 1, v: number | undefined) => {
    const other = value ? value[1 - i] : undefined;
    if (v === undefined && other === undefined) return onCommit(undefined);
    const next: [number, number] = value
      ? [value[0], value[1]]
      : [placeholder[0], placeholder[1]];
    next[i] = v === undefined ? placeholder[i] : v;
    onCommit(next);
  };
  return (
    <div className="col-span-2 min-w-0">
      <span className={miniLabel}>{label}</span>
      <div className="grid grid-cols-2 gap-1.5">
        {([0, 1] as const).map((i) => (
          <NumField
            key={i}
            label={`${label} ${i === 0 ? "from" : "to"}`}
            value={value ? value[i] : undefined}
            placeholder={String(placeholder[i])}
            onCommit={(v) => set(i, v)}
            className="[&>span:first-child]:sr-only"
          />
        ))}
      </div>
      {hint && (
        <p className="mt-0.5 font-body-bold text-[11px] text-white/60">
          {hint}
        </p>
      )}
      <FieldErrors errors={errors} path={path} />
    </div>
  );
};

export const BindingCard: React.FC<{
  binding: BindingConfig;
  index: number;
  count: number;
  open: boolean;
  onToggle: () => void;
  onChange: (b: BindingConfig) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  errors: readonly string[];
  choices: TargetChoices;
  rigCurrent: boolean;
}> = ({
  binding: b,
  index: i,
  count,
  open,
  onToggle,
  onChange,
  onMove,
  onRemove,
  errors,
  choices,
  rigCurrent
}) => {
  const { groove, rigRef } = useLive();
  const p = `audio.bindings[${i}]`;
  const mine = errorsAt(errors, p);
  const rows = bindingSources(b);
  const target = b.target;
  const trig = isTriggerLike(target);
  const outPh = outputPlaceholder(target);
  const readT = rigCurrent ? () => rigRef.current?.bindings.t[i] ?? 0 : null;
  const readOut = () => rigRef.current?.outputs[i] ?? NaN;
  const inPh: [number, number] =
    rows.length === 1
      ? [
          sourceInfo(rows[0].source).suggestedInputRange[0],
          sourceInfo(rows[0].source).suggestedInputRange[1]
        ]
      : [0, 1];

  const setRows = (next: SourceRow[], combine?: CombineMode) => {
    let nb = withSources(b, next, combine);
    if (
      next.length === 1 &&
      RAW_SOURCES.includes(next[0].source) &&
      !nb.inputRange
    ) {
      const r = sourceInfo(next[0].source).suggestedInputRange;
      nb = { ...nb, inputRange: [r[0], r[1]] };
    }
    onChange(nb);
  };
  const setKey = <K extends keyof BindingConfig>(
    key: K,
    v: BindingConfig[K] | undefined
  ) => onChange(v === undefined ? omit(b, key) : { ...b, [key]: v });
  const setSmoothing = (k: "attackMs" | "releaseMs", v: number | undefined) => {
    const s = { ...(b.smoothing || {}) };
    if (v === undefined) delete s[k];
    else s[k] = v;
    setKey(
      "smoothing",
      s.attackMs === undefined && s.releaseMs === undefined ? undefined : s
    );
  };

  return (
    <li
      className={cn(
        "rounded-md border bg-white/[0.02]",
        mine.length ? "border-neon-pink/40" : "border-glass-border"
      )}
    >
      <div className="flex items-center gap-1 px-1.5 py-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-white/[0.04]"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/60" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/60" />
          )}
          <span className="min-w-0 flex-1 truncate font-mono-semibold text-[12px] text-white/85">
            {describeBinding(b)}
          </span>
          {mine.length > 0 && (
            <>
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-neon-pink"
                aria-hidden
              />
              <span className="sr-only">, has problems</span>
            </>
          )}
        </button>
        {readT && (
          <LiveMeter
            read={readT}
            label={`Binding ${i + 1} output`}
            className="hidden w-12 sm:block"
          />
        )}
        <IconButton
          label="Move up"
          disabled={i === 0}
          onClick={() => onMove(-1)}
        >
          <ChevronUp className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Move down"
          disabled={i === count - 1}
          onClick={() => onMove(1)}
        >
          <ChevronDown className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={`Remove binding ${i + 1}`}
          className="hover:text-neon-pink"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      {open && (
        <div className="space-y-3 border-t border-glass-border px-2.5 pb-3 pt-2">
          <FieldErrors errors={errors} path={p} exact />
          <FieldErrors errors={errors} path={`${p}.target`} exact />

          <label className="block max-w-[14rem]">
            <span className={miniLabel}>ID</span>
            <input
              aria-label={`Binding ${i + 1} id`}
              className={cn(smallInput, "font-mono-semibold")}
              value={b.id || ""}
              maxLength={32}
              placeholder={`binding-${i}`}
              onChange={(e) => setKey("id", e.target.value || undefined)}
            />
            <FieldErrors errors={errors} path={`${p}.id`} />
          </label>

          {/* Sources */}
          <div>
            <span className={miniLabel}>
              Source{rows.length > 1 ? "s" : ""}
            </span>
            <ul className="space-y-1.5">
              {rows.map((r, j) => {
                const info = sourceInfo(r.source);
                const raw = RAW_SOURCES.includes(r.source);
                return (
                  <li
                    key={j}
                    className="grid grid-cols-[minmax(0,1fr)_4.5rem_auto] items-center gap-1.5"
                  >
                    <Select
                      label={`Binding ${i + 1} source ${j + 1}`}
                      value={r.source}
                      options={SOURCE_OPTIONS}
                      invalid={
                        errorsAt(errors, `${p}.sources[${j}].source`).length > 0
                      }
                      onChange={(v) =>
                        setRows(
                          rows.map((x, k) =>
                            k === j ? { ...x, source: v as SourceName } : x
                          )
                        )
                      }
                    />
                    <NumField
                      label={`Weight ${j + 1}`}
                      value={
                        rows.length > 1 || r.weight !== 1 ? r.weight : undefined
                      }
                      placeholder="w 1"
                      onCommit={(v) =>
                        setRows(
                          rows.map((x, k) =>
                            k === j
                              ? { ...x, weight: v === undefined ? 1 : v }
                              : x
                          )
                        )
                      }
                      className="[&>span:first-child]:sr-only"
                    />
                    <IconButton
                      label={`Remove source ${j + 1}`}
                      disabled={rows.length <= 1}
                      onClick={() => setRows(rows.filter((_, k) => k !== j))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </IconButton>
                    <LiveMeter
                      read={() => groove.sources[SOURCE_INDEX[r.source]]}
                      min={raw ? info.range[0] : 0}
                      max={raw ? info.range[1] : 1}
                      label={`${info.label} level`}
                      className="col-span-3 h-1"
                      barClassName="bg-neon-cyan/70"
                    />
                    <FieldErrors
                      errors={errors}
                      path={`${p}.sources[${j}]`}
                      className="col-span-3"
                    />
                  </li>
                );
              })}
            </ul>
            <FieldErrors errors={errors} path={`${p}.source`} />
            <FieldErrors errors={errors} path={`${p}.sources`} exact />
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 font-body-bold text-xs text-white/70 hover:text-white disabled:opacity-30"
                disabled={rows.length >= DEFAULT_LIMITS.maxSourcesPerBinding}
                onClick={() =>
                  setRows([...rows, { source: "bass", weight: 1 }], b.combine)
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add source
              </button>
              {rows.length > 1 && (
                <Segmented
                  label="Combine"
                  value={b.combine || "sum"}
                  options={COMBINE_MODES.map((m) => ({ value: m, label: m }))}
                  onChange={(m) => setRows(rows, m)}
                />
              )}
            </div>
            <FieldErrors errors={errors} path={`${p}.combine`} />
          </div>

          <BindingTarget
            binding={b}
            index={i}
            onChange={onChange}
            errors={errors}
            choices={choices}
          />

          {/* Mapping */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-4">
            <RangeFields
              label="Input range"
              value={b.inputRange}
              placeholder={inPh}
              onCommit={(v) => setKey("inputRange", v)}
              errors={errors}
              path={`${p}.inputRange`}
            />
            {!trig && outPh && (
              <RangeFields
                label="Output range"
                value={b.outputRange}
                placeholder={outPh}
                onCommit={(v) => setKey("outputRange", v)}
                errors={errors}
                path={`${p}.outputRange`}
                hint={outputHint(target)}
              />
            )}
            <label className="block min-w-0">
              <span className={miniLabel}>Curve</span>
              <Select
                label={`Binding ${i + 1} curve`}
                value={b.curve || "linear"}
                options={CURVES}
                onChange={(v) => {
                  const nb = { ...b, curve: v as CurveName };
                  onChange(v === "step" ? nb : omit(nb, "steps"));
                }}
              />
              <FieldErrors errors={errors} path={`${p}.curve`} />
            </label>
            {b.curve === "step" ? (
              <NumField
                label="Steps"
                value={b.steps}
                placeholder="4"
                onCommit={(v) => setKey("steps", v)}
                errors={errors}
                path={`${p}.steps`}
              />
            ) : (
              <span className="hidden sm:block" />
            )}
            <NumField
              label="Attack"
              unit="ms"
              value={b.smoothing?.attackMs}
              placeholder="0"
              onCommit={(v) => setSmoothing("attackMs", v)}
              errors={errors}
              path={`${p}.smoothing.attackMs`}
            />
            <NumField
              label="Release"
              unit="ms"
              value={b.smoothing?.releaseMs}
              placeholder="0"
              onCommit={(v) => setSmoothing("releaseMs", v)}
              errors={errors}
              path={`${p}.smoothing.releaseMs`}
            />
            <label className="col-span-2 flex items-center gap-2 self-end pb-1.5 font-body-bold text-xs text-white/75">
              <input
                type="checkbox"
                className="accent-neon-cyan"
                checked={b.invert === true}
                onChange={(e) =>
                  setKey("invert", e.target.checked ? true : undefined)
                }
              />
              Invert (high input → low output)
            </label>
          </div>
          <FieldErrors errors={errors} path={`${p}.smoothing`} exact />
          <FieldErrors errors={errors} path={`${p}.invert`} />

          <div className="flex items-center gap-3">
            <CurveGraph
              name={b.curve || "linear"}
              steps={b.steps}
              invert={b.invert}
              readT={readT}
            />
            {readT ? (
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between font-mono-semibold text-[11px] text-white/60">
                  <span>OUTPUT</span>
                  <LiveNumber
                    read={readOut}
                    className="text-[12px] text-neon-cyan"
                  />
                </div>
                <LiveMeter read={readT} label={`Binding ${i + 1} output`} />
              </div>
            ) : (
              <p className="font-body-bold text-xs text-white/60">
                Fix the errors to see it move.
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  );
};
