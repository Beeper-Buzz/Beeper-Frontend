import menuFactory from "./menuFactory";
import { MenuFactoryStyles } from "./types/menuFactory";

const styles: MenuFactoryStyles = {
  pageWrap(isOpen: boolean, width: string, right: boolean) {
    return {
      MozTransform: isOpen
        ? ""
        : right
        ? `translate3d(-${width}, 0, 0) rotateY(15deg)`
        : `translate3d(${width}, 0, 0) rotateY(-15deg)`,
      MsTransform: isOpen
        ? ""
        : right
        ? `translate3d(-${width}, 0, 0) rotateY(15deg)`
        : `translate3d(${width}, 0, 0) rotateY(-15deg)`,
      OTransform: isOpen
        ? ""
        : right
        ? `translate3d(-${width}, 0, 0) rotateY(15deg)`
        : `translate3d(${width}, 0, 0) rotateY(-15deg)`,
      WebkitTransform: isOpen
        ? ""
        : right
        ? `translate3d(-${width}, 0, 0) rotateY(15deg)`
        : `translate3d(${width}, 0, 0) rotateY(-15deg)`,
      transform: isOpen
        ? ""
        : right
        ? `translate3d(-${width}, 0, 0) rotateY(15deg)`
        : `translate3d(${width}, 0, 0) rotateY(-15deg)`,
      transformOrigin: right ? "100% 50%" : "0% 50%",
      transformStyle: "preserve-3d",
      transition: "all 0.5s"
    };
  },

  outerContainer(isOpen: boolean) {
    return {
      perspective: "1500px",
      overflow: isOpen ? "" : "hidden"
    };
  }
};

export default menuFactory(styles);
