import React from "react";
import Link from "next/link";
import { useWithdrawCreatorApplication } from "@hooks/useCreator";
import type { CreatorApplication } from "../../lib/creator/types";
import { kindLabel } from "../../lib/marketplace";
import {
  btnDanger,
  btnPrimary,
  Chip,
  ErrorNote,
  formatDate,
  Section
} from "../CreatorPortal/kit";

export const ApplicationStatus: React.FC<{
  application: CreatorApplication;
  onApplyAgain?: () => void;
}> = ({ application: app, onApplyAgain }) => {
  const withdraw = useWithdrawCreatorApplication();

  if (app.status === "pending") {
    return (
      <Section
        title="Application in review"
        aside={<Chip tone="amber">Pending</Chip>}
      >
        <p className="font-body text-sm text-white/70">
          Sent {formatDate(app.created_at)} as{" "}
          <span className="text-white">{app.display_name}</span> for{" "}
          {app.kinds.map((k) => kindLabel(k, true).toLowerCase()).join(", ")}.
          We review applications by hand and email you when there&apos;s a
          decision.
        </p>
        <ErrorNote error={withdraw.error} />
        <div className="mt-4">
          <button
            type="button"
            className={btnDanger}
            disabled={withdraw.isLoading}
            onClick={() => {
              if (window.confirm("Withdraw your creator application?"))
                withdraw.mutate();
            }}
          >
            {withdraw.isLoading ? "Withdrawing…" : "Withdraw application"}
          </button>
        </div>
      </Section>
    );
  }

  if (app.status === "rejected") {
    return (
      <Section
        title="Application not approved"
        aside={<Chip tone="pink">Not approved</Chip>}
      >
        <p className="font-body text-sm text-white/70">
          Reviewed {formatDate(app.reviewed_at)}.
        </p>
        {app.review_note && (
          <blockquote className="mt-3 border-l-2 border-neon-pink/50 pl-3 font-body text-sm text-white/80">
            {app.review_note}
          </blockquote>
        )}
        {onApplyAgain && (
          <button
            type="button"
            className={`${btnPrimary} mt-4`}
            onClick={onApplyAgain}
          >
            Apply again
          </button>
        )}
      </Section>
    );
  }

  return <CreatorApproved />;
};

export const CreatorApproved: React.FC = () => (
  <Section
    title="You're a Beeper creator"
    aside={<Chip tone="lime">Approved</Chip>}
  >
    <p className="font-body text-sm text-white/70">
      Upload products, follow their review and see your sales in the creator
      studio.
    </p>
    <Link href="/creator" className={`${btnPrimary} mt-4 no-underline`}>
      Open creator studio
    </Link>
  </Section>
);
