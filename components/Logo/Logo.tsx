import React from "react";

import { LogoMark, AnimatedLogoWrapper } from "./Logo.styles";
import { AnimatedLogo } from "./AnimatedLogo";

export const Logo = ({
  hasBlob,
  isDark,
  animated = false,
  showTagline = false
}: any) => {
  if (animated) {
    return (
      <AnimatedLogoWrapper>
        <AnimatedLogo showTagline={showTagline} />
      </AnimatedLogoWrapper>
    );
  }

  return (
    <>
      <LogoMark src={process.env.NEXT_PUBLIC_LOGO_PATH} />
    </>
  );
};
