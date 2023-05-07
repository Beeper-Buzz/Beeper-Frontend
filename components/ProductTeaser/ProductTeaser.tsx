import React, { useEffect } from "react";
// import Link from "next/link";
import { useRouter } from "next/router";
// import { useProducts } from "../../hooks/useProducts";
import { ProductListProps } from "./types";
import styled from "@emotion/styled";

import {
  ProductsRow,
  ProductContainer,
  MyImg,
  MyH1,
  MySection,
  MyLi,
  MyDiv
} from "./productteaser-styles";

export const ProductTeaser: React.FC<ProductListProps> = (props: any) => {
  const router = useRouter();
  const { products, title } = props;
  // const { data: products, isLoading, isSuccess } = useProducts(1);
  // if (isLoading) return <MyDiv>Loading</MyDiv>;

  // if (!isSuccess) {
  //   return <MyDiv>Could not load products</MyDiv>;
  // }

  useEffect(() => {
    // console.log('PRODS: ', products)
  }, []);

  if (!products) return <MyDiv>Loading</MyDiv>;

  return (
    <MySection>
      <MyH1>{title}</MyH1>
      <ProductsRow>
        {products?.data?.map((product: any) => {
          const defaultImg =
            "https://static-assets.strikinglycdn.com/images/ecommerce/ecommerce-default-image.png";
          const productImg = product.relationships?.images?.data[0]?.id;
          const allImages = products
            ? products?.included?.filter((e: any) => e.type == "image")
            : [];
          const foundImg = allImages
            ? allImages.filter((e: any) => e["id"] == productImg)
            : undefined;
          const imgUrl =
            foundImg !== undefined
              ? foundImg[0]?.attributes?.styles[4]?.url
              : "";
          const imgSrc = productImg
            ? `${process.env.SPREE_API_URL}${imgUrl}`
            : defaultImg;
          return (
            <div
              key={product.id}
              onClick={() => router.push(`/${product.attributes.slug}`)}
              // href={{
              //   pathname: `[slug]`,
              //   query: {
              //     slug: product.attributes.slug
              //   }
              // }}
            >
              <ProductContainer>
                <MyImg src={imgSrc} onClick={props.openSlideshow(true)} />
                <MyH1>{product.attributes.name}</MyH1>
              </ProductContainer>
            </div>
          );
        })}
      </ProductsRow>
    </MySection>
  );
};
