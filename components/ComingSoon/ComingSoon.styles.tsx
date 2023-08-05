import styled from "@emotion/styled";
import { animated } from "react-spring";
import { transparentize } from "polished";
import { ButtonBack, ButtonNext } from "pure-react-carousel";
import { Slider, Slide, ImageWithZoom } from "pure-react-carousel";

export const ProductImageCarousel = styled.div`
  position: fixed;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
`;

export const CarouselBackground = styled.div`
  position: fixed;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  background: ${(p: any) =>
    p.isDarkMode
      ? transparentize(0.95, p.theme.colors.black.primary)
      : transparentize(0.95, p.theme.colors.white.primary)};
`;

export const StyledSlider = styled(Slider)`
  height: 100vh;
  background: ${(p: any) =>
    p.isDarkMode
      ? transparentize(0.95, p.theme.colors.black.primary)
      : transparentize(0.95, p.theme.colors.white.primary)};
`;

export const StyledSlide = styled(Slide)`
  /* width: 60vw;
  height: 500px; */
  height: 100vh;
`;
export const StyledImageWithZoom = styled(ImageWithZoom)``;

export const CarouselNav = styled.div`
  width: 100%;
  position: fixed;
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

export const Container = styled(animated.div)<any>`
  display: flex;
  flex-direction: column;
  position: relative;
  justify-content: center;
  align-items: center;
  width: auto;
  height: 100vh;
  overflow: hidden;
  color: ${(p: any) => p.theme.colors.pink.primary};
  filter: sepia(${(p: any) => p.tintValue});
  -webkit-filter: sepia(${(p: any) => p.tintValue});
`;

export const Logo = styled.img`
  width: auto;
  height: 201px;

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

export const Text = styled.div`
  text-align: center;
  width: 425px;
  margin-top: -40px;
  text-transform: uppercase;
  opacity: 0.66;
  font-family: ${(p) => p.theme.typography.titleLG.fontFamily};
  font-size: ${(p) => p.theme.typography.titleLG.fontSize};
  font-weight: ${(p) => p.theme.typography.titleLG.fontWeight};
  line-height: ${(p) => p.theme.typography.titleLG.lineHeight};
  color: ${(p: any) =>
    p.theme.isDarkMode
      ? p.theme.colors.white.primary
      : p.theme.colors.black.primary};
`;

export const Fade = styled.div`
  width: 100%;
  height: 50%;
  position: absolute;
  bottom: 0;
  background: rgb(0, 0, 0);
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 1) 100%
  );
  @media screen and (max-width: ${(p) => p.theme.breakpoints.values.sm}px) {
    height: 300px;
  }
`;

export const Device = styled.img`
  opacity: 0.33;
  display: flex;
  justify-content: center;
  position: absolute;
  bottom: -40%;
  width: 150%;
  @media screen and (max-width: ${(p) => p.theme.breakpoints.values.sm}px) {
    bottom: -10px;
  }
`;
