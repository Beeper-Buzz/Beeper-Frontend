import React, { useState } from "react";
import Head from "next/head";
import { Layout } from "@components/Layout";
import { ApplyForm } from "@components/Creator/ApplyForm";
import {
  ApplicationStatus,
  CreatorApproved
} from "@components/Creator/ApplicationStatus";
import { ErrorNote, PageTitle, Skeleton } from "@components/CreatorPortal/kit";
import { useCreator, useCreatorApplication } from "@hooks/useCreator";
import { useAuth } from "@config/auth";

const AccountCreatorPage = () => {
  const { user } = useAuth();
  const signedIn = !!user;
  const creator = useCreator(signedIn);
  const application = useCreatorApplication(signedIn);
  const [applyAgain, setApplyAgain] = useState(false);

  const loading = !user || creator.isLoading || application.isLoading;
  const app = application.data;
  const isCreator = !!creator.data;

  let body: JSX.Element;
  if (loading) {
    body = <Skeleton className="h-48" />;
  } else if (application.error && !isCreator) {
    body = <ErrorNote error={application.error} />;
  } else if (isCreator || app?.status === "approved") {
    body = <CreatorApproved />;
  } else if (
    app &&
    (app.status === "pending" || (app.status === "rejected" && !applyAgain))
  ) {
    body = (
      <ApplicationStatus
        application={app}
        onApplyAgain={() => setApplyAgain(true)}
      />
    );
  } else {
    body = <ApplyForm />;
  }

  return (
    <Layout>
      <Head>
        <title>Creator application | Beeper</title>
      </Head>
      <div className="section-container max-w-3xl py-8 sm:py-10">
        <PageTitle sub="Sell sample packs, effect presets and visualizers that people use inside the Beeper app.">
          Become a creator
        </PageTitle>
        {body}
      </div>
    </Layout>
  );
};

export default AccountCreatorPage;
