import {MouseEventHandler, ReactElement} from "react";
export type CrossIconStyles={
    bmCross:object;
    bmCrossButton:object;
}
export interface CrossIconProps{
    customIcon:ReactElement;
    styles:CrossIconStyles;
    crossClassName:string;
    className:string;
    onClick:MouseEventHandler<HTMLElement>;
    isOpen:boolean;
}