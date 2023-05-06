import styled from "@emotion/styled";

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  justify-content: center;
  align-items: center;
  width: auto;
  min-height: 100vh;
  background-color: ${(p) =>
    p.theme.isDarkMode
      ? p.theme.colors.black.primary
      : p.theme.colors.white.primary};
`;

export const Logo = styled.img`
  width: auto;
  height: 240px;

  @media screen and (max-width: ${(p) => p.theme.breakpoints.values.sm}px) {
    width: 90%;
    height: auto;
  }
`;

export const LogoText = styled.div`
  font-family: ${(p: any) => p.theme.typography.titleLG.fontFamily};
  font-weight: ${(p: any) => p.theme.typography.titleLG.fontWeight};
  font-size: ${(p: any) => p.theme.typography.titleLG.fontSize};
  line-height: ${(p: any) => p.theme.typography.titleLG.lineHeight};
  color: ${(p: any) =>
    p.theme.isDarkMode
      ? p.theme.colors.white.primary
      : p.theme.colors.black.primary};
  margin: 40px 0 20px 0;
`;

export const ProductImageCarousel = styled.div`
  width: 60%;
  height: auto;
  @media screen and (max-width: 800px) {
    width: 100%;
  }
`;

export const Text = styled.div`
  text-align: center;
  width: 425px;
  top: 400px;
  font-family: ${(p: any) => p.theme.typography.titleMD.fontFamily};
  font-weight: ${(p: any) => p.theme.typography.titleMD.fontWeight};
  font-size: ${(p: any) => p.theme.typography.titleMD.fontSize};
  line-height: ${(p: any) => p.theme.typography.titleMD.lineHeight};
  color: ${(p: any) =>
    p.theme.isDarkMode
      ? p.theme.colors.white.primary
      : p.theme.colors.black.primary};
`;
