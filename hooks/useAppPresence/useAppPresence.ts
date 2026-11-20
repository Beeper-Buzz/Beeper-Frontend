import { createContext, useContext } from "react";
import { useQuery } from "react-query";
import { QueryKeys } from "@hooks/queryKeys";
import { parseSettings } from "@hooks/useHomepage/useHomepage";
import { resolveAppLinks } from "@lib/appLinks";
import type { AppLink } from "@lib/appLinks";
import { selectAnnouncement, selectAppLinkOverride } from "@lib/announcement";
import type { Announcement } from "@lib/announcement";

export interface AppPresence {
  banner: Announcement | null;
  links: AppLink[];
}

// The admin sends no CORS headers, so this goes through the public proxy.
const ENDPOINT = "/api/public/homepage_sections?visible_only=true";

const envPresence = (): AppPresence => ({
  banner: null,
  links: resolveAppLinks(null)
});

export const AppPresenceContext = createContext<AppPresence>(envPresence());

export const fetchAppPresence = async (): Promise<AppPresence> => {
  const response = await fetch(ENDPOINT);
  if (!response.ok) throw new Error("Failed to fetch app presence");
  const data = await response.json();
  const raw = data?.response_data?.homepage_sections;
  // settings may arrive as a Ruby-hash string; the selectors need objects.
  const sections = Array.isArray(raw)
    ? raw.map((section: any) =>
        section && typeof section === "object"
          ? { ...section, settings: parseSettings(section.settings) }
          : section
      )
    : [];
  return {
    banner: selectAnnouncement(sections),
    links: resolveAppLinks(selectAppLinkOverride(sections))
  };
};

/** Internal: one fetch per page, seeded with the env links. */
export const useAppPresenceQuery = (): AppPresence => {
  const { data } = useQuery<AppPresence, Error>(
    [QueryKeys.APP_PRESENCE],
    fetchAppPresence,
    {
      staleTime: 5 * 60 * 1000,
      initialData: envPresence(),
      // Seed renders at once but counts as stale, so mount still fetches.
      initialDataUpdatedAt: 0,
      onError: (error) => {
        console.error("Failed to fetch app presence:", error.message);
      }
    }
  );
  return data ?? envPresence();
};

/** Context reader for every placement. Never undefined, never throws. */
export const useAppPresence = (): AppPresence => useContext(AppPresenceContext);
