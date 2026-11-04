import React from "react";
import { UnavailableLine } from "../../lib/cartAvailability";

interface Props {
  lines: UnavailableLine[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

/** Names the cart lines that can't be bought, each with a way to remove it. */
export const UnavailableCartLines = ({ lines, onRemove, disabled }: Props) => {
  if (lines.length === 0) return null;
  return (
    <div
      role="alert"
      className="glass-panel mb-4 px-4 py-3 font-title text-sm text-neon-pink"
      style={{ borderColor: "rgba(255, 20, 147, 0.3)" }}
    >
      <p>
        {lines.length === 1
          ? "This item is no longer available. Remove it to check out."
          : "These items are no longer available. Remove them to check out."}
      </p>
      <ul className="mt-2 space-y-1">
        {lines.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-white">{line.name}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemove(line.id)}
              aria-label={`Remove ${line.name}`}
              className="shrink-0 border-none bg-transparent text-xs text-neon-pink underline disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
