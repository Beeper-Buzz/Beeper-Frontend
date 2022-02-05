import styled from "@emotion/styled";
import { ButtonBack, ButtonNext } from "pure-react-carousel";

export const NotFoundContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: space-around;
  min-height: 80vh;
  font-family: ${(p) => p.theme.typography.titleSM.fontFamily};
`;

export const NotFoundTitle = styled.h1`
  width: 100%;

  text-align: center;
`;

export const NotFoundSubtitle = styled.h2`
  width: 100%;
  text-align: center;
`;

export const ProductContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin: 0 auto;
  padding: 30px 0 30px;
  width: 100%;
  font-family: ${(p) => p.theme.typography.titleSM.fontFamily};
`;

export const ProductImageCarousel = styled.div`
  width: 40%;
  height: auto;
  @media screen and (max-width: 800px) {
    width: 100%;
  }
`;

export const CarouselNav = styled.div`
  width: 100%;
  position: absolute;
  left: 0;
  top: 50%;
  display: flex;
  justify-content: space-between;
`;

export const CarouselBackButton = styled(ButtonBack)`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  margin-left: 10px;
  opacity: 0.11;
  &:hover {
    opacity: 1;
  }
`;

export const CarouselNextButton = styled(ButtonNext)`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  margin-right: 10px;
  opacity: 0.11;
  &:hover {
    opacity: 1;
  }
`;

export const ProductInfoBox = styled.div`
  margin: 2%;
`;

export const ProductDescription = styled.div`
  text-align: center;
  max-width: 400px;
`;

export const Detail = styled.h3`
  font-family: ${(p) => p.theme.typography.titleSM.fontFamily};
  @media screen and (max-width: 800px) {
    font-size: 16px;
    text-align: center;
  }
`;

export const Price = styled.h1``;

export const SizesTitle = styled.p`
  text-align: left;
`;

export const SizesPerPack = styled.div`
  display: grid;
  grid-template-columns: 20% 20% 20% 20% 20%;
`;

export const Size = styled.div`
  display: grid;
  grid-template-columns: 50% 50%;
  align-items: center;
  border: 1px solid ${(p) => p.theme.colors.black.light};
  margin: 0 10px 0 0;
  &:last-child {
    margin: 0;
  }
`;

export const SizeQty = styled.div`
  padding: 3px 0 0 0;
  border-right: 1px solid ${(p) => p.theme.colors.black.light};
`;

export const SizeTitle = styled.div`
  padding: 3px 0 0 0;
  background: ${(p) => p.theme.colors.gray.background};
  text-transform: uppercase;
`;

// export const ColorsTable = styled.table``;

// export const ColorsHead = styled.thead``;

// export const ColorsTH = styled.th``;

// export const ColorsBody = styled.tbody``;

// export const ColorsRow = styled.tr``;

// export const ColorsCell = styled.td``;

export const ColorsTable = styled.div`
  margin: 40px 0 40px 0;
`;

export const ColorsHead = styled.div``;

export const ColorsTH = styled.div`
  display: grid;
  grid-template-columns: 40% 20% 20% 20%;
  background: ${(p) => p.theme.colors.brand.primary};
  color: ${(p) => p.theme.colors.white.primary};
`;

export const ColorsBody = styled.div`
  border-left: 1px solid ${(p) => p.theme.colors.black.light};
  border-right: 1px solid ${(p) => p.theme.colors.black.light};
  border-bottom: 1px solid ${(p) => p.theme.colors.black.light};
`;

export const ColorsRow = styled.div`
  display: grid;
  grid-template-columns: 37.5% 5% 5% 5% 20% 25%;
`;

export const ColorsCell = styled.div`
  padding: 4px 6px;
  & input {
    width: 100%;
    border: 0;
    background: transparent;
    &:focus {
      outline: none;
    }
    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }
  & input[type="number"] {
    -moz-appearance: textfield;
  }
`;

export const BuyButton = styled.button`
  font-family: ${(p) => p.theme.typography.titleSM.fontFamily};
`;
