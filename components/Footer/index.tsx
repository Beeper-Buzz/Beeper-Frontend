<<<<<<< HEAD
<<<<<<< HEAD
export * from "./Footer";
=======
import React from "react";
import Proptypes from "prop-types";
import { FooterProps, Link } from "./types/interfaces/FooterProps";

export const Footer = (props: FooterProps) => {
  const { links, showLegal, showContact, showSocial, styles } = props;
  let legals: Link[] = [];
  let contacts: Link[] = [];
  let socials: Link[] = [];
  links.forEach((link: Link) => {
    if (link.type == "legal") {
      legals.push(link);
    } else if (link.type == "contact") {
      contacts.push(link);
    } else if (link.type == "social") {
      socials.push(link);
    }
  });
  return (
    <div style={styles} className={"container"}>
      <div className="links-wrapper">
        {showLegal && legals.length !== 0 && (
          <div className="legal-wrap">
            <div className="legal-title">Legal Links</div>
            {legals.map((item, index) => {
              return (
                <div className={"link-item"} key={index}>
                  <a href={item.url}>
                    {item.icon && <item.icon />}
                    {item.text}
                  </a>
                </div>
              );
            })}
          </div>
        )}
        {showContact && contacts.length !== 0 && (
          <div className="contact-wrap">
            <div className="contact-title">Contact Links</div>
            {contacts.map((item, index) => {
              return (
                <div className={"link-item"} key={index}>
                  <a href={item.url}>
                    {item.icon && <item.icon />}
                    {item.text}
                  </a>
                </div>
              );
            })}
          </div>
        )}
        {showSocial && socials.length !== 0 && (
          <div className="social-wrap">
            <div className="social-title">Social Links</div>
            {socials.map((item, index) => {
              return (
                <div className={"link-item"} key={index}>
                  <a href={item.url}>
                    {item.icon && <item.icon />}
                    {item.text}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="copy-right">© All Rights Reserved by Material Instincts DNA</div>

      <style jsx>
        {`
          .container {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .links-wrapper {
            width: 100%;
            display: flex;
            justify-content: center;
          }
          .legal-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-right: 300px;
            font-size: 30px;
          }
          .legal-title {
            font-size: 30px;
            font-weight: 900;
            margin-bottom: 50px;
          }
          .contact-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-right: 300px;
            font-size: 30px;
          }
          .contact-title {
            font-size: 30px;
            font-weight: 900;
            margin-bottom: 50px;
          }
          .social-wrap {
            display: flex;
            flex-direction: column;
            font-size: 30px;
          }
          .social-title {
            font-size: 30px;
            font-weight: 900;
            margin-bottom: 50px;
          }
          .link-item {
            margin-bottom: 20px;
            color: #000;
          }
          .link-item a {
            color: #000;
          }
          .copy-right {
            margin-top: 100px;
          }
        `}
      </style>
    </div>
  );
};

Footer.propTypes = {
  links: Proptypes.arrayOf(Proptypes.object),
  showLegal: Proptypes.bool,
  showContact: Proptypes.bool,
  showSocial: Proptypes.bool,
  styles: Proptypes.object
};
Footer.defaultProps = {
  links: [],
  showLegal: true,
  showContact: true,
  showSocial: true,
  styles: {}
};
>>>>>>> 368708c (update)
=======
export { Footer } from './Footer'
>>>>>>> 7cc392d (reorganize files (prefer named files), rename MainMenu > MobileMenu, add MobileMenu & Footer to global Layout file, remove test route)
