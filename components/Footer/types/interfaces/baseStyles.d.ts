export interface BaseStyles{
    overlay:(isOpen:boolean)=>object;
    menuWrap:(isOpen:boolean,width:string,right:string)=>object;
    menu:()=>object;
    itemList:()=>object;
    item:()=>object;
}
export type BaseStylesKey=keyof BaseStyles