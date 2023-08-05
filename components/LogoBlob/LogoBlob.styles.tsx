import styled from "@emotion/styled";

export const LogoMark = styled.img`
  width: auto;
  height: 160px;
  margin-top: -40px;
  position: relative;
  @media screen and (max-width: ${(p) => p.theme.breakpoints.values.sm}px) {
    width: 90%;
    height: auto;
  }
`;

export const BlobWrapper = styled.div`
  position: absolute;
  margin-top: -200px;

  @media screen and (max-width: ${(p) => p.theme.breakpoints.values.sm}px) {
    margin-top: -100px;
  }
`;
