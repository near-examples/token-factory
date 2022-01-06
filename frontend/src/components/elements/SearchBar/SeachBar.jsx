import React from "react";
import styles from "./SearchBar.module.css";

const SearchBar = ({ handleSearch, value }) => {
  return (
    <div className={styles.root}>
      <input
        type="text"
        onChange={handleSearch}
        value={value}
        placeholder="Search"
      />
    </div>
  );
};

export default SearchBar;
