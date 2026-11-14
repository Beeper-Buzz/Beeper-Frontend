import React from "react";
import { Clock, Ban, CircleSlash } from "lucide-react";
import { CONTACT_EMAIL } from "@utilities/branding";
import type { Affiliate } from "@lib/affiliate/types";
import { Panel, num } from "./ui";

const COPY = {
  pending: {
    icon: Clock,
    tone: "text-neon-amber",
    title: "Application received",
    body: "We review every application by hand. This page turns into your dashboard once you're approved."
  },
  rejected: {
    icon: CircleSlash,
    tone: "text-white/60",
    title: "Application not approved",
    body: "We can't add you to the program right now. If something has changed, write to us and we'll take another look."
  },
  suspended: {
    icon: Ban,
    tone: "text-neon-pink",
    title: "Affiliate account suspended",
    body: "Your link still works for shoppers, but orders through it don't earn commission. Write to us if you think this is a mistake."
  }
} as const;

export const StatusCard: React.FC<{
  affiliate: Affiliate & { status: keyof typeof COPY };
}> = ({ affiliate }) => {
  const c = COPY[affiliate.status];
  const Icon = c.icon;
  const channels = affiliate.application?.channels?.filter(Boolean) || [];

  return (
    <Panel>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${c.tone}`} aria-hidden />
        <div className="min-w-0">
          <h2 className="m-0 mb-2 font-michroma text-[13px] leading-5 tracking-[0.03em] text-white">
            {c.title}
          </h2>
          <p className="m-0 max-w-prose font-body-bold text-sm leading-6 text-white/70">
            {c.body}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-white/10 pt-4 text-sm xs:grid-cols-2">
        <div className="min-w-0">
          <dt className="font-body-bold text-xs text-white/50">Code</dt>
          <dd className={`m-0 mt-0.5 truncate text-white ${num}`}>
            {affiliate.code || "—"}
          </dd>
        </div>
        {channels.length > 0 && (
          <div className="min-w-0">
            <dt className="font-body-bold text-xs text-white/50">Channels</dt>
            <dd className="m-0 mt-0.5 font-body-bold text-white/80">
              {channels.join(", ")}
            </dd>
          </div>
        )}
      </dl>

      {affiliate.status !== "pending" && (
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
            `Affiliate account: ${affiliate.code}`
          )}`}
          className="mt-5 inline-block font-body-bold text-sm text-neon-cyan underline underline-offset-4"
        >
          Email {CONTACT_EMAIL}
        </a>
      )}
    </Panel>
  );
};

export default StatusCard;
