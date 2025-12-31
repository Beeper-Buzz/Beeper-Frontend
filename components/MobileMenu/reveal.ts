import menuFactory from "./menuFactory";
import { MenuFactoryStyles } from "./types/menuFactory";

const styles: MenuFactoryStyles = {
  menuWrap(isOpen: boolean) {
    return {
      MozTransform: "translate3d(0, 0, 0)",
      MsTransform: "translate3d(0, 0, 0)",
      OTransform: "translate3d(0, 0, 0)",
      WebkitTransform: "translate3d(0, 0, 0)",
      transform: "translate3d(0, 0, 0)",
      zIndex: isOpen ? 1000 : -1
    };
  },

  overlay(isOpen: boolean, width: string, right: boolean) {
    return {
      zIndex: 1400,
      MozTransform: isOpen
        ? right
          ? `translate3d(-${width}, 0, 0)`
          : `translate3d(${width}, 0, 0)`
        : "translate3d(0, 0, 0)",
      MsTransform: isOpen
        ? right
          ? `translate3d(-${width}, 0, 0)`
          : `translate3d(${width}, 0, 0)`
        : "translate3d(0, 0, 0)",
      OTransform: isOpen
        ? right
          ? `translate3d(-${width}, 0, 0)`
          : `translate3d(${width}, 0, 0)`
        : "translate3d(0, 0, 0)",
      WebkitTransform: isOpen
        ? right
          ? `translate3d(-${width}, 0, 0)`
          : `translate3d(${width}, 0, 0)`
        : "translate3d(0, 0, 0)",
      transform: isOpen
        ? right
          ? `translate3d(-${width}, 0, 0)`
          : `translate3d(${width}, 0, 0)`
        : "translate3d(0, 0, 0)",
      transition: "all 0.5s",
      visibility: isOpen ? "visible" : "hidden"
    };
  },

  pageWrap(isOpen: boolean, width: string, right: boolean) {
    return {
      MozTransform: isOpen
        ? ""
        : right
        ? `translate3d(-${width}, 0, 0)`
        : `translate3d(${width}, 0, 0)`,
      MsTransform: isOpen
        ? ""
        : right
        ? `translate3d(-${width}, 0, 0)`
        : `translate3d(${width}, 0, 0)`,
      OTransform: isOpen
        ? ""
        : right
        ? `translate3d(-${width}, 0, 0)`
        : `translate3d(${width}, 0, 0)`,
      WebkitTransform: isOpen
        ? ""
        : right
        ? `translate3d(-${width}, 0, 0)`
        : `translate3d(${width}, 0, 0)`,
      transform: isOpen
        ? ""
        : right
        ? `translate3d(-${width}, 0, 0)`
        : `translate3d(${width}, 0, 0)`,
      transition: "all 0.5s",
      zIndex: 1200,
      position: "relative"
    };
  },

  burgerIcon(isOpen: boolean, width: string, right: boolean) {
    return {
      MozTransform: isOpen
        ? right
          ? `translate3d(${width}, 0, 0)`
          : `translate3d(-${width}, 0, 0)`
        : "translate3d(0, 0, 0)",
      MsTransform: isOpen
        ? right
          ? `translate3d(${width}, 0, 0)`
          : `translate3d(-${width}, 0, 0)`
        : "translate3d(0, 0, 0)",
      OTransform: isOpen
        ? right
          ? `translate3d(${width}, 0, 0)`
          : `translate3d(-${width}, 0, 0)`
        : "translate3d(0, 0, 0)",
      WebkitTransform: isOpen
        ? right
          ? `translate3d(${width}, 0, 0)`
          : `translate3d(-${width}, 0, 0)`
        : "translate3d(0, 0, 0)",
      transform: isOpen
        ? right
          ? `translate3d(${width}, 0, 0)`
          : `translate3d(-${width}, 0, 0)`
        : "translate3d(0, 0, 0)",
      transition: "all 0.1s",
      position: "relative",
      zIndex: 1300
    };
  },

  outerContainer(isOpen: boolean) {
    return {
      overflow: isOpen ? "" : "hidden"
    };
  }
};

export default menuFactory(styles);
