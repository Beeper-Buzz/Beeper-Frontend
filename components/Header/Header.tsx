import React, { useEffect, useState, useRef } from "react";
import { useMediaQuery } from "react-responsive";
import { useRouter } from "next/router";
import Link from "next/link";
import { Badge } from "@material-ui/core";
import Sticky from "react-sticky-el";
import { HeaderProps } from "./types";
import { useAuth } from "../../config/auth";
import { useCart } from "../../hooks/useCart";
import { MyLogo } from "../Layout/Layout";
import SearchBar from "../SearchBar";
import { MainMenu } from "../MainMenu";
import { menusData } from "../MainMenu/data/menusData";
import { CartSidebar } from "../CartSidebar/CartSidebar";
import { SocialLinks } from "..";

import {
  TopHeader,
  LeftSide,
  RightSide,
  LogoDiv,
  HeaderDiv,
  LinkDiv,
  BottomHeader,
  Category,
  UserIconMo,
  CartMo,
  CartToggle,
  HeaderAccount,
  HeaderOptions,
  ArrowDown,
  ShoppingCart,
  FavoriteIcon,
  AccountEmail,
  AccountMenu,
  AccountOption
} from "./Header.styles";

const dummyCategories = ["Best Sellers", "Latest", "Seasonal", "Luxury", "On Sale", "Coming Soon"];

export const Header: React.FC<HeaderProps> = ({ darkMode }) => {
  const { pathname } = useRouter();
  const { user, logout } = useAuth();
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [cartVisible, setCartVisible] = useState(false);
  const [accountVisible, setAccountVisible] = useState(false);
  const [accountElem, setAccountElem] = useState(null);
  const accountRef = useRef(null);
  const accountOpen = Boolean(accountElem);
  const accountId = accountVisible ? "simple-popover" : undefined;
  const toggleCart = () => setCartVisible((isVisible) => !isVisible);
  const toggleAccount = () => setAccountVisible((isVisible) => !isVisible);
  const isMaint = process.env.IS_MAINT_MODE;

  const { data: cartData, isLoading: cartIsLoading, isError: cartHasError } = useCart();

  const handleAccount = (event: any) => {
    setAccountElem(event.currentTarget);
  };

  const handleCloseAccount = () => {
    setAccountElem(null);
  };

  if (isMaint && isMaint === "true") {
    return null;
  }

  useEffect(() => {
    console.log(user && user.data.attributes);
  }, []);

  return (
    <HeaderDiv>
      <TopHeader>
        {!isMobile && (
          <LeftSide>
            <SocialLinks darkMode={darkMode} />
          </LeftSide>
        )}
        <LogoDiv>
          <Link href="/">
            <LinkDiv isActive>
              <MyLogo imageFile="/pol-logo.png" darkMode={darkMode} />
            </LinkDiv>
          </Link>
        </LogoDiv>
        <RightSide>
          {isMobile ? null : <SearchBar darkMode={darkMode} />}
          {user ? (
            <HeaderAccount>
              <AccountEmail aria-describedby={accountId} onClick={handleAccount}>
                {user.data.attributes.email}
                <ArrowDown />
              </AccountEmail>
              <AccountMenu
                open={accountOpen}
                anchorEl={accountElem}
                onClose={handleCloseAccount}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "center"
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "center"
                }}
              >
                <AccountOption>
                  <div>Account Settings</div>
                </AccountOption>
                <AccountOption>
                  <div>Need Help?</div>
                </AccountOption>
                <hr />
                <AccountOption>
                  <div onClick={logout}>Logout</div>
                </AccountOption>
              </AccountMenu>
              {/* <UserIconMo src={"/user.png"} /> */}
              <Badge badgeContent={4} color="secondary">
                <FavoriteIcon />
              </Badge>
            </HeaderAccount>
          ) : (
            <HeaderOptions>
              <Link href="/login">
                <LinkDiv isActive={pathname === "/login"}>LOG IN</LinkDiv>
              </Link>
              <Link href="/authenticate/signup">
                <LinkDiv isActive={pathname === "/authenticate/signup"}>SIGN UP</LinkDiv>
              </Link>
            </HeaderOptions>
          )}
          <CartToggle>
            <Badge
              badgeContent={cartData ? cartData.data.attributes.item_count : 0}
              color="primary"
            >
              <CartSidebar isVisible={cartVisible} toggle={toggleCart} />
            </Badge>
          </CartToggle>
        </RightSide>
      </TopHeader>
    </HeaderDiv>
  );
};
