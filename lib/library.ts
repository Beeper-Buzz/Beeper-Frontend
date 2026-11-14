// The web library (/account/library): what the signed-in user owns, grouped
// for display. Revoked items stay listed for 7 days (spec §1.1), last.

import { DIGITAL_KINDS, DigitalKind } from "./marketplace";
import type { LibraryItem } from "./creator/types";

export interface LibraryGroup {
  kind: DigitalKind;
  items: LibraryItem[];
}

const time = (iso?: string | null) => {
  const t = iso ? new Date(iso).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

export function groupLibrary(items: LibraryItem[]): LibraryGroup[] {
  return DIGITAL_KINDS.map((kind) => ({
    kind,
    items: items
      .filter((i) => i.kind === kind)
      .sort(
        (a, b) =>
          Number(!!a.revoked_at) - Number(!!b.revoked_at) ||
          time(b.granted_at) - time(a.granted_at)
      )
  })).filter((g) => g.items.length > 0);
}
