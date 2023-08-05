import {FunctionComponent, ReactElement} from "react";
import {BurgerIconStyles} from "./BurgerIconProps";


export type SVG ={
    animate:Function;
    lib:Function;
    pathInitial?:string;
    pathOpen:string;
}
export type MenuFactoryStyles={
    svg?:SVG;
    overlay?:(isOpen:boolean,width?:string,right?:boolean)=>object;
    menuWrap?:(isOpen:boolean,width:string,right:boolean)=>object;
    menu?:(isOpen:boolean,width:string,right:boolean)=>object;
    itemList?:(isOpen:boolean,width:string,right:boolean)=>object|undefined;
    item?:(isOpen:boolean,width:string,right:boolean,nthChild:number)=>object;
    pageWrap?:(isOpen:boolean,width:string,right:boolean)=>object;
    outerContainer?:(isOpen:boolean)=>object;
    burgerIcon?:(isOpen:boolean,width:string,right:boolean)=>object;
    morphShape?:(isOpen:boolean,width:string,right:boolean)=>object;
    closeButton?:(isOpen:boolean,width:string,right:boolean)=>object;
}
export type MenuFactoryStylesKey=keyof  MenuFactoryStyles
export interface MenuProps {
    isOpen: boolean;
    onStateChange:Function;
    disableAutoFocus:boolean;
    customOnKeyDown:EventListener;
    onOpen:Function;
    onClose:Function;
    width:string;
    right:string;
    styles:BurgerIconStyles;
    noTransition:boolean;
    htmlClassName:string;
    bodyClassName:string;
    pageWrapId:string;
    outerContainerId:string;
    disableCloseOnEsc:boolean;
    disableOverlayClick:boolean|Function;
    noOverlay:boolean;
    overlayClassName:string;
    customBurgerIcon:ReactElement|false;
    burgerButtonClassName:string;
    burgerBarClassName:string;
    onIconStateChange:()=>void;
    id:string;
    className:string;
    morphShapeClassName:string;
    itemListElement:FunctionComponent;
    itemClassName:string;
}