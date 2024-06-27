import React, { useState, useCallback, useEffect } from "react";
import { IDesktopMenuProps } from "./types/DesktopMenu";
import { menuDataItem } from "./types";

import {
  Container,
  MyMenuItem,
  DropDown,
  DropDownLink,
  DropDownColumn,
  DropDownHeader,
  DropDownAdvert,
  Vr
} from "./DesktopMenu.styles";

const DesktopMenu: React.FC<IDesktopMenuProps> = (props: IDesktopMenuProps) => {
  let timer: any;
  const { pcWrapClassName, menusData, pcMenuItemClassName, onMenuItemClick } = props;
  const desktopMenu = menusData?.menu_location_listing[0].menu_item_listing;
  const [currentKey, setCurrentKey] = useState();
  const handleMouseEnter = useCallback((item: any) => {
    if (timer) {
      clearTimeout(timer);
    }
    setCurrentKey(item.id);
  }, []);
  const handleMouseLeave = useCallback(() => {
    timer = setTimeout(() => setCurrentKey(undefined), 300);
  }, []);
  // useEffect(() => {
  //   console.log(menusData);
  // }, []);
  return (
    <Container className={pcWrapClassName}>
      {/* {menusData.map((item, index) => ( */}
      {desktopMenu.map((item: any, index: any) => (
        <MyMenuItem
          onMouseEnter={handleMouseEnter.bind(null, item)}
          onMouseLeave={handleMouseLeave}
          isActive={currentKey == item.id}
          key={`${index}-1`}
        >
          {item.name}
        </MyMenuItem>
      ))}
      {/* {menusData.map((item, index) => ( */}
      {desktopMenu.map((item: any, index: any) => {
        if (item.childrens.length) {
          return (
            <DropDown
              onMouseEnter={handleMouseEnter.bind(null, item)}
              onMouseLeave={handleMouseLeave}
              isActive={currentKey == item.id}
              key={`${index}-2`}
            >
              {/* {item.pcMenuItem} */}
              {item.childrens?.map((item: any, index: any) => (
                <DropDownColumn key={`${index}-column`}>
                  <DropDownHeader key={`${index}-header`}>{item.name}</DropDownHeader>
                  {item.childrens?.map((item: any, index: any) => (
                    <DropDownLink href={item.url} key={`${index}-link`}>
                      {item.name}
                    </DropDownLink>
                  ))}
                </DropDownColumn>
              ))}
              <Vr />
              <DropDownAdvert>
                <h1>On Sale!</h1>
              </DropDownAdvert>
            </DropDown>
          );
        }
      })}
    </Container>
  );
};
export default DesktopMenu;
