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
import { makeStyles, createStyles } from "@material-ui/core";
import { MainMenuProps, menuDataItem } from "./types";
import { useMediaQuery } from "react-responsive";
import DesktopMenu from "./DesktopMenu";
const useStyles = makeStyles((theme) =>
  createStyles({
    siderMenu: {
      width: "100%"
    },
    nested: {
      paddingLeft: theme.spacing(4)
    }
  })
);
export const MainMenu = (props: MainMenuProps) => {
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
  const classes = useStyles();
  const [keyPath, setKeyPath] = useState("");
  const isTabletOrDesktop = useMediaQuery({ minWidth: 768 });
  console.log("desk", isTabletOrDesktop);
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
    const listItemStyle = { paddingLeft: level * 40 + "px" };
    return (
      <List disablePadding className={classes.siderMenu}>
        {menusData.map((item, index) => {
          return (
            <div key={parentKeyPath + "/" + item.key}>
              {
                <ListItem
                  style={listItemStyle}
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
                </ListItem>
              }
              {item && item.children && item.children.length != 0 && (
                <Collapse
                  timeout="auto"
                  unmountOnExit
                  in={keyPath.indexOf(parentKeyPath + "/" + item.key) != -1}>
                  {getSubMenuOrItems(item.children, parentKeyPath + "/" + item.key, level + 1)}
                </Collapse>
              )}
            </div>
          );
        })}
      </List>
    );
  };

  {
    /*<div className={'layout'}>
      <DesktopMenu onMenuItemClick={onMenuItemClick} pcWrapClassName={classnames(pcWrapClassName)} pcMenuItemClassName={pcMenuItemClassName}  menusData={menusData} />
      </div>*/
  }
  return (
    <>
      <div className={"pc-hidden"}>
        <Menu {...others}>
          {getSubMenuOrItems(menusData, "", 0)}
          <style jsx global>
            {`
              @media screen and (min-width: 768px) {
                .pc-hidden {
                  display: none;
                }
                .mobile-hidden{
                display: flex;
                }
              }
              @media screen and (max-width: 767px) {
                .mobile-hidden {
                  display: none;
                }
              }
              .bm-burger-button {
                position: fixed;
                width: 36px;
                height: 30px;
                left: 36px;
                top: 36px;
              }
              .bm-burger-button button:focus {
                outline: 2px solid #000;
                outline-offset: 8px;
              }
              .bm-burger-button button:focus + span span.bm-burger-bars {
                background-color: #c94e50;
              }
              .right .bm-burger-button {
                left: initial;
                right: 36px;
              }
              .bm-burger-bars {
                background: #000;
              }
              .bm-burger-bars-hover {
                background: #a90000;
              }
              .bm-cross-button {
                height: 24px;
                width: 24px;
              }
              .bm-cross {
                background: #000;
              }
              .bm-menu-wrap {
                position: fixed;
                height: 100%;
              }
              .bm-menu {
                background: #373a47;
                padding: 2.5em 1.5em 0;
                fontsize: 1.15em;
                height: 100%;
              }
              .bm-morph-shape {
                fill: #373a47;
              }
              .bm-item-list {
                color: #b8b7ad;
                padding: 0.8em;
                height: 100%;
              }
              .bm-item {
                display: block;
                padding: 0.8em;
              }
              .bm-overlay {
                top: 0;
                background: rgba(0, 0, 0, 0.3);
              }
            `}
          </style>
        </Menu>
      </div>
      <div className={"mobile-hidden"}>
        <DesktopMenu
          onMenuItemClick={onMenuItemClick}
          pcWrapClassName={classnames(pcWrapClassName)}
          pcMenuItemClassName={pcMenuItemClassName}
          menusData={menusData}
        />
      </div>
    </>
  );
};
