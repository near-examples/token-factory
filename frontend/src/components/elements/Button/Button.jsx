import React from "react";
import styles from "./Button.module.css";

const Button = ({
    className = null,
    onClick = () => {},
    text = "",
    backgroundColor = "#262626",
    textColor = "#ffffff",
    disabled = false,
    width,
    height
}) => {
  return (
    <button
      className={`${className} ${styles.root}`}
      onClick={ onClick }
      style={{ backgroundColor: backgroundColor, color: textColor, width: width, height: height }}
      disabled={disabled}
    >
      {text}
    </button>
  );
};

export default Button;
