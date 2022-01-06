import React from "react";
import styles from "./Switcher.module.css";

const Switcher = ({ name = "", onChange, checked = false }) => {
  return (
    <label className={styles.switch}>
      <input
        type="checkbox"
        name={name}
        onChange={onChange}
        checked={checked}
      />
      <span className={styles.slider} />
    </label>
  );
};

export default Switcher;
