import React, { Fragment, useCallback, useState } from "react";
import BurgerMenu from "./BurgerMenu";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import classnames from "classnames";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ExpandLess from "@material-ui/icons/ExpandLess";
import ExpandMore from "@material-ui/icons/ExpandMore";
import Collapse from "@material-ui/core/Collapse";
import { MobileMenuProps, menuDataItem } from "./types";
import { useMediaQuery } from "react-responsive";
import DesktopMenu from "./DesktopMenu";
import styled from "@emotion/styled";
const SiderMenu = styled(List)`
  width: 100%;
`;
export interface MenuItemProps {
  pl: string;
}
const MenuItem = styled(ListItem)<MenuItemProps>`
  padding-left: ${(props) => props.pl}!important;
`;
const PCHidden = styled.div`
  @media screen and (min-width: 768px) {
    display: none;
  }
`;
const MobileHidden = styled.div`
  @media screen and (max-width: 767px) {
    display: none;
  }
  @media screen and (min-width: 768px) {
    display: flex;
  }
`;
export const MobileMenu = (props: MobileMenuProps) => {
  const {
    pcWrapClassName,
    pcMenuItemClassName,
    onMenuItemClick,
    animationType,
    children,
    menusData,
    ...others
  } = props;
  const Menu = BurgerMenu[animationType as keyof typeof BurgerMenu];
  const [keyPath, setKeyPath] = useState("");
  const isTabletOrDesktop = useMediaQuery({ minWidth: 768 });
  const handleClick = useCallback((kp, key) => {
    if (onMenuItemClick) {
      onMenuItemClick(kp, key);
    }
    setKeyPath((pre) => {
      if (kp == pre) {
        let str = kp.replace("/" + key, "");
        return str;
      } else {
        return kp;
      }
    });
  }, []);
  const getSubMenuOrItems = (menusData: menuDataItem[], parentKeyPath: string, level: number) => {
    const pl = level * 40 + "px";
    return (
      <SiderMenu disablePadding>
        {menusData.map((item, index) => {
          return (
            <Fragment key={parentKeyPath + "/" + item.key}>
              {
                <MenuItem
                  pl={pl}
                  onClick={handleClick.bind(null, parentKeyPath + "/" + item.key, item.key)}
                  button>
                  <ListItemIcon>{item.icon ? item.icon() : null}</ListItemIcon>
                  <ListItemText primary={item.name} />
                  {item &&
                    item.children &&
                    item.children.length != 0 &&
                    (keyPath.indexOf(parentKeyPath + "/" + item.key) != -1 ? (
                      <ExpandLess />
                    ) : (
                      <ExpandMore />
                    ))}
                </MenuItem>
              }
              {item && item.children && item.children.length != 0 && (
                <Collapse
                  timeout="auto"
                  unmountOnExit
                  in={keyPath.indexOf(parentKeyPath + "/" + item.key) != -1}>
                  {getSubMenuOrItems(item.children, parentKeyPath + "/" + item.key, level + 1)}
                </Collapse>
              )}
            </Fragment>
          );
        })}
      </SiderMenu>
    );
  };

  {
    /*<div className={'layout'}>
      <DesktopMenu onMenuItemClick={onMenuItemClick} pcWrapClassName={classnames(pcWrapClassName)} pcMenuItemClassName={pcMenuItemClassName}  menusData={menusData} />
      </div>*/
  }
  return (
    <>
      <PCHidden>
        <Menu {...others}>{getSubMenuOrItems(menusData, "", 0)}</Menu>
      </PCHidden>
      <MobileHidden>
        <DesktopMenu
          onMenuItemClick={onMenuItemClick}
          pcWrapClassName={classnames(pcWrapClassName)}
          pcMenuItemClassName={pcMenuItemClassName}
          menusData={menusData}
        />
      </MobileHidden>
    </>
  );
};
