import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { QueryClient } from "react-query";
import { dehydrate } from "react-query/hydration";
import { ArrowBack, ArrowForward } from "@material-ui/icons";
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
import Featured from "../Home/Featured";
import PolProductList from "../PolProductList";
import { FourOhFour } from "../404/FourOhFour";
import { useMediaQuery } from "react-responsive";
import homeData from "../Home/home.json";
import { CarouselProvider, Slider } from "pure-react-carousel";
import "pure-react-carousel/dist/react-carousel.es.css";
// import ProductCard from "../components";

import {
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
  BuyButton,
  PropertyName
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
  } = useProduct(`${productSlug.toLowerCase().replace("/", "")}`);
  const productImgs =
    thisProduct && thisProduct?.included?.filter((e: any) => e["type"] === "image");
  const productColorOptions =
    thisProduct && thisProduct?.included?.filter((e: any) => e["type"] === "option_value");
  const productVariantColors =
    productColorOptions &&
    productColorOptions?.filter((e: any) => e.attributes.presentation.includes("#"));
  const productProperties =
    thisProduct && thisProduct?.included?.filter((e: any) => e["type"] === "product_property");
  const thisProductId = thisProduct?.data?.id || "";
  const queryClient = useQueryClient();
  const [colorOptions, setColorOptions] = useState<any>(productVariantColors);
  const [addItem, setAddItem] = useState<any>({
    variant_id: "236",
    quantity: 3
    // public_metadata: {
    //   first_item_order: true
    // },
    // private_metadata: {
    //   recommended_by_us: false
    // }
    // options?: {
    //     [key: string]: string;
    // };
  });
  // console.log("colors: ", productVariantColors);

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
    <PolProductList products={productsData} title={"Similar Products"} />
  );
  const recommendedProducts = isMobile ? null : (
    <PolProductList products={productsData} title={"Recommended for You"} />
  );
  // const latestProducts = isMobile ? null : (
  //   <Featured data={homeData.latestProducts} title="" />
  // );
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

  const updatePackSelections = (e: any) => {
    const newValue = e.target.value;
    setColorOptions((prevState: any) => {
      return {
        ...prevState,
        propA: newValue
      };
    });
  };

  const renderColorOptions = useCallback(() => {
    let variants: any = [];
    // const foundVariants = thisProduct?.included?.some((elem) => {
    //   if (elem.type == "option_values") {
    //     variants.push(elem);
    //   }
    // });
    const foundVariants = thisProduct?.included?.filter((elem) => elem.type === "variant");
    console.log("PRODUCT: ", thisProduct, "VARIANTS: ", foundVariants);

    if (productVariantColors && productVariantColors.length) {
      return productVariantColors?.map((item, index) => {
        // const optionText = item.attributes.options_text;
        // console.log("row: ", item);
        return (
          <ColorsRow key={`${index}-row`}>
            {/* <ColorsCell>{item.attributes.options_text}</ColorsCell> */}
            <ColorsCell>
              <Variant color={item.attributes.presentation} />
            </ColorsCell>
            <ColorsCell>-</ColorsCell>
            <ColorsCell>
              <input
                // value={colorOptions[index]}
                value={0}
                type="number"
                min="0"
                max="99"
                onChange={(e: any) => updatePackSelections(e)}
              />
            </ColorsCell>
            <ColorsCell>+</ColorsCell>
            <ColorsCell>24</ColorsCell>
            <ColorsCell>${item.attributes.price}</ColorsCell>
          </ColorsRow>
        );
      });
    }
  }, [productVariantColors]);

  const renderProductImgs = useCallback(() => {
    const productImgs =
      thisProduct && thisProduct?.included?.filter((e: any) => e["type"] === "image");
    const primaryImg = productImgs && productImgs[0].attributes.styles[9].url;
    // console.log("rendered imgs: ", productImgs);
    if (productImgs && productImgs.length < 1) {
      return <Loading />;
    }
    if (productImgs && productImgs.length == 1) {
      return (
        <StyledSlide index={0}>
          <StyledImageWithZoom src={primaryImg} />
        </StyledSlide>
      );
    }
    return (
      productImgs &&
      productImgs.map((image, index) => {
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
    return (
      <VariantList>
        {productVariantColors?.map((option: any, index: any) => {
          const optionColor = option.attributes.presentation;
          // console.log("Option: ", optionColor);
          return <Variant key={`variant-${index}`} color={optionColor} />;
        })}
      </VariantList>
    );
  }, [productVariantColors]);

  const renderProperties = useCallback(() => {
    return (
      <>
        {productProperties?.map((property: any, index: any) => {
          return (
            <div key={`property-${index}`}>
              <PropertyName>{property.attributes.name}</PropertyName>: {property.attributes.value}
            </div>
          );
        })}
      </>
    );
  }, [productProperties]);

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
    return <FourOhFour />;
  }

  if (isSuccess) {
    // const variants = thisProduct?.data.relationships.variants.data;
    // {
    //   variant_id: Array.isArray(variants) ? variants[0].id : "",
    //   quantity: 1
    // }

    const handleAddToCart = (i: any) => addToCart.mutate(i);

    return (
      <Layout>
        <Head>
          <title>
            {thisProduct?.data.attributes.name} - {process.env.SITE_TITLE}
          </title>
        </Head>
        <ProductContainer className="product-container">
          <ProductImageCarousel>
            <CarouselProvider
              naturalSlideWidth={600}
              naturalSlideHeight={600}
              totalSlides={productImgs ? productImgs.length : 1}
              // totalSlides={3}
              isIntrinsicHeight
              touchEnabled
              infinite={productImgs ? true : false}
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
              {renderVariants()}
              <p>{thisProduct?.data?.attributes?.description}</p>
              <hr />
              {wholesale && <p>Price Per Pack</p>}
              <Price>${thisProduct?.data?.attributes?.price}</Price>

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

              <BuyButton className="" onClick={() => handleAddToCart(addItem)}>
                add to cart
              </BuyButton>
              <div style={{ textAlign: "left" }}>
                <Detail>Model Info</Detail>
                {renderProperties()}
              </div>
            </ProductDescription>
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
