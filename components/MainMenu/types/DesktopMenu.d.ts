import { menuDataItem } from "../MobileMenu/types";

export interface IDesktopMenuProps {
  menusData: menuDataItem[];
  menusLoading?: boolean;
  pcMenuItemClassName?: string;
  pcWrapClassName?: string;
  onMenuItemClick?: (keyPath: string, key: string) => void;
}
