import Head from "next/head";
import { Layout } from "@components/Layout";
import { FourOhFour } from "@components/404/FourOhFour";

export default function NotFoundPage() {
  return (
    <Layout>
      <Head>
        <title>Page not found</title>
      </Head>
      <FourOhFour />
    </Layout>
  );
}
