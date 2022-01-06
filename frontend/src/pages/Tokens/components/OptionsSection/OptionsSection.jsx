import Button from "../../../../components/elements/Button";
import { OneNear } from "../../../../components/Tokens/Tokens";
import Files from "react-files";
import React from "react";
import Big from "big.js";

const MinAccountIdLen = 2;
const MaxAccountIdLen = 64;
const ValidAccountRe = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const ValidTokenIdRe = /^[a-z\d]+$/;
const fromYocto = (a) => a && Big(a).div(OneNear).toFixed(6);
const ContractName = "tkn.near";

const OptionsSection = ({ handleChange, state, logOut,
                            onFilesChange,
                            onFilesError, createToken, setState,
                            requestSignIn,
                            requestWhitelist}) => {

    const isValidAccountId = (accountId) => {
        return (
            accountId.length >= MinAccountIdLen &&
            accountId.length <= MaxAccountIdLen &&
            accountId.match(ValidAccountRe)
        );
    }

    const isValidTokenId = (tokenId) => {
        tokenId = tokenId.toLowerCase();
        return (
            tokenId.match(ValidTokenIdRe) &&
            isValidAccountId(tokenId + "." + ContractName)
        );
    }

    const tokenIdClass = () => {
        if (
            !state.tokenId ||
            (isValidTokenId(state.tokenId) && state.tokenLoading)
        ) {
            return "form-control form-control-large";
        } else if (
            isValidTokenId(state.tokenId) &&
            !state.tokenAlreadyExists
        ) {
            return "form-control form-control-large is-valid";
        } else {
            return "form-control form-control-large is-invalid";
        }
    }

    const ownerIdClass = () => {
        if (
            !state.ownerId ||
            (isValidAccountId(state.ownerId) && state.accountLoading)
        ) {
            return "form-control form-control-large";
        } else if (
            isValidAccountId(state.ownerId) &&
            state.accountExists
        ) {
            return "form-control form-control-large is-valid";
        } else {
            return "form-control form-control-large is-invalid";
        }
    }

    return !state.connected && state.creating ? (
        <div>
            <div>
                Creating your token...
                <span
                    className="spinner-grow spinner-grow-lg"
                    role="status"
                    aria-hidden="true"
                ></span>
            </div>
        </div>
    ) : !state.connected ? (
        <div>
            Connecting...
            <span
                className="spinner-grow spinner-grow-sm"
                role="status"
                aria-hidden="true"
            ></span>
        </div>
    ) : state.readyForWalletWhitelist ? (
        <div>
            <div className="alert alert-success" role="alert">
                The token <b>{ state.tokenId }</b> was successfully created!
            </div>
            <div>
                <button
                    className="btn btn-success"
                    onClick={ () => requestWhitelist(state.tokenId) }
                >
                    Add <b>{ state.tokenId }</b> to your NEAR Wallet
                </button>
            </div>
        </div>
    ) : state.signedIn ? (
        <div>
            <div className="float-right">
                <Button onClick={() => logOut()} text={"Log out"}/>
            </div>
            <h4>
                Hello,
                <span className="font-weight-bold">{ state.accountId }</span>!
            </h4>
            { state.expandCreateToken ? (
                <div>
                    <p>
                        Issue a new token. It'll cost you
                        <span className="font-weight-bold">
                            { fromYocto( state.requiredDeposit) } Ⓝ
                        </span>
                    </p>
                    <div className="form-group">
                        <label forhtml="tokenName">Token Name</label>
                        <div className="input-group">
                            <input
                                type="text"
                                className="form-control form-control-large"
                                id="tokenName"
                                placeholder="Epic Moon Rocket"
                                disabled={ state.creating }
                                value={ state.tokenName }
                                onChange={(e) =>
                                    handleChange("tokenName", e.target.value)
                                }
                            />
                        </div>
                        <small>
                            The token name may be used to display the token in the UI
                        </small>
                    </div>
                    <div className="form-group">
                        <label forhtml="tokenId">Token Symbol</label>
                        <div className="input-group">
                            <input
                                type="text"
                                className={ tokenIdClass() }
                                id="tokenId"
                                placeholder="MOON"
                                disabled={ state.creating }
                                value={ state.tokenId }
                                onChange={(e) =>
                                    handleChange("tokenId", e.target.value)
                                }
                            />
                        </div>
                        { state.tokenAlreadyExists && (
                            <div>
                                <small>
                                    <b>Token Symbol already exists.</b>
                                </small>
                            </div>
                        )}
                        <small>
                            It'll be used to identify the token and to create an Account
                            ID for the token
                            <code>
                                { state.tokenId
                                    ? state.tokenId.toLowerCase() + "." + ContractName
                                    : ""}
                            </code>
                        </small>
                    </div>
                    <div className="form-group">
                        <label forhtml="totalSupply">Total Supply</label>
                        <div className="input-group">
                            <input
                                type="number"
                                className="form-control form-control-large"
                                id="totalSupply"
                                placeholder="1000000000"
                                disabled={ state.creating }
                                value={ state.totalSupply }
                                onChange={(e) =>
                                    handleChange("totalSupply", e.target.value)
                                }
                            />
                        </div>
                        <small>This is a total number of tokens to mint.</small>
                    </div>
                    <div className="form-group">
                        <label forhtml="tokenDecimals">Token Decimals</label>
                        <div className="input-group">
                            <input
                                type="number"
                                className="form-control form-control-large"
                                id="tokenDecimals"
                                placeholder="18"
                                disabled={ state.creating }
                                value={ state.tokenDecimals }
                                onChange={(e) =>
                                    handleChange("tokenDecimals", e.target.value)
                                }
                            />
                        </div>
                        <small>
                            Tokens operate on integer numbers.
                            <code>1 / 10**{ state.tokenDecimals }</code> is the
                            smallest fractional value of the new token.
                        </small>
                    </div>
                    <div className="form-group">
                        <label forhtml="tokenIcon">Token Icon</label>
                        <div className="input-group">
                            <div>
                                { state.tokenIconBase64 && (
                                    <img
                                        className="rounded token-icon"
                                        style={{ marginRight: "1em" }}
                                        src={ state.tokenIconBase64 }
                                        alt="Token Icon"
                                    />
                                )}
                            </div>
                            <div>
                                <Files
                                    id="tokenIcon"
                                    className="form-control form-control-large btn btn-outline-primary"
                                    onChange={(f) => onFilesChange(f)}
                                    onError={(e, f) => onFilesError(e, f)}
                                    multiple={ false }
                                    accepts={["image/*"]}
                                    minFileSize={ 1 }
                                    clickable
                                >
                                    Click to upload Token Icon
                                </Files>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label forhtml="ownerId">Owner Account ID</label>
                        <div className="input-group">
                            <input
                                type="text"
                                className={ ownerIdClass() }
                                id="ownerId"
                                placeholder={ state.accountId }
                                disabled={ state.creating }
                                value={ state.ownerId }
                                onChange={(e) =>
                                    handleChange("ownerId", e.target.value)
                                }
                            />
                        </div>
                        {!state.accountExists && (
                            <div>
                                <small>
                                    <b>Account doesn't exists.</b>
                                </small>
                            </div>
                        )}
                        <small>
                            This account will own the total supply of the newly created
                            token
                        </small>
                    </div>
                    <div className="form-group">
                        <div>
                            <button
                                className="btn btn-success"
                                disabled={
                                    state.creating ||
                                    !isValidTokenId(state.tokenId) ||
                                    state.tokenLoading ||
                                    state.tokenAlreadyExists
                                }
                                onClick={ () => createToken() }
                            >
                                Create Token ({ fromYocto(state.requiredDeposit) } Ⓝ)
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="padding-10-0">
                    <Button
                        text={"Expand token creation form"}
                        onClick={() => setState({ expandCreateToken: true })}
                    />
                </div>
            )}
            <hr/>
        </div>

    ) : (
        <div />
    );
}

export default OptionsSection;
