/**
 * Program defaults for public copy (backend `Affiliates.config`). The signed-in
 * dashboard shows the affiliate's own rate and cookie window from the API.
 */
import { DEFAULT_REF_DAYS } from "./ref";

export const DEFAULT_COMMISSION_BPS = 1000;
export const DEFAULT_COOKIE_DAYS = DEFAULT_REF_DAYS;
export const HOLD_DAYS = 30;

export const AFFILIATE_CHANNELS = [
  "YouTube",
  "TikTok",
  "Instagram",
  "Twitch",
  "X / Twitter",
  "Blog or website",
  "Newsletter",
  "Podcast",
  "Discord or community",
  "Teaching",
  "Other"
] as const;
