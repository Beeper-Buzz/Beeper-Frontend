import React from "react";
import { QueryClient } from "react-query";
import { dehydrate } from "react-query/hydration";
import { Layout, Header, ProductList, ComingSoon, NotifyForm, SocialLinks } from "../components";
import { fetchPosts, fetchProducts } from "../hooks";

const Home = () => {
  return (
    <Layout>
      <ComingSoon/>
      <NotifyForm/>
      <SocialLinks/>
    </Layout>
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
