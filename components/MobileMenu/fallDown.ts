import menuFactory from "./menuFactory";
import { MenuFactoryStyles } from "./types/menuFactory";

const styles: MenuFactoryStyles = {
  menuWrap(isOpen: boolean) {
    return {
      MozTransform: isOpen ? "" : "translate3d(0, -100%, 0)",
      MsTransform: isOpen ? "" : "translate3d(0, -100%, 0)",
      OTransform: isOpen ? "" : "translate3d(0, -100%, 0)",
      WebkitTransform: isOpen ? "" : "translate3d(0, -100%, 0)",
      transform: isOpen ? "" : "translate3d(0, -100%, 0)",
      transition: "all 0.5s ease-in-out"
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
      transition: "all 0.5s"
    };
  },

  outerContainer(isOpen: boolean) {
    return {
      perspective: "1500px",
      perspectiveOrigin: "0% 50%",
      overflow: isOpen ? "" : "hidden"
    };
  }
};

export default menuFactory(styles);
