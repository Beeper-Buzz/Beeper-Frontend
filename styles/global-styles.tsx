// disable eslint rule for parentheses around functions
// eslint-disable-next-line func-names
import React from "react";
import { Global, css, SerializedStyles } from "@emotion/react";
import { saturate } from "polished";

export const GlobalStyles = ({ theme, children }: any) => (
  <Global
    styles={
      css(`
        @import url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css");

        html {
          overflow: hidden;
          width: 100%;
          height: 100%;
        }

        body {
          font-family: "ibm condensed medium";
          font-size: 14px;
          line-height: 16px;
          background: black;
          background-image: #00000;
          background-image: radial-gradient(at 94% 36%, hsla(273, 81%, 20%, 1) 0, transparent 100%),
            radial-gradient(at 19% 93%, hsla(299, 100%, 30%, 1) 0, transparent 32%),
            radial-gradient(at 50% 11%, hsla(0, 0%, 0%, 1) 0, transparent 100%),
            radial-gradient(at 36% 94%, hsla(264, 75%, 65%, 1) 0, transparent 100%),
            radial-gradient(at 32% 19%, hsla(261, 78%, 27%, 1) 0, transparent 100%),
            radial-gradient(at 18% 79%, hsla(242, 100%, 50%, 1) 0, transparent 100%),
            radial-gradient(at 83% 53%, hsla(124, 85%, 70%, 1) 0, transparent 59%);
          background-size: 100vw 100vh;
          background-repeat: no-repeat;
          background-position: center;
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          text-rendering: auto;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-display: swap;
          font-smooth: 2em;
        }

        #__next {
          margin: 0;
          padding: 0;
        }

        ::-moz-selection {
          /* Code for Firefox */
          color: black;
          background: yellow;
        }

        ::selection {
          color: black;
          background: yellow;
        }
        #__next {
          width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        a {
          cursor: pointer;
          color: yellow;
        }

        p {
          margin: 10px 0px 20px;
        }

        article {
          margin: 0 auto;
          max-width: 650px;
        }

        svg {
          margin: 0;
        }

        select {
          font-size: 28.95px;
          line-height: 34.74px;
          border: 2px solid ${theme.colors.black.primary};
          box-sizing: border-box;
          transition: background-color 0.3s;
          width: 100%;
          max-width: 400px;
          text-transform: uppercase;
          text-align-last: center;
          background: url("https://cdn1.iconfinder.com/data/icons/pinpoint-action/48/arrow-dropdown-24.png")
            no-repeat 95% 50%;
          padding: 10px 10px;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
        }

        select:active,
        select:focus {
          outline: none;
        }

        button {
          background-color: yellow;
          border: 0;
          color: black;
          width: 100%;
          max-width: 400px;
          font-size: 29.24px;
          line-height: 35.09px;
          font-weight: bold;
          padding: 10px 10px;
          cursor: pointer;
        }

        button:hover {
          background-color: ${saturate(0.5, theme.colors.brand.primary)};
        }

        button:active {
          background-color: ${saturate(0.5, theme.colors.brand.primary)};
        }

        button:focus,
        .size-selection button:focus {
          outline: none;
        }
        i {
          color: ${
            theme.isDarkMode
              ? theme.colors.white.primary
              : theme.colors.black.primary
          };
        }
        .pc-menu-item {
          color: ${
            theme.isDarkMode
              ? theme.colors.white.primary
              : theme.colors.black.primary
          };
          font-family: ${(p: any) => p.theme.typography.bodySM.fontFamily};
          font-weight: ${(p: any) => p.theme.typography.bodySM.fontWeight};
          font-size: ${(p: any) => p.theme.typography.bodySM.fontSize};
          margin-right: 82px !important;
        }
        .pc-menu-wrap {
          padding-bottom: 30px !important;
        }
        .bm-overlay {
          top: 0;
        }
        .bm-burger-button {
          span span {
            background: ${
              theme.isDarkMode
                ? theme.colors.white.primary
                : theme.colors.black.primary
            } !important;
          }
        }
      `) as SerializedStyles
    }
  />
);
