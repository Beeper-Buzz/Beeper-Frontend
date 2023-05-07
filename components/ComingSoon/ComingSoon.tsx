import React, { useState, useEffect } from "react";
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
  const [slideshowImgs, setSlideshowImgs] = useState<any>([]);

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

  const productImgs = () => {
    if (productsSuccess) {
      productsData.map((i: any) => {
        const productImg = i.relationships.images.data[0];
        console.log("IMGS: ", productImg);
        setSlideshowImgs([...slideshowImgs, productImg]);
        return null;
      });
    }
  };

  const renderProductImages = () => {
    slideshowImgs &&
      slideshowImgs.map((image: any, index: any) => {
        const imgUrl = image.attributes.styles[9].url;
        const imgSrc = `${process.env.SPREE_API_URL}${imgUrl}`;
        return (
          <StyledSlide key={`image-${index}`} index={index}>
            <StyledImageWithZoom src={imgSrc} />
          </StyledSlide>
        );
      });
  };

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
              totalSlides={slideshowImgs ? slideshowImgs.length : 1}
              // totalSlides={3}
              isIntrinsicHeight
              touchEnabled
              infinite={slideshowImgs ? true : false}
            >
              <StyledSlider className="slider">
                (renderProductImages())
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
