import React, {useEffect, useState} from "react";
import TokensSection from "./components/TokensSection/TokensSection";
import OptionsSection from "./components/OptionsSection/OptionsSection";
import SearchBarFade from "../../components/elements/SearchBarFade";
import SearchIcon from '../../assets/icons/SearchIcon.svg'
import Button from "../../components/elements/Button";
import styles from './Tokens.module.css';
import {AppConsumer} from "../../context/AppContext";
import {Colors} from "../../assets/colors/colors";


const Tokens = ({
                    state, contract, lsKey, lsKeyCachedTokens, onFilesChange,
                    onFilesError, handleChange, logOut, createToken,
                    setState, requestSignIn, requestWhitelist
                }) => {

    const {connected, accountId, signedIn} = state;

    const [searchText, setSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchText])

    const handleSearch = (e) => {
        const {value} = e.target;
        setSearchText(value);
    }

    const handlePage = (page) => {
        setCurrentPage(page);
    }

    return (
        <AppConsumer>
            {({isDarkMode}) => (
                <div>
                    <div className={`flex padding-20-40 ${isDarkMode && 'background-color-black'}`}>
                        <div className='flexBasis80'>
                            <SearchBarFade
                                icon={SearchIcon}
                                handleSearch={handleSearch}
                                isDarkMode={isDarkMode}
                            />
                        </div>
                        <div className='flexBasis20 flexCenter'>
                            <Button
                                text='Log in'
                                onClick={requestSignIn}
                                backgroundColor={ isDarkMode ? Colors.blue : Colors.black }
                                width={150}
                                height={40}
                            />
                        </div>
                    </div>
                    <div
                        className='padding-20-40'
                        style={{
                            backgroundColor: isDarkMode ? '#282828' : '#f8f8f8',
                            color: isDarkMode && '#ffffff'
                        }}
                    >
                        <OptionsSection
                            handleChange={handleChange}
                            state={state}
                            logOut={logOut}
                            onFilesChange={onFilesChange}
                            onFilesError={onFilesError}
                            createToken={createToken}
                            setState={setState}
                            requestSignIn={requestSignIn}
                            requestWhitelist={requestWhitelist}
                        />
                    </div>
                    <div className={ isDarkMode ? styles.tokensSectionDark : styles.tokensSection }>
                        {connected && <div>
                            <TokensSection
                                contract={contract}
                                lsKey={lsKey}
                                handlePage={handlePage}
                                currentPage={currentPage}
                                lsKeyCachedTokens={lsKeyCachedTokens}
                                accountId={accountId}
                                isSignedIn={signedIn}
                                searchText={searchText}
                                isDarkMode={ isDarkMode }
                            />
                        </div>}
                    </div>
                </div>
            )}
        </AppConsumer>


    )
}

export default Tokens;
