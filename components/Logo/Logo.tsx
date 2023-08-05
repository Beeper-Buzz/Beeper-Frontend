import { useState } from "react";

import { LogoMark } from "./Logo.styles";

export const Logo = ({ hasBlob, isDark }: any) => {
  const [active, setActive] = useState(false);

  return (
    <>
      <LogoMark src={process.env.NEXT_PUBLIC_LOGO_PATH} />
    </>
  );
};
