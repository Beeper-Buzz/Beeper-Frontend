import React from "react";
import {CrossIconProps} from "../Footer/types/interfaces/CrossIcon";

export const CrossIcon = ({ customIcon, styles, crossClassName, onClick, isOpen }:CrossIconProps) => {
  const getCrossStyle = (type:string) => {
    return {
      position: "absolute" as "absolute",
      width: 3,
      height: 14,
      transform: type === "before" ? "rotate(45deg)" : "rotate(-45deg)"
    };
  };

  let buttonWrapperStyle = {
    position: "absolute" as "absolute",
    width: 24,
    height: 24,
    right: 8,
    top: 8
  };
  
  let buttonStyle = {
    position: "absolute" as "absolute",
    left: 0,
    top: 0,
    zIndex: 1,
    width: "100%",
    height: "100%",
    margin: 0,
    padding: 0,
    border: "none",
    fontSize: 0,
    background: "transparent",
    cursor: "pointer"
  };
  
  if (customIcon) {
    let extraProps = {
      className: `bm-cross ${customIcon.props.className || ""}`.trim(),
      style: {
        ...{ width: "100%", height: "100%" },
        ...styles.bmCross
      }
    };
    
    return React.cloneElement(customIcon, extraProps);
  } else {
    return (
      <span style={{ position: "absolute", top: "6px", right: "14px" }}>
        {["before", "after"].map((type, i) => (
          <span
            key={i}
            className={`bm-cross ${crossClassName}`.trim()}
            style={{
                ...buttonWrapperStyle,
                ...styles.bmCrossButton
            }}
          >
            <button
                id="react-burger-cross-btn"
                onClick={onClick}
                style={buttonStyle}
                tabIndex={isOpen ? 0 : -1}
            >
                Close Menu
            </button>
          </span>
        ))}
      </span>
    );
  }
};

export default CrossIcon;
