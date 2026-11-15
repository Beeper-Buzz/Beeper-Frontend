// Note → clip (spec §4.6): the switcher's settings and its rules, one row per rule. Rows read as
// the wireframe ("keys 48–59 → Dance1 loop · beat") and open to edit the match and the clip.

import React, { useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Plus, X } from "lucide-react";
import { cn } from "@lib/utils";
import { DEFAULT_LIMITS } from "../../../../lib/gltfVisualizer/core/limits";
import {
  DRUM_VOICES,
  DrumVoice,
  NoteClipRuleConfig,
  NoteClipsConfig,
  NoteMatchConfig
} from "../../../../lib/gltfVisualizer/core/manifest";
import {
  describeRule,
  moveItem,
  TargetChoices
} from "../../../../lib/gltfVisualizer/edit";
import { noteName } from "../../../../lib/manifests/samplePack";
import { btnGhost, numCls } from "../../kit";
import {
  FieldErrors,
  hasErrors,
  IconButton,
  miniLabel,
  NumField,
  panelTitle,
  Segmented,
  Select
} from "./fields";

const BASE = "audio.noteClips";
const missing = (v: string) => `${v || "—"} (not in scene)`;

type Part = NoteMatchConfig["part"];
const PARTS: { value: Part; label: string }[] = [
  { value: "keys", label: "Keys (either)" },
  { value: "synth", label: "Synth" },
  { value: "samplerKeys", label: "Sampler keys" },
  { value: "sampler", label: "Pads" },
  { value: "drums", label: "Drums" }
];

const defaultMatch = (part: Part): NoteMatchConfig =>
  part === "sampler"
    ? { part, slot: 0 }
    : part === "drums"
    ? { part, voice: "kick" }
    : { part, notes: [48, 59] };

const defaultRule = (choices: TargetChoices): NoteClipRuleConfig => ({
  match: defaultMatch("keys"),
  clip: choices.clips[1] || choices.clips[0] || ""
});

/** Sets or (for undefined) removes a key, keeping the rest. */
function withKey<T extends object, K extends keyof T>(
  o: T,
  key: K,
  v: T[K] | undefined
): T {
  const out = { ...o };
  if (v === undefined) delete (out as Record<string, unknown>)[key as string];
  else out[key] = v;
  return out;
}

/** [lo, hi] of a keys / pads match (pads 0-based). */
function rangeOf(m: NoteMatchConfig): [number, number] {
  if (m.part === "drums") return [0, 0];
  if (m.part === "sampler")
    return m.slots ? m.slots : [m.slot ?? 0, m.slot ?? 0];
  return m.notes ? m.notes : [m.note ?? 60, m.note ?? 60];
}

function withRange(
  m: NoteMatchConfig,
  lo: number,
  hi: number
): NoteMatchConfig {
  if (m.part === "sampler")
    return lo === hi
      ? { part: m.part, slot: lo }
      : { part: m.part, slots: [lo, hi] };
  if (m.part === "drums") return m;
  return lo === hi
    ? { part: m.part, note: lo }
    : { part: m.part, notes: [lo, hi] };
}

const voicesOf = (m: NoteMatchConfig): DrumVoice[] =>
  m.part === "drums" ? m.voices || (m.voice ? [m.voice] : []) : [];

const safeName = (n: number) =>
  Number.isInteger(n) && n >= 0 && n <= 127 ? noteName(n) : "?";

const MatchEditor: React.FC<{
  match: NoteMatchConfig;
  onChange: (m: NoteMatchConfig) => void;
  errors: readonly string[];
  path: string;
}> = ({ match, onChange, errors, path }) => {
  const [lo, hi] = rangeOf(match);
  const pads = match.part === "sampler";
  const commit = (which: 0 | 1, v: number | undefined) => {
    if (v === undefined) return;
    const x = pads ? v - 1 : v;
    onChange(withRange(match, which === 0 ? x : lo, which === 1 ? x : hi));
  };
  return (
    <div className="space-y-2">
      <label className="block">
        <span className={miniLabel}>Part</span>
        <Select
          label="Part"
          value={match.part}
          options={PARTS}
          onChange={(v) => onChange(defaultMatch(v as Part))}
        />
      </label>
      {match.part === "drums" ? (
        <div>
          <span className={miniLabel}>Voices</span>
          <div className="flex flex-wrap gap-1">
            {DRUM_VOICES.map((v) => {
              const list = voicesOf(match);
              const on = list.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const next = on
                      ? list.filter((x) => x !== v)
                      : [...list, v];
                    const ordered = DRUM_VOICES.filter((x) => next.includes(x));
                    onChange(
                      ordered.length === 1
                        ? { part: "drums", voice: ordered[0] }
                        : { part: "drums", voices: ordered }
                    );
                  }}
                  className={cn(
                    "rounded border px-2 py-0.5 font-mono-semibold text-[11px] transition-colors",
                    on
                      ? "border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan"
                      : "border-glass-border text-white/60 hover:text-white"
                  )}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {([0, 1] as const).map((i) => {
            const v = i === 0 ? lo : hi;
            return (
              <NumField
                key={i}
                label={
                  pads
                    ? i === 0
                      ? "From pad"
                      : "To pad"
                    : i === 0
                    ? "From note"
                    : "To note"
                }
                value={pads ? v + 1 : v}
                onCommit={(x) => commit(i, x)}
                hint={pads ? "Pads 1–16" : "MIDI 0–127; middle C is 60 (C4)"}
              />
            );
          })}
          {!pads && (
            <p className={cn(numCls, "col-span-2 text-[11px] text-white/60")}>
              {safeName(lo)}
              {lo !== hi && ` – ${safeName(hi)}`}
            </p>
          )}
        </div>
      )}
      <FieldErrors errors={errors} path={path} />
    </div>
  );
};

const RuleEditor: React.FC<{
  rule: NoteClipRuleConfig;
  onChange: (r: NoteClipRuleConfig) => void;
  errors: readonly string[];
  path: string;
  choices: TargetChoices;
}> = ({ rule, onChange, errors, path, choices }) => {
  const vel = rule.velocity;
  return (
    <div className="space-y-3 border-t border-glass-border p-2.5">
      <FieldErrors errors={errors} path={path} exact />
      <MatchEditor
        match={rule.match}
        onChange={(m) => onChange({ ...rule, match: m })}
        errors={errors}
        path={`${path}.match`}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="col-span-2 block sm:col-span-1">
          <span className={miniLabel}>Clip</span>
          <Select
            label="Clip"
            value={rule.clip}
            options={choices.clips}
            invalid={hasErrors(errors, `${path}.clip`)}
            missingLabel={missing}
            onChange={(v) => onChange({ ...rule, clip: v })}
          />
          <FieldErrors errors={errors} path={`${path}.clip`} />
        </label>
        <label className="block">
          <span className={miniLabel}>Mode</span>
          <Select
            label="Mode"
            value={rule.mode || "loop"}
            options={[
              { value: "loop", label: "Loop" },
              { value: "once", label: "Once, then back" }
            ]}
            onChange={(v) =>
              onChange(
                withKey(rule, "mode", v === "loop" ? undefined : (v as "once"))
              )
            }
          />
        </label>
        <label className="block">
          <span className={miniLabel}>Start</span>
          <Select
            label="Start"
            value={rule.sync || "now"}
            options={[
              { value: "now", label: "Now" },
              { value: "beat", label: "Next beat" },
              { value: "bar", label: "Next bar" }
            ]}
            onChange={(v) =>
              onChange(
                withKey(
                  rule,
                  "sync",
                  v === "now" ? undefined : (v as "beat" | "bar")
                )
              )
            }
          />
        </label>
        <NumField
          label="Fade"
          unit="ms"
          value={rule.fadeMs}
          placeholder="default"
          errors={errors}
          path={`${path}.fadeMs`}
          onCommit={(v) => onChange(withKey(rule, "fadeMs", v))}
        />
        <NumField
          label="Speed"
          unit="×"
          value={rule.timeScale}
          placeholder="1"
          errors={errors}
          path={`${path}.timeScale`}
          onCommit={(v) => onChange(withKey(rule, "timeScale", v))}
        />
        <NumField
          label="Clip tempo"
          unit="BPM"
          value={rule.clipBpm}
          placeholder="no sync"
          hint="The clip's own tempo: it then plays at the song's tempo"
          errors={errors}
          path={`${path}.clipBpm`}
          onCommit={(v) => onChange(withKey(rule, "clipBpm", v))}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="col-span-2 block sm:col-span-1">
          <span className={miniLabel}>Velocity drives</span>
          <Select
            label="Velocity drives"
            value={vel ? vel.to : ""}
            options={[
              { value: "", label: "Nothing" },
              { value: "weight", label: "Weight" },
              { value: "timeScale", label: "Speed" }
            ]}
            onChange={(v) =>
              onChange(
                withKey(
                  rule,
                  "velocity",
                  v === "weight"
                    ? { to: "weight", range: [0.5, 1] }
                    : v === "timeScale"
                    ? { to: "timeScale", range: [0.8, 1.2] }
                    : undefined
                )
              )
            }
          />
        </label>
        {vel &&
          ([0, 1] as const).map((i) => (
            <NumField
              key={i}
              label={i === 0 ? "Softest" : "Loudest"}
              value={vel.range[i]}
              onCommit={(v) => {
                if (v === undefined) return;
                const range: [number, number] = [vel.range[0], vel.range[1]];
                range[i] = v;
                onChange({ ...rule, velocity: { ...vel, range } });
              }}
            />
          ))}
      </div>
      <FieldErrors errors={errors} path={`${path}.velocity`} />
    </div>
  );
};

export const NoteClipsEditor: React.FC<{
  noteClips: NoteClipsConfig | undefined;
  onChange: (next: NoteClipsConfig | undefined) => void;
  errors: readonly string[];
  choices: TargetChoices;
}> = ({ noteClips, onChange, errors, choices }) => {
  const [open, setOpen] = useState<number | null>(null);
  const nc = noteClips;
  const rules = nc?.rules || [];
  const set = <K extends keyof NoteClipsConfig>(
    k: K,
    v: NoteClipsConfig[K] | undefined
  ) => nc && onChange(withKey(nc, k, v));
  const setRules = (next: NoteClipRuleConfig[]) =>
    nc && onChange({ ...nc, rules: next });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={panelTitle}>Note → clip</h3>
        <Segmented
          label="Switch clips on notes"
          value={nc ? "on" : "off"}
          options={[
            { value: "off", label: "Off" },
            { value: "on", label: "On" }
          ]}
          onChange={(v) => {
            if (v === "off") onChange(undefined);
            else if (!nc)
              onChange({
                initial: choices.clips[0] || "",
                rules: [defaultRule(choices)]
              });
          }}
        />
      </div>
      {!nc ? (
        <p className="font-body-bold text-xs text-white/60">
          Switch between animations when notes play: keys, pads or drums pick a
          clip, which crossfades in.
        </p>
      ) : (
        <>
          <FieldErrors errors={errors} path={BASE} exact />
          <FieldErrors errors={errors} path={`${BASE}.rules`} exact />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="col-span-2 block sm:col-span-1">
              <span className={miniLabel}>Starts in</span>
              <Select
                label="Initial clip"
                value={nc.initial}
                options={choices.clips}
                invalid={hasErrors(errors, `${BASE}.initial`)}
                missingLabel={missing}
                onChange={(v) => set("initial", v)}
              />
              <FieldErrors errors={errors} path={`${BASE}.initial`} />
            </label>
            <NumField
              label="Fade"
              unit="ms"
              value={nc.fadeMs}
              placeholder="250"
              errors={errors}
              path={`${BASE}.fadeMs`}
              onCommit={(v) => set("fadeMs", v)}
            />
            <NumField
              label="Back after"
              unit="ms"
              value={nc.returnAfterMs}
              placeholder="never"
              hint="No matching note for this long → back to the starting clip (0 = never)"
              errors={errors}
              path={`${BASE}.returnAfterMs`}
              onCommit={(v) => set("returnAfterMs", v)}
            />
            <label className="block">
              <span className={miniLabel}>Notes at once</span>
              <Select
                label="Priority"
                value={nc.priority || "last"}
                options={[
                  { value: "last", label: "Last wins" },
                  { value: "velocity", label: "Loudest wins" }
                ]}
                onChange={(v) =>
                  set("priority", v === "last" ? undefined : "velocity")
                }
              />
            </label>
            <label className="block">
              <span className={miniLabel}>On stop</span>
              <Select
                label="On stop"
                value={nc.onStop || "hold"}
                options={[
                  { value: "hold", label: "Hold the clip" },
                  { value: "initial", label: "Back to start" }
                ]}
                onChange={(v) =>
                  set("onStop", v === "hold" ? undefined : "initial")
                }
              />
            </label>
          </div>

          <ul className="space-y-1.5">
            {rules.map((r, i) => {
              const path = `${BASE}.rules[${i}]`;
              const bad = hasErrors(errors, path);
              const expanded = open === i;
              return (
                <li
                  key={i}
                  className={cn(
                    "rounded-md border bg-white/[0.02]",
                    bad ? "border-neon-pink/40" : "border-glass-border"
                  )}
                >
                  <div className="flex items-center gap-1 px-1.5 py-1">
                    <IconButton
                      label={expanded ? "Collapse rule" : "Edit rule"}
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : i)}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </IconButton>
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : i)}
                      className={cn(
                        numCls,
                        "min-w-0 flex-1 truncate text-left text-xs text-white/80"
                      )}
                    >
                      {describeRule(r)}
                    </button>
                    {bad && (
                      <>
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-neon-pink"
                          aria-hidden
                        />
                        <span className="sr-only">has problems</span>
                      </>
                    )}
                    <IconButton
                      label="Move rule up"
                      disabled={i === 0}
                      onClick={() => {
                        setRules(moveItem(rules, i, -1));
                        setOpen(null);
                      }}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="Move rule down"
                      disabled={i === rules.length - 1}
                      onClick={() => {
                        setRules(moveItem(rules, i, 1));
                        setOpen(null);
                      }}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="Remove rule"
                      className="hover:text-neon-pink"
                      onClick={() => {
                        setRules(rules.filter((_, j) => j !== i));
                        setOpen(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </IconButton>
                  </div>
                  {expanded && (
                    <RuleEditor
                      rule={r}
                      path={path}
                      errors={errors}
                      choices={choices}
                      onChange={(next) =>
                        setRules(rules.map((x, j) => (j === i ? next : x)))
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-2">
            <span className={cn(numCls, "text-[11px] text-white/60")}>
              {rules.length}/{DEFAULT_LIMITS.maxNoteClipRules} rules · first
              match wins
            </span>
            <button
              type="button"
              className={cn(btnGhost, "px-2 py-1 font-body-bold text-xs")}
              disabled={rules.length >= DEFAULT_LIMITS.maxNoteClipRules}
              onClick={() => {
                setRules([...rules, defaultRule(choices)]);
                setOpen(rules.length);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add rule
            </button>
          </div>
        </>
      )}
    </div>
  );
};
