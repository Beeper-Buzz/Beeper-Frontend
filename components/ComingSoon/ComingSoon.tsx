import React, { useState, useEffect, useCallback } from "react";
import {
  NotifyForm,
  ProductTeaser,
  SocialLinks,
  Logo,
  LogoBlob
} from "../components";
import { QueryClient } from "react-query";
import { dehydrate } from "react-query/hydration";
import { useQueryClient } from "react-query";
import { fetchProducts, useProducts } from "../../hooks";
import { ArrowBack, ArrowForward } from "@material-ui/icons";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import { CarouselProvider } from "pure-react-carousel";
import { useSpring } from "react-spring";
import "pure-react-carousel/dist/react-carousel.es.css";

import {
  Container,
  LogoText,
  ProductImageCarousel,
  CarouselBackground,
  StyledSlider,
  StyledSlide,
  StyledImageWithZoom,
  CarouselNav,
  CarouselBackButton,
  CarouselNextButton,
  Text,
  Fade,
  Device
} from "./ComingSoon.styles";

export const ComingSoon = () => {
  const isServer = typeof window === "undefined";
  const siteTitle = process.env.NEXT_PUBLIC_SITE_TITLE || "";
  const siteDesc = process.env.NEXT_PUBLIC_SITE_DESC || "";
  const logoPath = process.env.NEXT_PUBLIC_LOGO_PATH;
  const previewMode =
    process.env.NEXT_PUBLIC_IS_PREVIEW_MODE === "true" ? true : false;
  const comingSoonText =
    process.env.NEXT_PUBLIC_COMING_SOON_TEXT ||
    process.env.NEXT_PUBLIC_COMING_SOON_COPY ||
    "";
  const mailerUrl = process.env.NEXT_PUBLIC_MAILCHIMP_URL || "";
  const mailerId = process.env.NEXT_PUBLIC_MAILCHIMP_ID || "";
  const mailerUser = process.env.NEXT_PUBLIC_MAILCHIMP_U || "";
  const spreeApiUrl = process.env.NEXT_PUBLIC_SPREE_API_URL || "";

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

  const renderProductSlides = useCallback(() => {
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
      const imgSrc = productImg ? `${spreeApiUrl}${imgUrl}` : "";
      return allImages?.map((image: any, index: any) => {
        const imgSrc = image?.attributes?.styles[9]?.url || "";
        const imgUrl = `${spreeApiUrl}${imgSrc}`;
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

  const renderProductThumbnails = useCallback(
    (productsData: any, setIsSlideshow: any) => {
      return productsData?.data?.map((i: any) => {
        const productImg = i.relationships?.images?.data[0]?.id;
        const allImages = productsData
          ? productsData?.included?.filter((e: any) => e.type == "image")
          : [];
        const foundImg = allImages
          ? allImages.filter((e: any) => e["id"] == productImg)
          : undefined;
        console.log("foundImg: ", foundImg);
        const imgUrl =
          foundImg !== undefined ? foundImg[0]?.attributes?.styles[3]?.url : "";
        const imgSrc = productImg ? `${spreeApiUrl}${imgUrl}` || "" : "";
        return (
          <div
            key={`image-${i.id}`}
            onClick={() => setIsSlideshow(true)}
            style={{ cursor: "pointer" }}
          >
            <img src={imgSrc} />
          </div>
        );
      });
    },
    [productsData]
  );

  const { tintValue } = useSpring({
    delay: 3000,
    from: { tintValue: 0 },
    to: { tintValue: 1 },
    config: { tension: 80, friction: 60 }
  });

  useEffect(() => {
    if (productsSuccess) {
      queryClient.setQueryData(["products", 1], productsData);
    }
  }, [productsSuccess]);

  return (
    <>
      <Container
        style={{
          filter: tintValue.interpolate(
            (value) => `saturate(${value * 100}%) blur(${5 * (1 - value)}px)`
          )
        }}
      >
        {/* <Container tintValue={props.tintValue}> */}
        <Fade />
        <Device src="/images/beeper_one_masked.png" />
        {!isServer ? (
          <LogoBlob />
        ) : logoPath ? (
          <Logo src={logoPath} />
        ) : siteTitle ? (
          <LogoText>{siteTitle}</LogoText>
        ) : (
          <Logo />
        )}
        {siteDesc && <Text>{siteDesc}</Text>}
        {previewMode && (
          <ProductTeaser
            products={productsData}
            title={""}
            openSlideshow={(e: any) => setIsSlideshow(e)}
          />
        )}
        {previewMode && (
          <ResponsiveMasonry
            columnsCountBreakPoints={{ 350: 1, 750: 2, 900: 3 }}
          >
            <Masonry>
              {renderProductThumbnails(productsData, setIsSlideshow)}
            </Masonry>
          </ResponsiveMasonry>
        )}
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
                {renderProductSlides()}
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
        <Text>{comingSoonText}</Text>
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
