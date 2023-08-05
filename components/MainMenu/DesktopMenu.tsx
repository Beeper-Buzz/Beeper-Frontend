<<<<<<< HEAD
import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/router";
import { IDesktopMenuProps } from "./types/DesktopMenu";
import { menuDataItem } from "./types";

import {
  Container,
  MenuItem,
  DropDown,
  DropDownLink,
  DropDownColumn,
  DropDownHeader,
  DropDownAdvert,
  Vr
} from "./DesktopMenu.styles";

const DesktopMenu: React.FC<IDesktopMenuProps> = (props: IDesktopMenuProps) => {
  const router = useRouter();
  let timer: any;
  const {
    pcWrapClassName,
    menusData,
    menusLoading,
    pcMenuItemClassName,
    onMenuItemClick
  } = props;
  const menuItems =
    menusData && menusData.menu_location_listing
      ? menusData?.menu_location_listing[0]?.menu_item_listing
      : [];
  const desktopMenu = () => {
    if (menusLoading) {
      return [];
    }
    return menuItems.map((item: any, index: number) => {
      return (
        <MenuItem
          onMouseEnter={handleMouseEnter.bind(null, item)}
          onMouseLeave={handleMouseLeave}
          onClick={() => router.push(item.url)}
          isActive={currentKey == item.id}
          key={`${index}-1`}
        >
          {item.name}
        </MenuItem>
      );
    });
  };
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

  if (menusLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Container className={pcWrapClassName}>
      {desktopMenu()}
      {menuItems.map((item: any, index: any) => {
        if (item.childrens.length) {
          return (
            <DropDown
              onMouseEnter={handleMouseEnter.bind(null, item)}
              onMouseLeave={handleMouseLeave}
              isActive={currentKey == item.id}
              key={`${index}-2`}
            >
              {item.childrens?.map((item: any, index: any) => (
                <DropDownColumn key={`${index}-column`}>
                  <DropDownHeader key={`${index}-header`}>
                    {item.name}
                  </DropDownHeader>
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
=======
import React, { useState, useCallback } from "react";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import { IDesktopMenuProps } from "./types/DesktopMenu";
import { makeStyles, createStyles } from "@material-ui/core";
import Button from "@material-ui/core/Button";
import classnames from "classnames";
import { menuDataItem } from "./types";
const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      paddingLeft: "100px",
      height: "80px",
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap"
    },
    topMenuItem: {
      marginRight: "50px",
      lineHeight: "80px"
    }
  })
);
const DesktopMenu: React.FC<IDesktopMenuProps> = (props: IDesktopMenuProps) => {
  const { pcWrapClassName, menusData, pcMenuItemClassName, onMenuItemClick } = props;
  const classes = useStyles();
  const [keyPathMap, setKeyPathMap] = useState({});
  const handleClick = useCallback((keyPath, event) => {
    setKeyPathMap((pre) => {
      let ret = { [keyPath]: event.target };
      return ret;
    });
  }, []);
  const handleClose = useCallback((keyPath) => {
    setKeyPathMap((pre) => {
      return { ...pre, [keyPath]: null };
    });
  }, []);
  const handleClickMenuItem = useCallback((keyPath: string, key: string) => {
    if (onMenuItemClick) {
      onMenuItemClick(keyPath, key);
    }
    setKeyPathMap({});
  }, []);
  const getSubMenuOrItems = (menusData: menuDataItem[], parentKeyPath: string, level: number) => {
    return menusData.map((item, index) => {
      return (
        <div
          className={classnames(classes.topMenuItem, pcMenuItemClassName)}
          key={parentKeyPath + "/" + item.key}>
          <div
            style={{ textAlign: "center", width: "100%" }}
            onClick={handleClick.bind(null, parentKeyPath + "/" + item.key)}>
            {" "}
            {item.name}
          </div>

          {item && item.children && (
            <Menu
              getContentAnchorEl={null}
              transformOrigin={{
                vertical: "top",
                horizontal: "center"
              }}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "center"
              }}
              onClose={handleClose.bind(null, `${parentKeyPath}/${item.key}`)}
              keepMounted
              id={`${parentKeyPath}/${item.key}`}
              anchorEl={keyPathMap[`${parentKeyPath}/${item.key}` as keyof typeof keyPathMap]}
              open={Boolean(keyPathMap[`${parentKeyPath}/${item.key}` as keyof typeof keyPathMap])}>
              {item.children.map((v, i) => {
                return (
                  <MenuItem
                    onClick={handleClickMenuItem.bind(
                      null,
                      `${parentKeyPath}/${item.key}/${v.key}`,
                      v.key
                    )}
                    key={parentKeyPath + "/" + item.key + "/" + v.key}>
                    {v.name}
                  </MenuItem>
                );
              })}{" "}
            </Menu>
          )}
        </div>
      );
    });
  };
  return (
    <div className={classnames(classes.container, pcWrapClassName)}>
      {getSubMenuOrItems(menusData, "", 0)}
    </div>
>>>>>>> 249e2df (update)
  );
};
export default DesktopMenu;
