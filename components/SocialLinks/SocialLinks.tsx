import React from "react";
import styled from "@emotion/styled";

import {
  SocialContainer,
  SocialList,
  SocialListItem,
  SocialIcon
} from "./SocialLinks.styles";

export const SocialLinks = () => {
  const instagramSlug =
    process.env.NEXT_PUBLIC_INSTAGRAM_SLUG || "gaggle_of_lawyers";
  const facebookSlug =
    process.env.NEXT_PUBLIC_FACEBOOK_SLUG || "materialinstinct";
  const twitterSlug = process.env.NEXT_PUBLIC_TWITTER_SLUG || "aaronsmulktis";
  return (
    <>
      <SocialContainer>
        <SocialList>
          <SocialListItem>
            <a href={`https://instagram.com/${instagramSlug}`} target="_blank">
              <SocialIcon src="/images/social-icon-instagram.png" />
            </a>
          </SocialListItem>

          <SocialListItem>
            <a href={`https://facebook.com/${facebookSlug}`} target="_blank">
              <SocialIcon src="/images/social-icon-facebook.png" />{" "}
            </a>
          </SocialListItem>

          <SocialListItem>
            <a href={`https://twitter.com/${twitterSlug}`} target="_blank">
              <SocialIcon src="/images/social-icon-twitter.png" />{" "}
            </a>
          </SocialListItem>
        </SocialList>
      </SocialContainer>
    </>
  );
};
