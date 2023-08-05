<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
export { ProductList } from "./ProductList";
=======
import React from "react";
import Link from "next/link";
import { useProducts } from "../../hooks/useProducts";
=======
import React from 'react';
import { useProducts } from '../../hooks/useProducts';
>>>>>>> 2b6f558 (Add prettier and eslint configs)
=======
import React from "react";
import { useProducts } from "../../hooks/useProducts";
<<<<<<< HEAD
>>>>>>> 83b1bed (Change to double quotes to minimze merge conflicts)
=======
import { ProductListProps } from "./types";
>>>>>>> 368708c (update)

export const ProductList: React.FC<ProductListProps> = () => {
  const { data, isLoading, isSuccess } = useProducts(1);
  if (isLoading) return <div>Loading</div>;

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 56bb716 (Run formatter on remaining files)
=======
  if (!isSuccess) {
    return <div>Could not load products</div>;
  }

>>>>>>> 9b95ae5 (Enable strict types to avoid implcit any types)
  return (
    <section>
      <div className="products-row">
<<<<<<< HEAD
        {data?.data?.map((product, index) => {
<<<<<<< HEAD
<<<<<<< HEAD
          const source = `https://qa.dna-admin.instinct.is/${
            data.included.find(
              (image) => image.id === product.relationships.images.data[0].id
            )?.attributes.styles[2].url
          }`;
=======
        {data?.data?.map((product) => {
          const imageId =
            Array.isArray(product.relationships.images.data) &&
            product.relationships.images.data[0]?.id;
          const imageSource = data?.included?.find((image) => image.id === imageId)?.attributes
            .styles[2].url;
          const source = imageSource
            ? `https://pol-admin-staging.instinct.is/${imageSource}`
            : "https://via.placeholder.com/150";
>>>>>>> 6452f9e (Fix login function, setup react-query-auth hooks for getting the user object, logging in, registering, and logging out.)
          return (
            <Link
              key={product.id}
              href={{
                pathname: `[slug]`,
                query: {
                  slug: product.attributes.slug,
                  id: product.id,
                },
              }}
            >
              <div className="product-container">
                <img src={source} />
                <h1>{product.attributes.name}</h1>
                <div>
                  <h3>${product.attributes.price}</h3>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <style jsx>{`
        .products-row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        }
        .product-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
=======
    return (
        <section>
            <div className="products-row">
                {data?.data?.map((product, index) => {
                    const source = `http://localhost:8080${
                        data.included.find(
                            (image) => image.id === product.relationships.images.data[0].id
                        ).attributes.styles[2].url
                    }`;
                    return (
                        <div key={product.id} className="product-container">
                            <img src={source} />
                            <h1>{product.attributes.name}</h1>
                            <div>
                                <h3>${product.attributes.price}</h3>
                            </div>
                        </div>
                    );
                })}
            </div>
            <style jsx>{`
                .products-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                }
                .product-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
>>>>>>> 2b6f558 (Add prettier and eslint configs)
=======
          const source = `http://localhost:8080${
            data.included.find((image) => image.id === product.relationships.images.data[0].id)
              .attributes.styles[2].url
          }`;
=======
          const imageId =
            Array.isArray(product.relationships.images.data) &&
            product.relationships.images.data[0].id;
          const imageSource = data?.included?.find((image) => image.id === imageId)?.attributes
            .styles[2].url;
          const source = `http://localhost:8080${imageSource}`;
>>>>>>> 9b95ae5 (Enable strict types to avoid implcit any types)
          return (
            <div key={product.id} className="product-container">
              <img src={source} />
              <h1>{product.attributes.name}</h1>
              <div>
                <h3>${product.attributes.price}</h3>
              </div>
            </div>
          );
        })}
      </div>
      <style jsx>{`
        .products-row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        }
        .product-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
>>>>>>> 56bb716 (Run formatter on remaining files)

        img {
          height: 300px;
          width: 240px;
          object-fit: contain;
        }

        h1 {
          font-size: 20px;
        }

        section {
          padding-bottom: 20px;
        }
        li {
          display: block;
          margin-bottom: 10px;
        }
        div {
          align-items: center;
          display: flex;
        }
        a {
          font-size: 14px;
          margin-right: 10px;
          text-decoration: none;
          padding-bottom: 0;
          border: 0;
        }
        span {
          font-size: 14px;
          margin-right: 5px;
        }
        ul {
          margin: 0;
          padding: 0;
        }
        button:before {
          align-self: center;
          border-style: solid;
          border-width: 6px 4px 0 4px;
          border-color: #ffffff transparent transparent transparent;
          content: "";
          height: 0;
          margin-right: 5px;
          width: 0;
        }
      `}</style>
    </section>
  );
};
>>>>>>> 56c97cb (Fix type error and refreshing product details page)
=======
export { ProductList } from './ProductList'
>>>>>>> 7cc392d (reorganize files (prefer named files), rename MainMenu > MobileMenu, add MobileMenu & Footer to global Layout file, remove test route)
