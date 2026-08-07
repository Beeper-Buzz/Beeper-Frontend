import React from "react";
import { Instagram, Facebook } from "lucide-react";

// lucide-react has no X brand mark — its `X` export is the close/cross glyph —
// so the logo is inlined here, same as the brand SVGs in UserProfile/SocialChip.
const XIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const SocialLinks = ({ darkMode }: any) => {
  const socialLinks: {
    icon: React.ComponentType<{ className?: string }>;
    href: string;
    label: string;
  }[] = [
    {
      icon: Instagram,
      href: `http://www.instagram.com/${
        process.env.NEXT_PUBLIC_INSTAGRAM_SLUG || ""
      }`,
      label: "Instagram"
    },
    {
      icon: Facebook,
      href: `http://www.facebook.com/${
        process.env.NEXT_PUBLIC_FACEBOOK_SLUG || ""
      }`,
      label: "Facebook"
    },
    {
      icon: XIcon,
      href: `https://x.com/${process.env.NEXT_PUBLIC_TWITTER_SLUG || ""}`,
      label: "X"
    }
  ];

  return (
    <div className="flex items-center justify-center gap-4">
      {socialLinks.map((social) => {
        const Icon = social.icon;
        return (
          <a
            key={social.label}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.label}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-all hover:text-neon-cyan hover:drop-shadow-[0_0_8px_rgba(0,255,255,0.6)]"
          >
            <Icon className="h-5 w-5" />
          </a>
        );
      })}
    </div>
  );
};
