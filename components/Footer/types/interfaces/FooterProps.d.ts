import { FunctionComponent } from "react";

export interface Link {
  type: string;
  url?: string;
  icon?: FunctionComponent;
  text?: string;
}
export interface FooterProps {
  links: Link[];
  showLegal: boolean;
  showContact: boolean;
  showContent?: boolean;
  showSocial: boolean;
  styles: {};
}
