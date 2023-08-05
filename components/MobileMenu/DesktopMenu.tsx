import React, { useState, useCallback } from "react";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import { IDesktopMenuProps } from "./types/DesktopMenu";
import { menuDataItem } from "./types";
import styled from "@emotion/styled";
const Container = styled.div`
  padding-left: 100px;
  height: 80px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
`;
const MyMenuItem = styled.div`
  margin-right: 50px;
  line-height: 80px;
`;
const MySubMenuItem = styled.div`
  text-align: center;
  width: 100%;
`;
const DesktopMenu: React.FC<IDesktopMenuProps> = (props: IDesktopMenuProps) => {
  const { pcWrapClassName, menusData, pcMenuItemClassName, onMenuItemClick } = props;
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
        <MyMenuItem className={pcMenuItemClassName} key={parentKeyPath + "/" + item.key}>
          <MySubMenuItem onClick={handleClick.bind(null, parentKeyPath + "/" + item.key)}>
            {item.pcIcon && item.pcIcon()}
            {item.name}
          </MySubMenuItem>

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
                    {v.pcIcon && v.pcIcon()}
                    {v.name}
                  </MenuItem>
                );
              })}{" "}
            </Menu>
          )}
        </MyMenuItem>
      );
    });
  };
  return <Container className={pcWrapClassName}>{getSubMenuOrItems(menusData, "", 0)}</Container>;
};
export default DesktopMenu;
