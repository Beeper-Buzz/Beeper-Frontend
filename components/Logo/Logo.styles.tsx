import styled from "@emotion/styled";

export const LogoMark = styled.img`
  width: auto;
  height: 240px;
  margin-top: -100px;
  @media screen and (max-width: ${(p) => p.theme.breakpoints.values.sm}px) {
    width: 90%;
    height: auto;
  }
`;

export const AnimatedLogoWrapper = styled.div`
  width: auto;
  height: 240px;
  margin-top: -100px;

  svg {
    width: auto;
    height: 240px;
  }

  @media screen and (max-width: ${(p) => p.theme.breakpoints.values.sm}px) {
    width: 90%;
    height: auto;

    svg {
      width: 100%;
      height: auto;
    }
  }
`;
