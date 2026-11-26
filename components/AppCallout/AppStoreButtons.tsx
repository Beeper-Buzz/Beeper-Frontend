import React from "react";
import type { AppLink } from "@lib/appLinks";

// Official store badge artwork is not in the repo (the square app icons are not
// badges and must not stand in for them), so every link renders as a text
// button. When compliant badges are added, render them in the "store" branch.
const renderLink = (link: AppLink) => {
  const key = `${link.platform}-${link.kind}-${link.href}`;
  switch (link.kind) {
    case "store":
    // fall through: no badge artwork yet
    case "beta":
    default:
      return (
        <a
          key={key}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="neon-btn"
        >
          {link.label}
        </a>
      );
  }
};

export const AppStoreButtons: React.FC<{ links: AppLink[] }> = ({ links }) => {
  if (!links || links.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {links.map(renderLink)}
    </div>
  );
};

export default AppStoreButtons;
