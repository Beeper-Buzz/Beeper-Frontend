// Compact controls for the 3D-scene studio, built on the portal kit. Every control can show the
// validator's errors for the manifest path it edits (spec §6.2: "<path>: <message>").

import React, { useRef } from "react";
import { cn } from "@lib/utils";
import { errorMessage, errorsAt } from "../../../../lib/gltfVisualizer/edit";
import { inputCls, NumInput, numCls, selectCls } from "../../kit";

// 13 px text: Anybody Light (font-body-bold), never the ExtraLight body face.
export const smallInput = cn(
  inputCls,
  "px-2 py-1.5 font-body-bold text-[13px]"
);
export const smallSelect = cn(
  selectCls,
  "px-2 py-1.5 font-body-bold text-[13px]"
);
/** Labels above compact controls: Plex at 11 px, white/60 (the portal's floor), sentence case like the kit. */
export const miniLabel =
  "mb-0.5 block font-mono-semibold text-[11px] text-white/60";
/** Panel headings inside the studio. */
export const panelTitle = "font-michroma text-[11px] tracking-wide text-white";

/** The messages for `path` (and under it unless `exact`), under the control. */
export const FieldErrors: React.FC<{
  errors: readonly string[];
  path: string;
  exact?: boolean;
  className?: string;
}> = ({ errors, path, exact, className }) => {
  const list = errorsAt(errors, path, exact);
  if (!list.length) return null;
  return (
    <ul className={cn("mt-1 space-y-0.5", className)}>
      {list.map((e) => (
        <li
          key={e}
          className="font-body-bold text-[11px] leading-snug text-neon-pink"
        >
          {errorMessage(e)}
        </li>
      ))}
    </ul>
  );
};

export const hasErrors = (
  errors: readonly string[],
  path: string,
  exact?: boolean
): boolean => errorsAt(errors, path, exact).length > 0;

export type Option = string | { value: string; label: string };

export const Select: React.FC<{
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (v: string) => void;
  invalid?: boolean;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** Shown when `value` isn't among the options (e.g. a name the GLB lacks). */
  missingLabel?: (v: string) => string;
}> = ({
  label,
  value,
  options,
  onChange,
  invalid,
  className,
  id,
  disabled,
  missingLabel
}) => {
  const opts = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  const known = opts.some((o) => o.value === value);
  return (
    <select
      id={id}
      aria-label={label}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      className={cn(smallSelect, invalid && "border-neon-pink/60", className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {!known && (
        <option value={value}>
          {missingLabel ? missingLabel(value) : value || "—"}
        </option>
      )}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
};

/** A labelled number field (commits on blur / Enter) with its path's errors. */
export const NumField: React.FC<{
  label: string;
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  errors?: readonly string[];
  path?: string;
  placeholder?: string;
  unit?: string;
  className?: string;
  hint?: string;
}> = ({
  label,
  value,
  onCommit,
  errors = [],
  path,
  placeholder,
  unit,
  className,
  hint
}) => {
  const bad = path ? hasErrors(errors, path) : false;
  return (
    <label className={cn("block min-w-0", className)}>
      <span className={miniLabel}>
        {label}
        {unit && <span className="normal-case"> ({unit})</span>}
      </span>
      <NumInput
        aria-label={label}
        title={hint}
        className={cn(smallInput, numCls)}
        value={value}
        placeholder={placeholder}
        invalid={bad || (value !== undefined && !Number.isFinite(value))}
        onCommit={onCommit}
      />
      {path && <FieldErrors errors={errors} path={path} />}
    </label>
  );
};

/** #RRGGBB with a swatch picker and a text field. */
export const ColorField: React.FC<{
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}> = ({
  label,
  value,
  onChange,
  placeholder = "#000000",
  invalid,
  className
}) => {
  const shown = value || placeholder;
  const valid = /^#[0-9a-fA-F]{6}$/.test(shown);
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <input
        type="color"
        aria-label={`${label} swatch`}
        value={valid ? shown : "#000000"}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-glass-border bg-transparent p-0.5"
      />
      <input
        aria-label={label}
        className={cn(
          smallInput,
          numCls,
          "min-w-0 uppercase",
          invalid && "border-neon-pink/60"
        )}
        value={value || ""}
        placeholder={placeholder}
        maxLength={7}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
};

/** Small square icon button (reorder, remove). */
export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
> = ({ label, className, children, ...rest }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cn(
      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-30",
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

/** Segmented toggle (e.g. Shader | 3D scene, Demo groove | Silent). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  disabled
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  /** Shows the choice but doesn't let it change. */
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn(
        "inline-flex rounded-md border border-glass-border p-0.5",
        className
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled && !on}
            onClick={() => !disabled && onChange(o.value)}
            className={cn(
              "rounded px-2.5 py-1 font-body-bold text-xs transition-colors",
              on
                ? "bg-neon-cyan/15 text-neon-cyan"
                : "text-white/60 hover:text-white",
              disabled &&
                !on &&
                "cursor-not-allowed opacity-40 hover:text-white/60"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

let rowSeq = 0;
/** A React key for a new row. */
export const newRowId = (): string => `row${++rowSeq}`;

/**
 * Stable React keys for a list an editor changes itself. The ids follow rows through moves and
 * removals when the editor records each change with `track` before emitting it; a list replaced
 * from outside (an import, a reset) gets fresh ids, so its rows remount.
 */
export function useRowIds<T>(list: readonly T[]): {
  ids: string[];
  track: (next: readonly T[], nextIds: string[]) => void;
} {
  const ref = useRef<{ list: readonly T[]; ids: string[] } | null>(null);
  if (!ref.current || ref.current.list !== list)
    ref.current = { list, ids: list.map(() => newRowId()) };
  return {
    ids: ref.current.ids,
    track: (next, nextIds) => {
      ref.current = { list: next, ids: nextIds };
    }
  };
}
