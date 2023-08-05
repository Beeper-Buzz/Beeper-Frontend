import React from "react";

import { LogoMark } from "./Logo.styles";

export const Logo = ({ hasBlob, isDark }: any) => {
  return (
    <>
      <LogoMark src={process.env.NEXT_PUBLIC_LOGO_PATH} />
    </>
  );
};
