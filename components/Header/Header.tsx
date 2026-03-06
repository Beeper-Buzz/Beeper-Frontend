import React, { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";
import Router, { useRouter } from "next/router";
import Link from "next/link";
import { ChevronDown, Heart } from "lucide-react";
import { cn } from "@lib/utils";
import {
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "@components/ui";
import { HeaderProps } from "./types";
import { useAuth } from "../../config/auth";
import { useCart } from "../../hooks/useCart";
import { useFavorites } from "../../hooks/useFavorites";
import SearchBar from "../SearchBar";
import { CartSidebar } from "../CartSidebar/CartSidebar";
import { SocialLinks } from "../SocialLinks";
import { AnimatedLogo } from "../Logo/AnimatedLogo";

export const Header: React.FC<HeaderProps> = ({ darkMode }) => {
  const router = useRouter();
  const { pathname } = useRouter();
  const { user, logout } = useAuth();
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [cartVisible, setCartVisible] = useState(false);
  const toggleCart = () => setCartVisible((isVisible) => !isVisible);
  const [isLoading, setIsLoading] = useState(false);
  const isMaint = process.env.NEXT_PUBLIC_IS_MAINT_MODE || "false";
  const siteTitle = process.env.NEXT_PUBLIC_SHORT_TITLE || "DNA";
  const isHomepage = pathname === "/" || pathname === "/home";

  useEffect(() => {
    const handleStart = () => setIsLoading(true);
    const handleComplete = () => setIsLoading(false);
    Router.events.on("routeChangeStart", handleStart);
    Router.events.on("routeChangeComplete", handleComplete);
    Router.events.on("routeChangeError", handleComplete);
    return () => {
      Router.events.off("routeChangeStart", handleStart);
      Router.events.off("routeChangeComplete", handleComplete);
      Router.events.off("routeChangeError", handleComplete);
    };
  }, []);

  const {
    data: cartData,
    isLoading: cartIsLoading,
    isError: cartHasError
  } = useCart();

  const { data: favoritesData } = useFavorites(1);

  const cartItemCount = cartData ? cartData?.data?.attributes?.item_count : 0;
  const favoritesCount = favoritesData?.meta?.total_count || 0;

  if (isMaint && isMaint === "true") {
    return null;
  }

  useEffect(() => {
    console.log(user && user.data.attributes);
  }, []);

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full !rounded-none",
      isHomepage ? "bg-transparent border-b border-transparent" : "glass-panel border-b border-glass-border"
    )}>
      {/* Top Header */}
      <div className="relative flex flex-row items-center justify-center pt-4 pb-3 sm:py-3">
        {/* Left Side - Social Links */}
        {!isMobile && (
          <div className="absolute left-2.5 z-[2] flex items-center justify-between sm:left-2.5">
            <SocialLinks darkMode={darkMode} />
          </div>
        )}

        {/* Center - Beeper Logo (hidden on homepage) */}
        {!isHomepage && (
          <div className="flex cursor-pointer items-center justify-center">
            <Link
              href="/"
              className="no-underline transition-opacity hover:opacity-80 flex flex-col items-center gap-0"
            >
              <AnimatedLogo className="h-[42px] w-auto" animate={true} showTagline={false} />
              <span
                className="text-[7px] leading-none tracking-[0.15em] text-white uppercase -mt-[6px]"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                PLAY WITH MUSIC
              </span>
            </Link>
          </div>
        )}

        {/* Right Side */}
        <div className="absolute right-2.5 z-[2] flex w-auto flex-row items-center justify-between sm:justify-end">
          {isMobile ? null : <SearchBar darkMode={darkMode} />}

          {user ? (
            <div className="mx-5 hidden flex-row items-center justify-around sm:flex">
              {/* Account Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="mx-2.5 flex cursor-pointer items-center justify-center font-title text-title-sm text-white hover:text-neon-cyan transition-colors border-none bg-transparent outline-none">
                    {user.data.attributes.email}
                    <ChevronDown className="ml-1 h-5 w-5 text-white hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="glass-panel w-[160px] p-5 font-title text-right"
                >
                  <DropdownMenuItem asChild>
                    <Link
                      href="/account"
                      className={cn(
                        "cursor-pointer no-underline",
                        pathname === "/account"
                          ? "pointer-events-none text-neon-cyan"
                          : "text-white hover:text-neon-cyan"
                      )}
                    >
                      My Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/account/favorites"
                      className={cn(
                        "cursor-pointer no-underline",
                        pathname === "/account/favorites"
                          ? "pointer-events-none text-neon-cyan"
                          : "text-white hover:text-neon-cyan"
                      )}
                    >
                      My Favorites
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/account/orders"
                      className={cn(
                        "cursor-pointer no-underline",
                        pathname === "/account/orders"
                          ? "pointer-events-none text-neon-cyan"
                          : "text-white hover:text-neon-cyan"
                      )}
                    >
                      My Orders
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/account/settings"
                      className={cn(
                        "cursor-pointer no-underline",
                        pathname === "/account/settings"
                          ? "pointer-events-none text-neon-cyan"
                          : "text-white hover:text-neon-cyan"
                      )}
                    >
                      Account Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-white hover:text-neon-cyan">
                    Need Help?
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-glass-border" />
                  <DropdownMenuItem
                    className="cursor-pointer text-white hover:text-neon-cyan"
                    onSelect={logout}
                  >
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Favorites */}
              <Link
                href="/account/favorites"
                className={cn(
                  "relative no-underline transition-colors",
                  pathname === "/account/favorites"
                    ? "pointer-events-none text-neon-cyan"
                    : "text-white hover:text-neon-cyan"
                )}
              >
                <Heart className="mr-3 hidden h-5 w-5 sm:block" />
                {favoritesCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -right-1 -top-2 hidden h-5 min-w-[20px] items-center justify-center px-1 text-[10px] sm:flex"
                  >
                    {favoritesCount}
                  </Badge>
                )}
              </Link>
            </div>
          ) : (
            <div className="mx-5 hidden flex-row justify-around sm:flex">
              <Link
                href="/login"
                className={cn(
                  "mx-2.5 font-title text-title-md no-underline transition-colors",
                  pathname === "/login"
                    ? "pointer-events-none cursor-default text-neon-cyan"
                    : "text-white hover:text-neon-cyan"
                )}
              >
                LOGIN
              </Link>
              <Link
                href="/signup"
                className={cn(
                  "mx-2.5 font-title text-title-md no-underline transition-colors",
                  pathname === "/signup"
                    ? "pointer-events-none cursor-default text-neon-cyan"
                    : "text-white hover:text-neon-cyan"
                )}
              >
                SIGN UP
              </Link>
            </div>
          )}

          {/* Cart */}
          <div className="mr-2 relative text-white">
            <CartSidebar isVisible={cartVisible} toggle={toggleCart} />
            {cartItemCount > 0 && (
              <Badge className="absolute -right-2 -top-1 flex h-5 min-w-[20px] items-center justify-center bg-neon-cyan text-surface-deep px-1 text-[10px] font-bold">
                {cartItemCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
