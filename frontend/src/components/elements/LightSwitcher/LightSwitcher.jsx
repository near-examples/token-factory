import React, { useEffect, useRef } from "react";
import styles from "./LightSwitcher.module.css";
import SunIcon from '../../../assets/icons/SunIcon.svg';
import MoonIcon from  '../../../assets/icons/MoonIcon.svg';


const LightSwitcher = ({ handleCheck, checked = false }) => {

    const sliderRef = useRef();

    useEffect(() => {
        if (checked) {
            sliderRef.current.classList.toggle(styles.move);
        }

        if (!checked) {
            sliderRef.current.classList.remove(styles.move);
        }
    }, [checked])

    return (
        <div className={ styles.root } onClick={ handleCheck } >
            <div
                ref={ sliderRef }
                style={{ backgroundColor: checked ? '#5F8AFA' : '#ffffff' }}
                className={`${ styles.circle } ${ styles.left }`}
            >
                <img src={ checked ? MoonIcon: SunIcon } alt='SunIcon'/>
            </div>
            <span
                className={ styles.label }
                style={{ margin: checked ? '0 30px 0 0' : '0 0 0 30px' }}
            >
                { checked ? 'Dark mode' : 'Light mode' }
            </span>
        </div>

    );
};

export default LightSwitcher;
