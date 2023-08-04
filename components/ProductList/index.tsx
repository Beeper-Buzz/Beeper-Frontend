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

export const ProductList = () => {
    const { data, isLoading, isFetching } = useProducts(1);
    if (isLoading) return <div>Loading</div>;

<<<<<<< HEAD
  return (
    <section>
      <div className="products-row">
        {data?.data?.map((product, index) => {
          const source = `https://qa.dna-admin.instinct.is/${
            data.included.find(
              (image) => image.id === product.relationships.images.data[0].id
            )?.attributes.styles[2].url
          }`;
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
                    content: '';
                    height: 0;
                    margin-right: 5px;
                    width: 0;
                }
            `}</style>
        </section>
    );
};
>>>>>>> 56c97cb (Fix type error and refreshing product details page)
