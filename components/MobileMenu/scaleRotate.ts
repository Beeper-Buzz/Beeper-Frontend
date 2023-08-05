import menuFactory from "./menuFactory";
import { MenuFactoryStyles } from "./types/menuFactory";

const styles: MenuFactoryStyles = {
  pageWrap(isOpen: boolean, width: string, right: boolean) {
    return {
      MozTransform: isOpen
        ? ""
        : right
        ? "translate3d(-100px, 0, -600px) rotateY(20deg)"
        : "translate3d(100px, 0, -600px) rotateY(-20deg)",
      MsTransform: isOpen
        ? ""
        : right
        ? "translate3d(-100px, 0, -600px) rotateY(20deg)"
        : "translate3d(100px, 0, -600px) rotateY(-20deg)",
      OTransform: isOpen
        ? ""
        : right
        ? "translate3d(-100px, 0, -600px) rotateY(20deg)"
        : "translate3d(100px, 0, -600px) rotateY(-20deg)",
      WebkitTransform: isOpen
        ? ""
        : right
        ? "translate3d(-100px, 0, -600px) rotateY(20deg)"
        : "translate3d(100px, 0, -600px) rotateY(-20deg)",
      transform: isOpen
        ? ""
        : right
        ? "translate3d(-100px, 0, -600px) rotateY(20deg)"
        : "translate3d(100px, 0, -600px) rotateY(-20deg)",
      transformStyle: "preserve-3d",
      transition: "all 0.5s",
      overflow: isOpen ? "" : "hidden"
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
