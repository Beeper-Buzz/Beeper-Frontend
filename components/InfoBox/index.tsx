<<<<<<< HEAD
<<<<<<< HEAD
export { InfoBox } from "./InfoBox";
=======
import React from "react";
import { InfoBoxProps } from "./types";

const InfoBox: React.FC<InfoBoxProps> = ({ children }: { children: string }) => (
  <div className="info">
    <style jsx>{`
      .info {
        margin-top: 20px;
        margin-bottom: 20px;
        padding-top: 20px;
        padding-bottom: 20px;
        border-top: 1px solid #ececec;
        border-bottom: 1px solid #ececec;
      }
    `}</style>
    {children}
  </div>
);

export { InfoBox };
>>>>>>> 368708c (update)
=======
export { InfoBox } from './InfoBox'
>>>>>>> 7cc392d (reorganize files (prefer named files), rename MainMenu > MobileMenu, add MobileMenu & Footer to global Layout file, remove test route)
