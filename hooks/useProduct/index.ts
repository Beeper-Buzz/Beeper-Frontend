import { useQuery } from "react-query";
import { IProduct } from "@spree/storefront-api-v2-sdk/types/interfaces/Product";
import { spreeClient } from "../../config/spree";
import { QueryKeys } from "../queryKeys";

const fetchProduct = async (slug: string): Promise<IProduct> => {
  const storage = (await import("../../config/storage")).default;
  const token = await storage.getToken();

  const spreeUrl = `${process.env.SPREE_API_URL}/api/v2/storefront/products/${slug}`;
  let queryUrl = new URL(spreeUrl),
    params: any = {
      include:
        "default_variant,variants,option_types,product_properties,taxons,images,variants.option_values"
    };
  Object.keys(params).forEach((key) => queryUrl.searchParams.append(key, params[key]));
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  myHeaders.append("Authorization", token ? token.access_token : "");
  const response = await fetch(queryUrl.toString(), {
    method: "GET",
    headers: myHeaders
  })
    .then((res) => {
      // console.log(res.status);
      if (res.status >= 200 && res.status <= 299) {
        return res.json();
      }
      // else {
      //   // Promise.reject("Product request failed");
      //   // console.log("Uh oh RES: ", res.statusText);
      //   throw new Error(res.statusText);
      // }
    })
    .catch((err) => {
      // console.log("Uh oh ERR: ", err);
      throw new Error(`Product request failed: ${err.statusText}`);
    });

  return response;

  // const response = await spreeClient.products.show(
  //   {
  //     bearerToken: token ? token.access_token : undefined
  //   },
  //   slug
  // );
  // if (response.isSuccess()) {
  //   return response.success();
  // } else {
  //   throw new Error("Product request failed");
  // }
};

const useProduct = (id: string) => {
  return useQuery<IProduct, false>([QueryKeys.PRODUCT, id], () => fetchProduct(id));
};

export { useProduct, fetchProduct };
