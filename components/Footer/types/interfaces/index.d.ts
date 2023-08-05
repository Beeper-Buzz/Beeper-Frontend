import {ReactElement} from "react";
import PropTypes from "prop-types";
declare global {
    interface Window {
        mina: any;
    }
}
export type Path={
    animate:Function;
}
export type BurgerMenu={
    slide:ReactElement;
    stack:ReactElement;
    elastic: ReactElement;
    bubble: ReactElement;
    push: ReactElement;
    pushRotate: ReactElement;
    scaleDown: ReactElement;
    scaleRotate: ReactElement;
    fallDown: ReactElement;
    reveal: ReactElement;
}
export interface MainMenuProps{
    animationType:keyof BurgerMenu;
    children:ReactElement;
    bodyClassName: string;
    burgerBarClassName: string;
    burgerButtonClassName: string;
    className: string,
    crossButtonClassName: string,
    crossClassName: string,
    customBurgerIcon: ReactElement|false;
    customCrossIcon: ReactElement|false;
    customOnKeyDown: Function;
    disableAutoFocus: boolean;
    disableCloseOnEsc: boolean;
    disableOverlayClick: boolean|Function;
    htmlClassName: string;
    id: string;
    isOpen: boolean;
    itemClassName: string;
    itemListClassName: string;
    itemListElement: "div"|"nav";
    menuClassName: string;
    morphShapeClassName: string;
    noOverlay: boolean;
    noTransition: boolean;
    onClose: Function;
    onIconHoverChange: Function;
    onOpen: Function;
    onStateChange: Function,
    outerContainerId: string;
    overlayClassName: string,
    pageWrapId: string;
    right: boolean;
    styles: object;
    width: number|string;
}