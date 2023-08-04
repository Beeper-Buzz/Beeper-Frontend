import React from "react";
import { QueryClient } from "react-query";
import { dehydrate } from "react-query/hydration";
import { Layout, ComingSoon, NotifyForm, SocialLinks } from "../components";
import { fetchPosts, fetchProducts } from "../hooks";
import Head from "next/head";

const Home = () => {
  return (
    <>
      <Head>
        <title>beeper</title>
        <meta property="og:description" content="A new mobile music experience coming to a “where ever you are” near you." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ahrefs.com/blog/open-graph-meta-tags/" />

        <meta property="og:image" content="OpenGraph-Thumbnail.jpg" />
      </Head>
      <Layout>
        <ComingSoon />
        <NotifyForm />
        <SocialLinks />
      </Layout>
    </>
  );
};

export async function getServerSideProps() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery(["posts", 10], () => fetchPosts(10));
  await queryClient.prefetchQuery(["products", 1], () => fetchProducts(1));

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
  };
}

export default Home;
