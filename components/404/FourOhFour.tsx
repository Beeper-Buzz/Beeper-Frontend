"use client";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { Layout } from "../components";
import {
  NotFoundContainer,
  NotFoundTitle,
  NotFoundSubtitle
} from "./FourOhFour.styles";

const Lottie = dynamic(() => import("react-lottie"), { ssr: false });

export const FourOhFour = () => {
  // Import animation data only on client
  const girlAnimation = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../../data/girl.json");
  }, []);

  const animationOptions = useMemo(
    () => ({
      loop: true,
      autoplay: true,
      animationData: girlAnimation,
      rendererSettings: {
        preserveAspectRatio: "xMidYMid slice"
      }
    }),
    [girlAnimation]
  );

  return (
    <Layout>
      <NotFoundContainer>
        <Lottie
          options={animationOptions}
          width={300}
          height={300}
          style={{ pointerEvents: "none" }}
        />
        <NotFoundTitle>404</NotFoundTitle>
        <NotFoundSubtitle>Whoops, keep looking...</NotFoundSubtitle>
      </NotFoundContainer>
    </Layout>
  );
};
