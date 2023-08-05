import React from "react";
import Link from "next/link";
import { useProducts } from "../../hooks/useProducts";
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
const MyH1 = styled.h1`
  font-size: 20px;
`;
const MySection = styled.section`
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
export const ProductList: React.FC<ProductListProps> = () => {
  const { data: products, isLoading, isSuccess } = useProducts(1);
  if (isLoading) return <div>Loading</div>;

  if (!isSuccess) {
    return <MyDiv>Could not load products</MyDiv>;
  }

  return (
    <MySection>
      <ProductsRow className="products-row">
        {products?.data?.map((product) => {
          const imageId =
            Array.isArray(product.relationships.images.data) &&
            product.relationships.images.data[0]?.id;
          const imageSource = products?.included?.find((image) => image.id === imageId)?.attributes
            .styles[2].url;
          const source = imageSource
            ? `https://pol-admin-staging.instinct.is/${imageSource}`
            : "https://via.placeholder.com/150";
          return (
            <Link
              key={product.id}
              href={{
                pathname: `[slug]`,
                query: {
                  slug: product.attributes.slug,
                  id: product.id
                }
              }}>
              <ProductContainer>
                <MyImg src={source} />
                <MyH1>{product.attributes.name}</MyH1>
                <MyDiv>
                  <h3>${product.attributes.price}</h3>
                </MyDiv>
              </ProductContainer>
            </Link>
          );
        })}
      </ProductsRow>
    </MySection>
  );
};
