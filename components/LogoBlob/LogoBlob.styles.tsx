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
  border-radius: 50%;
  animation: blob-breathe 4000ms ease-in-out infinite;
  box-shadow:
    0 0 70px rgba(124, 58, 237, 0.3),
    0 0 60px rgba(124, 58, 237, 0.35),
    0 0 50px rgba(124, 58, 237, 0.4),
    0 0 45px rgba(124, 58, 237, 0.45),
    0 0 40px rgba(124, 58, 237, 0.5),
    0 0 35px rgba(124, 58, 237, 0.55),
    0 0 30px rgba(124, 58, 237, 0.6),
    0 0 25px rgba(255, 0, 138, 0.4),
    0 0 20px rgba(255, 0, 138, 0.5),
    0 0 15px rgba(255, 0, 138, 0.6);

  @keyframes blob-breathe {
    0%, 100% {
      transform: scale(0.95);
      opacity: 0.7;
    }
    50% {
      transform: scale(1.05);
      opacity: 1.0;
    }
  }

  @media screen and (max-width: ${(p) => p.theme.breakpoints.values.sm}px) {
    margin-top: -100px;
  }
`;

export const AnimatedLogoWrapper = styled.div`
  width: auto;
  height: 160px;
  margin-top: -40px;
  position: relative;

  svg {
    width: auto;
    height: 160px;
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
