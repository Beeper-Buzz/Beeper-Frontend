import React from "react";
import Head from "next/head";
import AccountPageLayout from "./AccountPageLayout";
import { LibraryView } from "@components/Library/LibraryView";
import { useAuth } from "@config/auth";

const LibraryPage = () => {
  const { user } = useAuth();
  return (
    <AccountPageLayout>
      <Head>
        <title>Library | Beeper</title>
      </Head>
      <h2 className="mb-4 font-michroma text-base text-white">Library</h2>
      <LibraryView enabled={!!user} />
    </AccountPageLayout>
  );
};

export default LibraryPage;
