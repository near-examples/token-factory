import React from "react";
import styles from './NavBar.module.css';
import FaceBookIcon from '../../assets/icons/FaceBookIcon.svg';
import TelegramIcon from '../../assets/icons/TelegramIcon.svg';
import TwitterIcon from '../../assets/icons/TwitterIcon.svg';
import FaceBookDarkIcon from '../../assets/icons/FaceBookDarkIcon.svg';
import TelegramDarkIcon from '../../assets/icons/TelegramDarkIcon.svg';
import TwitterDarkIcon from '../../assets/icons/TwitterDarkIcon.svg';
import LightSwitcher from "../elements/LightSwitcher";
import {AppConsumer} from "../../context/AppContext";

const NavBar = () => {

    return (
        <AppConsumer>
            { ({isDarkMode, toggleDarkMode}) => (
                <div className={styles.root}>
                    <div>
                        <div className={styles.headerBlock}>{'TOKEN FARM'}</div>
                        <div className='spacer-25'/>
                        <div className={styles.listBlock}>
                            <ul>
                                <li>
                                    {'About'}
                                </li>
                                <li>
                                    {'FAQ'}
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className={styles.bottomBlock}>
                        <div className='flexCenter'>
                            <LightSwitcher handleCheck={toggleDarkMode} checked={isDarkMode}/>
                        </div>
                        <hr className='margin-40-0-0'/>
                        <ul>
                            <li>
                                <img src={isDarkMode ? FaceBookDarkIcon : FaceBookIcon } alt={'FaceBookIcon'}/>
                            </li>
                            <li>
                                <img src={isDarkMode ? TwitterDarkIcon : TwitterIcon} alt={'TwitterIcon'}/>
                            </li>
                            <li>
                                <img src={isDarkMode ? TelegramDarkIcon : TelegramIcon } alt={'TelegramIcon'}/>
                            </li>
                        </ul>
                        <div className={styles.bottomBodyText}>
                            {'©2021 TokenFarm. Lorem ipsum dolor sit amet, enim ' +
                            'consectetur adipiscing elit amet. Ornare nec  nunc enim ' +
                            'aliquam cras dignissim.'}
                        </div>
                    </div>
                </div>
            )}
        </AppConsumer>

    )
}

export default NavBar;
