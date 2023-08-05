// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { makeClient } from "@spree/storefront-api-v2-sdk";
import type { NextApiRequest, NextApiResponse } from "next";

const client = makeClient({
  host: "https://pol-admin-staging.instinct.is/"
});

export default (req: NextApiRequest, res: NextApiResponse) => {
  const products = client.products.list({ page: 1 });
  console.log("products: ", products);
  res.statusCode = 200;
  res.json({ name: "John Doe" });
};
