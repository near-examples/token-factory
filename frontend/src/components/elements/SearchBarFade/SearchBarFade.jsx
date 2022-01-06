import React, {useRef} from "react";
import styles from "./SearchBarFade.module.css";
import {Colors} from "../../../assets/colors/colors";

const SearchBarFade = ({handleSearch, icon,  value, isDarkMode}) => {
    const searchRef = useRef();

    const handleFocus = () => {
        if (searchRef.current) {
             searchRef.current.focus()
        }
    }

    return (
        <div className={ styles.root }>
            { icon && <div className={ styles.searchIcon } onClick={ handleFocus }>
                <img src={ icon } alt={'SearchIcon'}/>
            </div> }
            <div className={styles.searchInput}>
                <input
                    ref={ searchRef }
                    style={{ color: isDarkMode ? Colors.white : Colors.black }}
                    type="text"
                    onChange={handleSearch}
                    value={value}
                />
            </div>
        </div>
    );
};

export default SearchBarFade;
