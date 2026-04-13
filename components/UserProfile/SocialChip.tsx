import React from "react";
import { Instagram, Youtube, Globe } from "lucide-react";

const TikTokIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z" />
  </svg>
);

const SoundCloudIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 17.939h-1V9.061c.316-.083.65-.124 1-.124.34 0 .67.041 1 .124v8.878A3.93 3.93 0 0 1 7 17.939zM4 17.939H3v-7c.32-.081.653-.124 1-.124s.68.043 1 .124v7zm15.354-9.82a5.942 5.942 0 0 0-1.7.247 6 6 0 0 0-5.6-3.896c-1.42 0-2.76.493-3.814 1.35v11.938h11.114c2.043 0 3.7-1.657 3.7-3.7s-1.657-3.7-3.7-3.7v-.239z" />
  </svg>
);

const BandcampIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z" />
  </svg>
);

type Platform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "soundcloud"
  | "bandcamp"
  | "website";

const buildUrl = (platform: Platform, handle: string): string => {
  switch (platform) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://tiktok.com/@${handle}`;
    case "youtube":
      return `https://youtube.com/@${handle}`;
    case "soundcloud":
      return `https://soundcloud.com/${handle}`;
    case "bandcamp":
      return `https://${handle}.bandcamp.com`;
    case "website":
      return handle.startsWith("http") ? handle : `https://${handle}`;
  }
};

const getIcon = (platform: Platform) => {
  switch (platform) {
    case "instagram":
      return <Instagram className="h-4 w-4" />;
    case "tiktok":
      return <TikTokIcon />;
    case "youtube":
      return <Youtube className="h-4 w-4" />;
    case "soundcloud":
      return <SoundCloudIcon />;
    case "bandcamp":
      return <BandcampIcon />;
    case "website":
      return <Globe className="h-4 w-4" />;
  }
};

const getLabel = (platform: Platform, handle: string): string => {
  if (platform === "website") {
    return handle.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  return handle;
};

interface SocialChipProps {
  platform: Platform;
  handle: string;
}

export const SocialChip = ({ platform, handle }: SocialChipProps) => (
  <a
    href={buildUrl(platform, handle)}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-1.5 font-mono text-xs text-neon-cyan transition-colors hover:border-neon-cyan hover:bg-neon-cyan/15"
  >
    {getIcon(platform)}
    <span>{getLabel(platform, handle)}</span>
  </a>
);
