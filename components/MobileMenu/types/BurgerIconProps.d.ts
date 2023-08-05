import { MouseEventHandler } from "react";

export type BurgerIconStyles = {
  bmBurgerBarsHover?: object;
  bmIcon?: object;
  bmBurgerBars?: object;
  bmBurgerButton?: object;
  bmCross?: object;
  bmCrossButton?: object;
  bmMenuWrap?: object;
};
export interface BurgerIconProps {
  styles?: BurgerIconStyles;
  customIcon?: ReactElement;
  barClassName?: string;
  className: string;
  onClick: MouseEventHandler<HTMLElement>;
  onIconHoverChange?: Function;
}
