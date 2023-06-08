import React from "react";
import { Facebook, Twitter, Instagram } from "@material-ui/icons";

import {
  SocialContainer,
  SocialList,
  SocialListItem,
  SocialIcon
} from "./SocialLinks.styles";

export const SocialLinks = ({ darkMode }: any) => {
  return (
    <>
      <SocialContainer darkMode={darkMode}>
        <SocialList>
          <SocialListItem darkMode={darkMode}>
            <a
              href={process.env.NEXT_PUBLIC_INSTAGRAM_URL || "http://www.instagram.com"}
              target="_blank"
            >
              {/* <SocialIcon src="images/social-icon-instagram.png" /> */}
              <Instagram />{" "}
            </a>
          </SocialListItem>

          <SocialListItem darkMode={darkMode}>
            <a
              href={process.env.NEXT_PUBLIC_FACEBOOK_URL || "http://www.facebook.com"}
              target="_blank"
            >
              {/* <SocialIcon src="images/social-icon-facebook.png" />{" "} */}
              <Facebook />{" "}
            </a>
          </SocialListItem>

          <SocialListItem darkMode={darkMode}>
            <a
              href={process.env.NEXT_PUBLIC_TWITTER_URL || "http://www.twitter.com"}
              target="_blank"
            >
              {/* <SocialIcon src="images/social-icon-twitter.png" />{" "} */}
              <Twitter />{" "}
            </a>
          </SocialListItem>
        </SocialList>
      </SocialContainer>
    </>
  );
};
