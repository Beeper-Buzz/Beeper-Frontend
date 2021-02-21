import styled from '@emotion/styled';

export const Wrapper = styled.div`
  position: relative;
  width: 100%;
  height: 60vh;
  background-image: url("https://external-content.duckduckgo.com/iu/?u=http%3A%2F%2Fwallpaperheart.com%2Fwp-content%2Fuploads%2F2018%2F05%2Fvaporwave-wallpapers-2.jpg&f=1&nofb=1");
  background-size: cover;
  background-position: center center;
`;

export const LogoWrapper = styled.div`
  width: 30%;
`;

export const LogoBackground = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 300px;

  & svg {
    overflow: visible;
    transform: scale(0.2);
    transform-origin: top;
  }

  & svg g:first-child path {
    fill: #490F30;
  }

  & svg g:last-child path {
    fill: #fff;
    box-shadow:
      0 0 60px 30px #fff,  /* inner white */
      0 0 100px 60px #f0f, /* middle magenta */
      0 0 140px 90px #0ff; /* outer cyan */
  }
`;

export const LogoMark = styled.div`
`;