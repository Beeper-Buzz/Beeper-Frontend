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
