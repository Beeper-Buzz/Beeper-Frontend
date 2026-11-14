import React from "react";
import Head from "next/head";
import { useAuth } from "@config/auth";
import { SITE_TITLE } from "@utilities/branding";
import { useAffiliate } from "@hooks/useAffiliate";
import {
  ApplyForm,
  Dashboard,
  StatusCard,
  Terms
} from "../../components/Affiliate";
import AccountPageLayout from "./AccountPageLayout";

const AffiliatePage = () => {
  const { user } = useAuth();
  const { data: affiliate, isLoading, isError, refetch } = useAffiliate(!!user);
  const email = user?.data?.attributes?.email;

  let content: React.ReactNode;
  if (!user || isLoading) {
    content = (
      <div className="grid gap-5" aria-busy>
        <div className="glass-panel h-48 animate-pulse" />
        <div className="glass-panel h-72 animate-pulse" />
      </div>
    );
  } else if (isError) {
    content = (
      <div className="glass-panel p-5">
        <p className="m-0 font-body-bold text-sm text-white/70">
          Your affiliate account didn&apos;t load.{" "}
          <button
            type="button"
            onClick={() => refetch()}
            className="cursor-pointer border-0 bg-transparent p-0 text-neon-cyan underline underline-offset-4"
          >
            Try again
          </button>
        </p>
      </div>
    );
  } else if (!affiliate) {
    content = (
      <div className="grid gap-5">
        <ApplyForm defaultEmail={email} />
        <Terms />
      </div>
    );
  } else if (affiliate.status === "approved") {
    content = <Dashboard affiliate={affiliate} />;
  } else {
    content = (
      <div className="grid gap-5">
        <StatusCard
          affiliate={
            affiliate as typeof affiliate & {
              status: "pending" | "rejected" | "suspended";
            }
          }
        />
        <Terms
          commissionBps={affiliate.commission_bps}
          cookieDays={affiliate.cookie_days}
        />
      </div>
    );
  }

  return (
    <AccountPageLayout>
      <Head>
        <title>{`Affiliate | ${SITE_TITLE}`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      {content}
    </AccountPageLayout>
  );
};

export default AffiliatePage;
