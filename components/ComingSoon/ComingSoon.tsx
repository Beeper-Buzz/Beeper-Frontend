import React, { useState, useEffect, useCallback } from "react";
import { NotifyForm, ProductTeaser, SocialLinks } from "../components";
import { QueryClient } from "react-query";
import { dehydrate } from "react-query/hydration";
import { useMutation, useQueryClient } from "react-query";
import { fetchProducts, useProducts } from "../../hooks";
import { ArrowBack, ArrowForward } from "@material-ui/icons";
import { CarouselProvider, Slider } from "pure-react-carousel";
import "pure-react-carousel/dist/react-carousel.es.css";

import {
  Container,
  Logo,
  LogoText,
  ProductImageCarousel,
  CarouselBackground,
  StyledSlider,
  StyledSlide,
  StyledImageWithZoom,
  CarouselNav,
  CarouselBackButton,
  CarouselNextButton,
  Text
} from "./ComingSoon.styles";

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
  const [isSlideshow, setIsSlideshow] = useState(false);

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

  const renderProductImgs = useCallback(() => {
    return productsData.data.map((i: any) => {
      const productImg = i.relationships?.images?.data[0]?.id;
      const allImages = productsData
        ? productsData?.included?.filter((e: any) => e.type == "image")
        : [];
      const foundImg = allImages
        ? allImages.filter((e: any) => e["id"] == productImg)
        : undefined;
      const imgUrl =
        foundImg !== undefined ? foundImg[0]?.attributes?.styles[4]?.url : "";
      const imgSrc = productImg ? `${process.env.SPREE_API_URL}${imgUrl}` : "";
      return allImages?.map((image: any, index: any) => {
        const imgSrc = image?.attributes?.styles[9]?.url || "";
        const imgUrl = `${process.env.SPREE_API_URL}${imgSrc}`;
        return (
          <StyledSlide
            key={`image-${index}`}
            index={index}
            onClick={() => setIsSlideshow(false)}
          >
            <StyledImageWithZoom src={imgUrl} />
          </StyledSlide>
        );
      });
    });
  }, [productsData]);

  useEffect(() => {
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
          <ProductTeaser
            products={productsData}
            title={""}
            openSlideshow={(e: any) => setIsSlideshow(e)}
          />
        )}
        {comingSoonText !== "" && <Text>{comingSoonText}</Text>}
        <NotifyForm />
        <SocialLinks />
        {isSlideshow && (
          <ProductImageCarousel>
            <CarouselBackground onClick={() => setIsSlideshow(false)} />
            <CarouselProvider
              naturalSlideWidth={600}
              naturalSlideHeight={600}
              totalSlides={productsData.data ? productsData.data.length : 1}
              // isIntrinsicHeight
              touchEnabled
              infinite={productsData.data ? true : false}
            >
              <StyledSlider className="slider">
                {renderProductImgs()}
              </StyledSlider>

              <CarouselNav>
                <CarouselBackButton>
                  <ArrowBack />
                </CarouselBackButton>
                <CarouselNextButton>
                  <ArrowForward />
                </CarouselNextButton>
              </CarouselNav>
            </CarouselProvider>
          </ProductImageCarousel>
        )}
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
