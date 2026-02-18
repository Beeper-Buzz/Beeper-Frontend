import React from "react";
import { useRouter } from "next/router";
import { HeroAction, HeroTitle, Container } from "./Hero.styles";
import { Button } from "@components/shared";

export interface HeroProps {
  title?: string;
  content?: string;
  buttonText?: string;
  buttonLink?: string;
  backgroundImage?: string;
}

const Hero: React.FC<HeroProps> = ({
  title,
  content,
  buttonText = "BROWSE NOW",
  buttonLink = "/about",
  backgroundImage
}) => {
  const router = useRouter();
  return (
    <Container backgroundImage={backgroundImage}>
      <HeroAction>
        {title && <HeroTitle>{title}</HeroTitle>}
        {content && <p>{content}</p>}
        <Button width={200} onClick={() => router.push(buttonLink)}>
          {buttonText}
        </Button>
      </HeroAction>
    </Container>
  );
};
export default Hero;
