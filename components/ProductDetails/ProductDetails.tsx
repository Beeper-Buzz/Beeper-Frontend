import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Head from 'next/head';
import { QueryClient } from "react-query";
import { dehydrate } from "react-query/hydration";
import { ArrowBack, ArrowForward } from "@material-ui/icons";
import Lottie from "react-lottie";
import girlAnimation from "../../data/girl.json";
import {
  fetchStreams,
  fetchProducts,
  fetchVariants,
  useProducts,
  useStreams,
  useVariants
} from "../../hooks";
import { Layout, LoadingWrapper, Loading } from "../components";
import { useProduct, fetchProduct } from "../../hooks/useProduct";
import { useMutation, useQueryClient } from "react-query";
import { addItemToCart } from "../../hooks/useCart";
import { QueryKeys } from "../../hooks/queryKeys";
import * as tracking from "../../config/tracking";
import LatestProducts from "../Home/LatestProducts";
import PolProductList from "../PolProductList";
import { useMediaQuery } from "react-responsive";
import homeData from "../Home/home.json";
import { CarouselProvider, Slider } from "pure-react-carousel";
import "pure-react-carousel/dist/react-carousel.es.css";
// import ProductCard from "../components";

import {
  NotFoundContainer,
  NotFoundTitle,
  NotFoundSubtitle,
  ProductContainer,
  ProductImageCarousel,
  ProductInfoBox,
  ProductDescription,
  StyledSlider,
  StyledSlide,
  StyledImageWithZoom,
  CarouselNav,
  CarouselBackButton,
  CarouselNextButton,
  Detail,
  Price,
  VariantList,
  Variant,
  SizesTitle,
  SizesPerPack,
  Size,
  SizeQty,
  SizeTitle,
  ColorsTable,
  ColorsHead,
  ColorsTH,
  ColorsBody,
  ColorsRow,
  ColorsCell,
  BuyButton
} from "./ProductDetails.styles";

const settings = {
  speed: 500,
  dots: false,
  Infinite: false
};

interface ColorOptionType {
  name: string;
  quantity: number;
}

const productColors: ColorOptionType[] = [
  {
    name: "Yellow Rod",
    quantity: 2
  },
  {
    name: "Carnelian",
    quantity: 2
  }
];

export const ProductDetails = ({ wholesale }: any) => {
  const router = useRouter();
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const { asPath: productSlug } = router;
  // console.log(productSlug);
  const {
    data: thisProduct,
    isLoading,
    isSuccess,
    isError,
    error: productError
  } = useProduct(`${productSlug.replace("/", "")}`);
  const foundImgs = thisProduct && thisProduct?.included?.filter((e: any) => e["type"] === "image");
  const thisProductId = thisProduct?.data?.id || "";
  const queryClient = useQueryClient();
  const [colorOptions, setColorOptions] = useState<any>(productColors);

  const animationOptions = {
    loop: true,
    autoplay: true,
    animationData: girlAnimation,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice"
    }
  };

  const {
    error: productsError,
    status: productsStatus,
    data: productsData,
    isLoading: productsAreLoading,
    isSuccess: productsAreSuccess
  }: { error: any; status: any; data: any; isLoading: boolean; isSuccess: boolean } = useProducts(
    1
  );
  const randomNextProductId = productsAreSuccess
    ? productsData.data[Math.floor(Math.random() * productsData.data?.length)].id
    : 1;

  const {
    error: variantsError,
    status: variantsStatus,
    data: variantsData,
    isLoading: variantsAreLoading,
    isSuccess: variantsAreSuccess
  } = useVariants(1, thisProductId);

  const similarProducts = isMobile ? null : (
    <PolProductList data={productsData} title={"Similar Products"} />
  );
  const recommendedProducts = isMobile ? null : (
    <PolProductList data={productsData} title={"Recommended for You"} />
  );
  const latestProducts = isMobile ? null : (
    <LatestProducts data={homeData.latestProducts} title="" />
  );
  const addToCart = useMutation(addItemToCart, {
    onSuccess: () => {
      queryClient.invalidateQueries(QueryKeys.CART);
    }
  });

  const setColorQtys = (arr: any) => {
    return arr.map(({ item, index }: any) => {
      return setColorOptions([...colorOptions]);
    });
  };

  const handleKeyPress = (event: KeyboardEvent) => {
    const thisProductId = thisProduct?.data?.id;
    // console.log(thisProductId);
    const productId: number = parseInt(`${thisProductId}`);
    const { key } = event;

    switch (key) {
      case "ArrowLeft":
        const prevProductId = productId - 1;

        fetchProduct(`${prevProductId}`)
          .then((nextProduct) => {
            router.push(`/${nextProduct?.data?.attributes?.slug}`);
          })
          .catch(() => {
            /* product not found */
            fetchProduct(randomNextProductId).then((nextProduct) => {
              router.push(`/${nextProduct?.data?.attributes?.slug}`);
            });
          });
        break;
      case "ArrowRight":
        const nextProductId = productId + 1;

        fetchProduct(`${nextProductId}`)
          .then((nextProduct) => {
            router.push(`/${nextProduct?.data?.attributes?.slug}`);
          })
          .catch(() => {
            /* product not found */
            fetchProduct(randomNextProductId).then((nextProduct) => {
              router.push(`/${nextProduct?.data?.attributes?.slug}`);
            });
          });
        break;
      default:
        break;
    }
  };

  const renderColorOptions = useCallback(() => {
    let variants: any = [];
    // const foundVariants = thisProduct?.included?.some((elem) => {
    //   if (elem.type == "option_values") {
    //     variants.push(elem);
    //   }
    // });
    const foundVariants = thisProduct?.included?.filter((elem) => elem.type === "variant");
    // console.log("PRODUCT: ", thisProduct, "VARIANTS: ", foundVariants);

    if (foundVariants && foundVariants.length) {
      return foundVariants?.map((item, index) => {
        const optionText = item.attributes.options_text;
        // console.log("row: ", item);
        return (
          <ColorsRow key={`${index}-row`}>
            <ColorsCell>{item.attributes.options_text}</ColorsCell>
            <ColorsCell>-</ColorsCell>
            <ColorsCell>
              <input
                value={colorOptions[index]}
                type="number"
                min="1"
                max="99"
                onChange={(e: any) => setColorOptions([...colorOptions])}
              />
            </ColorsCell>
            <ColorsCell>+</ColorsCell>
            <ColorsCell>24</ColorsCell>
            <ColorsCell>${item.attributes.price}</ColorsCell>
          </ColorsRow>
        );
      });
    }
  }, [colorOptions, thisProduct]);

  const renderProductImgs = useCallback(() => {
    const foundImgs =
      thisProduct && thisProduct?.included?.filter((e: any) => e["type"] === "image");
    const primaryImg = foundImgs && foundImgs[0].attributes.styles[9].url;
    // console.log("rendered imgs: ", foundImgs);
    if (foundImgs && foundImgs.length < 1) {
      return <Loading />;
    }
    if (foundImgs && foundImgs.length == 1) { 
      return (
        <StyledSlide index={0}>
          <StyledImageWithZoom src={primaryImg} />
        </StyledSlide>
      )
    }
    return (
      foundImgs &&
      foundImgs.map((image, index) => {
        // const img600 = image.attributes.styles.filter((e: any) => e['width'] == '600').url;
        const imgUrl = image.attributes.styles[9].url;
        const imgSrc = `${process.env.SPREE_API_URL}${imgUrl}`;
        // console.log(imgSrc);
        return (
          <StyledSlide key={`image-${index}`} index={index}>
            <StyledImageWithZoom src={imgSrc} />
          </StyledSlide>
        );
      })
    );
  }, [thisProduct]);

  const renderVariants = useCallback(() => {
    const foundOptions = thisProduct && thisProduct?.included?.filter((e: any) => e["type"] === "option_value");
    const foundColors = foundOptions && foundOptions?.filter((e: any) => e.attributes.presentation.includes("#"));
    return (
      <VariantList>
        {foundColors?.map((option, index) => {
          const optionColor = option.attributes.presentation;
          console.log("Option: ", optionColor);
          return <Variant color={optionColor} />;
        })}
      </VariantList>
    );
  }, []);

  useEffect(() => {
    if (isSuccess) {
      // // On page load, set focus on the product contaniner, because otherwise the arrow keys (left/right) won't work
      // const productContainer = Array.from(
      //   document.getElementsByClassName("product-container")
      // ).shift();

      // if (productContainer) {
      //   (productContainer as HTMLElement).focus();
      // }
      tracking.trackEvent({
        action: tracking.Action.VIEW_PRODUCT,
        category: tracking.Category.PRODUCT_DETAIL,
        label: thisProduct?.data?.attributes?.name
      });
    }
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [isSuccess, handleKeyPress]);

  if (isLoading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout>
        <NotFoundContainer>
          <Lottie
            options={animationOptions}
            width={300}
            height={300}
            style={{ pointerEvents: "none" }}
          />
          <NotFoundTitle>404</NotFoundTitle>
          <NotFoundSubtitle>Whoops, keep looking...</NotFoundSubtitle>
        </NotFoundContainer>
      </Layout>
    );
  }

  if (isSuccess) {
    // const variants = thisProduct?.data.relationships.variants.data;

    // const handleAddToCart = () =>
    //   addToCart.mutate({
    //     variant_id: Array.isArray(variants) ? variants[0].id : "",
    //     quantity: 1
    //   });

    const imageSource =
      Array.isArray(thisProduct?.included) && thisProduct?.included[0]?.attributes?.styles?.[2].url;
    const source = imageSource
      ? `http://localhost:8080${imageSource}`
      : "https://via.placeholder.com/400x600";
    // const source = "https://via.placeholder.com/400x600";

    // const productImgs = thisProduct.relationships?.images?.data[0]?.id;
    // const foundImgs = thisProduct && thisProduct?.included.filter((e: any) => e["type"] === "image");
    // const imgUrl = foundImg[0]?.attributes?.styles[4].url;
    // const imgSrc = productImg ? `${process.env.SPREE_API_URL}${imgUrl}` : defaultImg;

    // console.log("foundImgs: ", foundImgs);

    return (
      <Layout>
        <Head>
          <title>{thisProduct?.data.attributes.name} - {process.env.SITE_TITLE}</title>
        </Head>
        <ProductContainer className="product-container">
          <ProductImageCarousel>
            <CarouselProvider
              naturalSlideWidth={600}
              naturalSlideHeight={600}
              totalSlides={foundImgs ? foundImgs.length : 1}
              // totalSlides={3}
              isIntrinsicHeight
              touchEnabled
              infinite={foundImgs ? true : false}
            >
              <StyledSlider className="slider">
                {/* <Slide index={1} style={{ height: "500px" }}>
                  <ImageWithZoom src={source} />
                </Slide>
                <Slide index={2} style={{ height: "500px" }}>
                  <ImageWithZoom src={source} />
                </Slide> */}
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

          <ProductInfoBox>
            <ProductDescription>
              <h2>{thisProduct?.data?.attributes?.name}</h2>
              <p>{thisProduct?.data?.attributes?.description}</p>
              <hr />
              {wholesale && <p>Price Per Pack</p>}
              <Price>${thisProduct?.data?.attributes?.price}</Price>

              {renderVariants()}
              
              {wholesale && (
                <>
                  <SizesTitle>Sizes Per Pack</SizesTitle>
                  <SizesPerPack>
                    <Size>
                      <SizeQty>2</SizeQty>
                      <SizeTitle>xs</SizeTitle>
                    </Size>
                    <Size>
                      <SizeQty>2</SizeQty>
                      <SizeTitle>sm</SizeTitle>
                    </Size>
                    <Size>
                      <SizeQty>2</SizeQty>
                      <SizeTitle>md</SizeTitle>
                    </Size>
                    <Size>
                      <SizeQty>2</SizeQty>
                      <SizeTitle>lg</SizeTitle>
                    </Size>
                    <Size>
                      <SizeQty>2</SizeQty>
                      <SizeTitle>xl</SizeTitle>
                    </Size>
                  </SizesPerPack>
                </>
              )}

              {wholesale && (
                <ColorsTable>
                  <ColorsHead>
                    <ColorsTH>
                      <ColorsCell>Colors</ColorsCell>
                      <ColorsCell>Pack Qty</ColorsCell>
                      <ColorsCell>Pieces Qty</ColorsCell>
                      <ColorsCell>Pack Price</ColorsCell>
                    </ColorsTH>
                  </ColorsHead>
                  <ColorsBody>{renderColorOptions()}</ColorsBody>
                </ColorsTable>
              )}

              {/* RETAIL COLOR */}
              {!wholesale && (
                <select>
                  <option selected>Color</option>
                  <option>Blue</option>
                  <option>Beige</option>
                  <option>Pink</option>
                </select>
              )}

              {/* RETAIL SIZE */}
              {!wholesale && (
                <div className="size-selection">
                  <button className="">XS</button>
                  <button className="">S</button>
                  <button className="">M</button>
                  <button className="">L</button>
                  <button className="">XL</button>
                </div>
              )}

              <BuyButton className="">add to cart</BuyButton>
            </ProductDescription>

            <div>
              <Detail>Product Details</Detail>
              <p>FABRIC : 100% POLYESTER BUST : 29”LENGTH : 25 1/2”</p>
              <Detail>Model Info</Detail>
              <p>
                Model info goes here:
                <br />
                Height: 5'8''
                <br />
                Bust: 32
                <br />
                Waist: 24''
                <br />
                Hip: 34"
                <br />
                Wearing Size: XS
              </p>
            </div>
          </ProductInfoBox>
          {similarProducts ? similarProducts : <></>}
          {recommendedProducts ? recommendedProducts : <></>}
        </ProductContainer>
      </Layout>
    );
  }
};

export async function getServerSideProps() {
  const queryClient = new QueryClient();

  // await queryClient.prefetchQuery(["posts", 1], () => fetchPosts(1));
  await queryClient.prefetchQuery(["streams", 1], () => fetchStreams(1));
  await queryClient.prefetchQuery(["products", 1], () => fetchProducts(1));

  return {
    props: {
      dehydratedState: dehydrate(queryClient)
    }
  };
}
