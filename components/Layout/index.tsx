<<<<<<< HEAD
export { Layout } from "./Layout";
=======
import React from "react";

export const Layout = ({ children }) => {
  console.log('children: ', children)
  return (
    <main>
      {children}
      <style jsx global>{`
        * {
          font-family: IBM Plex Mono, Menlo, Monaco, "Lucida Console", "Liberation Mono",
            "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New",
            monospace, serif;
        }
        body {
          margin: 0;
          padding: 25px 50px;
        }
        a {
          color: #22bad9;
        }
        p {
          font-size: 14px;
          line-height: 24px;
        }
        article {
          margin: 0 auto;
          max-width: 650px;
        }

      `}</style>
    </main>
  );
};
>>>>>>> 4f8e275 (fixed styling of input and buttons)
