import React from "react";
import { BadgeCheck } from "lucide-react";

export const CreatorBadge = () => (
  <span
    className="inline-flex items-center gap-1 rounded-full border border-neon-magenta/40 bg-neon-magenta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neon-magenta"
    title="Verified Creator"
  >
    <BadgeCheck className="h-3 w-3" />
    Creator
  </span>
);
