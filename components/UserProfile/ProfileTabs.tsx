import React from "react";
import { cn } from "@lib/utils";

export type ProfileTab = "favorites" | "streams" | "shop";

interface ProfileTabsProps {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  showStreams: boolean;
  showShop: boolean;
}

export const ProfileTabs = ({
  active,
  onChange,
  showStreams,
  showShop
}: ProfileTabsProps) => {
  const tabClass = (tab: ProfileTab) =>
    cn(
      "px-4 py-2 font-pressstart text-xs uppercase tracking-wider transition-colors border-b-2 cursor-pointer bg-transparent",
      active === tab
        ? "text-neon-cyan border-neon-cyan"
        : "text-white/50 border-transparent hover:text-white"
    );

  return (
    <div className="mb-6 mt-8 flex gap-2 border-b border-glass-border overflow-x-auto">
      <button
        className={tabClass("favorites")}
        onClick={() => onChange("favorites")}
      >
        Favorites
      </button>
      {showStreams && (
        <button
          className={tabClass("streams")}
          onClick={() => onChange("streams")}
        >
          Streams
        </button>
      )}
      {showShop && (
        <button className={tabClass("shop")} onClick={() => onChange("shop")}>
          Shop
        </button>
      )}
    </div>
  );
};
