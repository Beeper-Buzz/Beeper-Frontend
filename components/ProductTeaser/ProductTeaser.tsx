import React from "react";
// import Link from "next/link";
import { useRouter } from "next/router";
// import { useProducts } from "../../hooks/useProducts";
import { ProductListProps } from "./types";
import styled from "@emotion/styled";

const ProductsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
`;
const ProductContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;
const MyImg = styled.img`
  height: 300px;
  width: 240px;
  object-fit: contain;
`;
const MyH1 = styled.p`
  font-size: 20px;
  font-family: ${(p: any) => p.theme.typography.bodyXS.fontFamily};
  font-weight: ${(p: any) => p.theme.typography.bodyXS.fontWeight};
  font-size: ${(p: any) => p.theme.typography.bodyXS.fontSize};
  line-height: ${(p: any) => p.theme.typography.bodyXS.lineHeight};
  color: ${(p: any) =>
    p.theme.isDarkMode
      ? p.theme.colors.white.primary
      : p.theme.colors.black.primary};
`;
const MySection = styled.section`
  width: 100%;
  padding-bottom: 20px;
`;
const MyLi = styled.li`
  display: block;
  margin-bottom: 10px;
`;
const MyDiv = styled.div`
  align-items: center;
  display: flex;
`;
export const ProductTeaser: React.FC<ProductListProps> = (props: any) => {
  const router = useRouter();
  const { products, title } = props;
  // const { data: products, isLoading, isSuccess } = useProducts(1);
  // if (isLoading) return <MyDiv>Loading</MyDiv>;

  // if (!isSuccess) {
  //   return <MyDiv>Could not load products</MyDiv>;
  // }

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
                <MyImg src={imgSrc} />
                <MyH1>{product.attributes.name}</MyH1>
              </ProductContainer>
            </div>
          );
        })}
      </ProductsRow>
    </MySection>
  );
};
