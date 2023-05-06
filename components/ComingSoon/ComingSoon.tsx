import React, { useEffect } from "react";
import { NotifyForm, ProductTeaser, SocialLinks } from "../components";
import { CarouselProvider, Slider } from "pure-react-carousel";
import { QueryClient } from "react-query";
import { dehydrate } from "react-query/hydration";
import { useMutation, useQueryClient } from "react-query";
import { fetchProducts, useProducts } from "../../hooks";

import "pure-react-carousel/dist/react-carousel.es.css";

import { Container, Logo, Text } from "./ComingSoon.styles";

export const ComingSoon = () => {
  const mailChimpUrl = `${process.env.MAILCHIMP_URL}?u=${process.env.MAILCHIMP_ID}&id=${process.env.MAILCHIMP_U}`;

  const queryClient = useQueryClient();
  const {
    error: productsError,
    status: productsStatus,
    data: productsData,
    isLoading: productsAreLoading,
    isSuccess: productsSuccess
  }: { error: any; status: any; data: any; isLoading: boolean; isSuccess: boolean } = useProducts(
    1
  );

  useEffect(() => {
    if (productsSuccess) {
      queryClient.setQueryData(["products", 1], productsData);
      console.log("productsData", productsData);
    }
  }, [productsSuccess]);

  return (
    <>
      <Container>
        <Logo src={process.env.LOGO_PATH} />
        {process.env.IS_PREVIEW_MODE && <ProductTeaser products={productsData} title={""} />}
        <Text>{process.env.COMING_SOON_COPY}</Text>
        <NotifyForm />
        <SocialLinks />
      </Container>
    </>
  );
};

export async function getServerSideProps() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery(["products", 1], () => fetchProducts(1));

  return {
    props: {
      dehydratedState: dehydrate(queryClient)
    }
  };
}
