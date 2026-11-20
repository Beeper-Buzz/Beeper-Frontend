import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAppPresence } from "@hooks/useAppPresence";
import { isFromApp } from "@lib/fromApp";
import { AppStoreButtons } from "./AppStoreButtons";

export type AppCalloutVariant = "section" | "inline" | "bar";

const dismissKey = (updatedAt: string | number) =>
  `beeper:announcement:${updatedAt}`;

const readDismissed = (key: string): boolean => {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
};

export const AppCallout: React.FC<{ variant: AppCalloutVariant }> = ({
  variant
}) => {
  const { banner, links } = useAppPresence();

  // Client-only checks; never read during render (hydration mismatch).
  const [mounted, setMounted] = useState(false);
  const [fromApp, setFromApp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const key = banner ? dismissKey(banner.updatedAt) : null;
  useEffect(() => {
    setFromApp(isFromApp());
    setDismissed(key ? readDismissed(key) : false);
    setMounted(true);
  }, [key]);

  // Nothing to link to, or the visitor is already in the app: show nothing.
  // section/inline server-render from links and hide after mount for app
  // visitors; bar reads localStorage so it waits for mount.
  if (fromApp || links.length === 0) return null;
  if (variant === "bar" && !mounted) return null;

  if (variant === "bar") {
    if (!banner || dismissed) return null;
    const href = banner.ctaHref ?? links[0].href;
    // Label falls back to the first link's only when href did too; a custom
    // href with no label gets no anchor rather than an invisible one.
    const ctaLabel =
      banner.ctaLabel || (banner.ctaHref ? null : links[0].label);
    const dismiss = () => {
      if (key) {
        try {
          window.localStorage.setItem(key, "1");
        } catch {
          // storage blocked: hide for this view only
        }
      }
      setDismissed(true);
    };
    return (
      <div className="flex items-center justify-center gap-3 bg-black/60 px-4 py-2 text-center text-sm text-white">
        <span>{banner.message}</span>
        {ctaLabel && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline"
          >
            {ctaLabel}
          </a>
        )}
        {banner.dismissible && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss announcement"
            className="ml-2 px-1 text-white/70 hover:text-white"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-4 text-center sm:flex-row">
        <p className="font-body text-sm text-white/70">
          The Beeper app beta is open on iPhone.
        </p>
        <AppStoreButtons links={links} />
      </div>
    );
  }

  return (
    <section className="section-container px-6 py-16 sm:px-12 md:px-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass-panel mx-auto flex max-w-3xl flex-col items-center gap-5 p-8 text-center"
      >
        <h2 className="font-microtechnic text-title-md">
          The Beeper app is almost here
        </h2>
        <p className="font-body text-body-md text-white/70">
          A full music studio in your pocket: record, play the built-in synth,
          and pair the Beeper over wireless MIDI. The beta is open on iPhone.
        </p>
        <AppStoreButtons links={links} />
      </motion.div>
    </section>
  );
};

export default AppCallout;
