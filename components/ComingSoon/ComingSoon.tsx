import React, { useEffect } from "react";
import { NotifyForm, ProductTeaser, SocialLinks } from "../components";
import { CarouselProvider, Slider } from "pure-react-carousel";
import { QueryClient } from "react-query";
import { dehydrate } from "react-query/hydration";
import { useMutation, useQueryClient } from "react-query";
import { fetchProducts, useProducts } from "../../hooks";

import "pure-react-carousel/dist/react-carousel.es.css";

import { Container, Logo, LogoText, Text } from "./ComingSoon.styles";

const siteTitle = process.env.SITE_TITLE || "";
const siteDesc = process.env.SITE_DESC || "";
const logoPath = process.env.LOGO_PATH;
const previewMode = process.env.IS_PREVIEW_MODE === "true" ? true : false;
const comingSoonText = process.env.COMING_SOON_TEXT || "";
const mailerUrl = process.env.MAILCHIMP_URL || "";
const mailerId = process.env.MAILCHIMP_ID || "";
const mailerUser = process.env.MAILCHIMP_U || "";

export const ComingSoon = () => {
  const mailChimpUrl = `${mailerUrl}?u=${mailerId}&id=${mailerUser}`;

  const queryClient = useQueryClient();
  const {
    error: productsError,
    status: productsStatus,
    data: productsData,
    isLoading: productsAreLoading,
    isSuccess: productsSuccess
  }: {
    error: any;
    status: any;
    data: any;
    isLoading: boolean;
    isSuccess: boolean;
  } = useProducts(1);

  useEffect(() => {
    console.log("LOGO PATH: ", logoPath);
    if (productsSuccess) {
      queryClient.setQueryData(["products", 1], productsData);
    }
  }, [productsSuccess]);

  return (
    <>
      <Container>
        {logoPath ? (
          <Logo src={logoPath} />
        ) : siteTitle ? (
          <LogoText>{siteTitle}</LogoText>
        ) : null}
        {siteDesc && <Text>{siteDesc}</Text>}
        {previewMode && (
          <ProductTeaser products={productsData} title={""} />
        )}
        {comingSoonText !== "" && <Text>{comingSoonText}</Text>}
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
