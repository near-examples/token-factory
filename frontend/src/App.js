import "./App.css";
import React from 'react';
import * as nearAPI from 'near-api-js';
import Files from "react-files";
import { Tokens, ContractName } from './Tokens.js';
import Big from 'big.js';
import ls from "local-storage";

const UploadResizeWidth = 96;
const UploadResizeHeight = 96;

const OneNear = Big(10).pow(24);
const MaxU128 = Big(2).pow(128).sub(1);
const StorageDeposit = Big(125).mul(Big(10).pow(19));
const MinAccountIdLen = 2;
const MaxAccountIdLen = 64;
const ValidAccountRe = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const ValidTokenIdRe = /^[a-z\d]+$/
const TGas = Big(10).pow(12);
const BoatOfGas = Big(200).mul(TGas);

const fromYocto = (a) => a && Big(a).div(OneNear).toFixed(6);

class App extends React.Component {
  constructor(props) {
    super(props);

    this.lsKey = ContractName + ':v02:';
    this.lsKeyToken = this.lsKey + "token";
    this.lsKeyCachedTokens = this.lsKey + "cachedTokens";
    this.lsKeyCreateToken = this.lsKey + "createToken";
    this._updateRequiredDeposit = null;

    this.state = {
      connected: false,
      signedIn: false,
      creating: false,
      accountId: null,
      tokenLoading: false,
      tokenAlreadyExists: false,
      readyForWalletWhitelist: false,

      accountLoading: false,
      accountExists: true,

      tokenId: "",
      totalSupply: Big("1000000000"),
      tokenDecimals: 18,
      tokenName: "",
      tokenIconBase64: null,
      requiredDeposit: null,
    };

    this._initNear().then(() => {
      this.setState({
        connected: true,
        signedIn: !!this._accountId,
        accountId: this._accountId,
        ownerId: this._ownerId,
      })
    })
  }

  async _initYourToken() {
    const args = ls.get(this.lsKeyToken);
    if (args) {
      const createToken = ls.get(this.lsKeyCreateToken);
      if (createToken) {
        ls.remove(this.lsKeyCreateToken);
        this.setState({
          creating: true,
        });
        const requiredDeposit = await this.computeRequiredDeposit(args);
        if (requiredDeposit.eq(0)) {
          await this._contract.create_token({args}, BoatOfGas.toFixed(0));
        } else {
          this._ownerId = args.owner_id;
          this.setState({
            tokenId: args.metadata.symbol,
            totalSupply: Big(args.total_supply).div(Big(10).pow(args.metadata.decimals)),
            tokenDecimals: args.metadata.decimals,
            tokenName: args.metadata.name,
            tokenIconBase64: args.metadata.icon,
          })
          // Transaction was canceled.
        }
        ls.remove(this.lsKeyToken);
        this.setState({
          creating: false,
          readyForWalletWhitelist: true,
          tokenId: args.metadata.symbol,
          totalSupply: Big(args.total_supply).div(Big(10).pow(args.metadata.decimals)),
          tokenDecimals: args.metadata.decimals,
          tokenName: args.metadata.name,
          tokenIconBase64: args.metadata.icon,
        });
      }
    }

    this.updateRequiredDeposit();
  }

  constructArgs() {
    return {
      owner_id: this._accountId,
      total_supply: this.state.totalSupply.mul(Big(10).pow(this.state.tokenDecimals)).round(0, 0).toFixed(0),
      metadata: {
        spec: "ft-1.0.0",
        name: this.state.tokenName,
        symbol: this.state.tokenId,
        icon: this.state.tokenIconBase64,
        decimals: this.state.tokenDecimals,
      }
    }
  }

  async internalUpdateRequiredDeposit() {
    if (this._accountId) {
      const requiredDeposit = await this.computeRequiredDeposit();
      if (!requiredDeposit || requiredDeposit !== this.state.requiredDeposit) {
        this.setState({
          requiredDeposit
        })
      }
    }
  }

  updateRequiredDeposit() {
    if (this._updateRequiredDeposit) {
      clearTimeout(this._updateRequiredDeposit);
      this._updateRequiredDeposit = null;
    }
    this._updateRequiredDeposit = setTimeout(() => this.internalUpdateRequiredDeposit(), 250);
  }

  async computeRequiredDeposit(args) {
    args = args || this.constructArgs();
    return Big(await this._contract.get_required_deposit({
      args, account_id: this._accountId
    }))
  }

  async _initNear() {
    const nearConfig = {
      networkId: 'mainnet',
      nodeUrl: 'https://rpc.mainnet.near.org',
      contractName: ContractName,
      walletUrl: 'https://wallet.near.org',
    };
    const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
    const near = await nearAPI.connect(Object.assign({ deps: { keyStore } }, nearConfig));
    this._keyStore = keyStore;
    this._nearConfig = nearConfig;
    this._near = near;

    this._walletConnection = new nearAPI.WalletConnection(near, ContractName);
    this._accountId = this._walletConnection.getAccountId();
    this._ownerId = this._accountId;

    this._account = this._walletConnection.account();
    this._contract = new nearAPI.Contract(this._account, ContractName, {
      viewMethods: ['get_required_deposit', 'get_number_of_tokens', 'get_tokens', 'get_token'],
      changeMethods: ['create_token', 'storage_deposit'],
    });
    await this._initYourToken();

  }

  handleChange(key, value) {
    const stateChange = {
      [key]: value,
    };
    if (key === 'tokenDecimals') {
      value = parseInt(value);
      value = Math.max(0, Math.min(24, value));
      stateChange[key] = value;
    } else if (key === 'totalSupply') {
      value = value ? Big(value) : Big(1);
      const dec = Big(10).pow(this.state.tokenDecimals);
      const intTotalSupply = value.mul(dec).round(0, 0);
      if (intTotalSupply.lt(1)) {
        value = Big(1)
      } else if (intTotalSupply.gt(MaxU128)) {
        value = MaxU128.div(dec).round(0, 0);
      }
      stateChange[key] = value;
    } else if (key === 'tokenId') {
      value = value.replace(/[^a-zA-Z\d]/, '');
      stateChange[key] = value;
      stateChange.tokenAlreadyExists = false;
      const tokenId = value.toLowerCase();
      if (this.isValidTokenId(value)) {
        stateChange.tokenLoading = true;
        this._contract.get_token({token_id: tokenId}).then((tokenDescription) => {
          if (this.state.tokenId === value) {
            this.setState({
              tokenLoading: false,
              tokenAlreadyExists: tokenDescription !== null,
            })
          }
        }).catch((e) => {
          if (this.state.tokenId === value) {
            this.setState({
              tokenLoading: false,
            })
          }
        })
      }
    } else if (key === 'ownerId') {
      value = value.replace(/[^a-z\-_\d]/, '');
      stateChange[key] = value;
      stateChange.accountExists = true;
      if (this.isValidTokenId(value)) {
        stateChange.accountLoading = true;
        this._near.connection.provider.query(`account/${value}`, '').then((_a) => {
          if (this.state.ownerId === value) {
            this.setState({
              accountLoading: false,
            })
          }
        }).catch((e) => {
          if (this.state.ownerId === value) {
            this.setState({
              accountLoading: false,
              accountExists: false,
            })
          }
        })
      }
    }
    this.setState(stateChange, () => this.updateRequiredDeposit());
  }

  isValidAccountId(accountId) {
    return accountId.length >= MinAccountIdLen &&
      accountId.length <= MaxAccountIdLen &&
      accountId.match(ValidAccountRe);
  }

  isValidTokenId(tokenId) {
    tokenId = tokenId.toLowerCase();
    return tokenId.match(ValidTokenIdRe) && this.isValidAccountId(tokenId + '.' + ContractName);
  }

  tokenIdClass() {
    if (!this.state.tokenId || (this.isValidTokenId(this.state.tokenId) && this.state.tokenLoading)) {
      return "form-control form-control-large";
    } else if (this.isValidTokenId(this.state.tokenId) && !this.state.tokenAlreadyExists) {
      return "form-control form-control-large is-valid";
    } else {
      return "form-control form-control-large is-invalid";
    }
  }

  ownerIdClass() {
    if (!this.state.ownerId || (this.isValidAccountId(this.state.ownerId) && this.state.accountLoading)) {
      return "form-control form-control-large";
    } else if (this.isValidAccountId(this.state.ownerId) && this.state.accountExists) {
      return "form-control form-control-large is-valid";
    } else {
      return "form-control form-control-large is-invalid";
    }
  }

  async requestSignIn() {
    const appTitle = 'Token Factory';
    await this._walletConnection.requestSignIn(
        ContractName,
        appTitle
    )
  }

  async requestWhitelist(tokenId) {
    const tokenContractId = tokenId.toLowerCase() + '.' + ContractName;
    const tokenContract = new nearAPI.Contract(this._account, tokenContractId, {
      changeMethods: ['storage_deposit'],
    });
    await tokenContract.storage_deposit({
      registration_only: true,
    }, BoatOfGas.toFixed(0), StorageDeposit.toFixed(0));
  }

  async logOut() {
    this._walletConnection.signOut();
    this._accountId = null;
    this.setState({
      signedIn: !!this._accountId,
      accountId: this._accountId,
    })
  }

  async onFilesChange(f) {
    let sourceImage = new Image();
    let reader = new FileReader();

    reader.readAsDataURL(f[0]);

    sourceImage.onload = () => {
      // Create a canvas with the desired dimensions
      let canvas = document.createElement("canvas");
      const aspect = sourceImage.naturalWidth / sourceImage.naturalHeight;
      const width = Math.round(UploadResizeWidth * Math.max(1, aspect));
      const height = Math.round(UploadResizeHeight * Math.max(1, 1 / aspect));
      canvas.width = UploadResizeWidth;
      canvas.height = UploadResizeHeight;
      const ctx = canvas.getContext("2d");

      // Scale and draw the source image to the canvas
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, UploadResizeWidth, UploadResizeHeight);
      ctx.drawImage(sourceImage, (UploadResizeWidth - width) / 2, (UploadResizeHeight - height) / 2, width, height);

      // Convert the canvas to a data URL in PNG format
      const options = [
        canvas.toDataURL('image/jpeg', 0.92),
        // Disabling webp because it doesn't work on iOS.
        // canvas.toDataURL('image/webp', 0.92),
        canvas.toDataURL('image/png')
      ];
      options.sort((a, b) => a.length - b.length);

      this.handleChange('tokenIconBase64', options[0]);
    }

    reader.onload = function(event) {
      sourceImage.src = event.target.result;
    };
  }

  async onFilesError(e, f) {
    console.log(e, f);
  }

  async createToken() {
    this.setState({
      creating: true,
    });
    const args = this.constructArgs();
    const requiredDeposit = await this.computeRequiredDeposit(args);
    ls.set(this.lsKeyToken, args);
    ls.set(this.lsKeyCreateToken, true);
    await this._contract.storage_deposit({}, BoatOfGas.toFixed(0), requiredDeposit.toFixed(0));
  }

  render() {
    const content = !this.state.connected && this.state.creating ? (
      <div>
        <div>Creating your token... <span className="spinner-grow spinner-grow-lg" role="status" aria-hidden="true"></span></div>
      </div>
    ) : !this.state.connected ? (
        <div>Connecting... <span className="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span></div>
    ) : this.state.readyForWalletWhitelist ? (
      <div>
        <div className="alert alert-success" role="alert">
          The token <b>{this.state.tokenId}</b> was successfully created!
        </div>
        <div>
          <button
            className="btn btn-success"
            onClick={() => this.requestWhitelist(this.state.tokenId)}>Add <b>{this.state.tokenId}</b> to your NEAR Wallet</button>
        </div>
      </div>
    ) : (this.state.signedIn ? (
        <div>
          <div className="float-right">
            <button
                className="btn btn-outline-secondary"
                onClick={() => this.logOut()}>Log out</button>
          </div>
          <h4>Hello, <span className="font-weight-bold">{this.state.accountId}</span>!</h4>
          <p>
            Issue a new token. It'll cost you <span className="font-weight-bold">{fromYocto(this.state.requiredDeposit)} Ⓝ</span>
          </p>

          <div className="form-group">
            <label forhtml="tokenName">Token Name</label>
            <div className="input-group">
              <input type="text"
                     className="form-control form-control-large"
                     id="tokenName"
                     placeholder="Epic Moon Rocket"
                     disabled={this.state.creating}
                     value={this.state.tokenName}
                     onChange={(e) => this.handleChange('tokenName', e.target.value)}
              />
            </div>
            <small>The token name may be used to display the token in the UI</small>
          </div>

          <div className="form-group">
            <label forhtml="tokenId">Token Symbol</label>
            <div className="input-group">
              <input type="text"
                     className={this.tokenIdClass()}
                     id="tokenId"
                     placeholder="MOON"
                     disabled={this.state.creating}
                     value={this.state.tokenId}
                     onChange={(e) => this.handleChange('tokenId', e.target.value)}
              />
            </div>
            {this.state.tokenAlreadyExists && (
              <div>
                <small><b>Token Symbol already exists.</b></small>
              </div>
            )}
            <small>It'll be used to identify the token and to create an Account ID for the token <code>{this.state.tokenId ? (this.state.tokenId.toLowerCase() + '.' + ContractName) : ""}</code></small>
          </div>

          <div className="form-group">
            <label forhtml="totalSupply">Total Supply</label>
            <div className="input-group">
              <input type="number"
                  className="form-control form-control-large"
                  id="totalSupply"
                  placeholder="1000000000"
                  disabled={this.state.creating}
                  value={this.state.totalSupply}
                  onChange={(e) => this.handleChange('totalSupply', e.target.value)}
              />
            </div>
            <small>This is a total number of tokens to mint.</small>
          </div>

          <div className="form-group">
            <label forhtml="tokenDecimals">Token Decimals</label>
            <div className="input-group">
              <input type="number"
                     className="form-control form-control-large"
                     id="tokenDecimals"
                     placeholder="18"
                     disabled={this.state.creating}
                     value={this.state.tokenDecimals}
                     onChange={(e) => this.handleChange('tokenDecimals', e.target.value)}
              />
            </div>
            <small>Tokens operate on integer numbers. <code>1 / 10**{this.state.tokenDecimals}</code> is the smallest fractional value of the new token.</small>
          </div>

          <div className="form-group">
            <label forhtml="tokenIcon">Token Icon</label>
            <div className="input-group">
              <div>
                {this.state.tokenIconBase64 && (
                  <img className="rounded token-icon" style={{marginRight: '1em'}} src={this.state.tokenIconBase64} alt="Token Icon"/>
                )}
              </div>
              <div>
                <Files
                    id="tokenIcon"
                    className='form-control form-control-large btn btn-outline-primary'
                    onChange={(f) => this.onFilesChange(f)}
                    onError={(e, f) => this.onFilesError(e, f)}
                    multiple={false}
                    accepts={['image/*']}
                    minFileSize={1}
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
              <input type="text"
                     className={this.ownerIdClass()}
                     id="ownerId"
                     placeholder={this.state.accountId}
                     disabled={this.state.creating}
                     value={this.state.ownerId}
                     onChange={(e) => this.handleChange('ownerId', e.target.value)}
              />
            </div>
            {!this.state.accountExists && (
              <div>
                <small><b>Account doesn't exists.</b></small>
              </div>
            )}
            <small>This account will own the total supply of the newly created token</small>
          </div>

          <div className="form-group">
            <div>
              <button
                  className="btn btn-success"
                  disabled={this.state.creating || !this.isValidTokenId(this.state.tokenId) || this.state.tokenLoading || this.state.tokenAlreadyExists}
                  onClick={() => this.createToken()}>Create Token ({fromYocto(this.state.requiredDeposit)} Ⓝ)</button>
            </div>
          </div>
          <hr/>
        </div>
    ) : (
        <div>
          <button
              className="btn btn-primary"
              onClick={() => this.requestSignIn()}>Log in with NEAR Wallet to create a new Token</button>
        </div>
    ));
    const tokens = this.state.connected && (
        <div>
          <h3>Tokens</h3>
          <Tokens contract={this._contract} lsKeyCachedTokens={this.lsKeyCachedTokens} registerToken={(tokenId) => this.requestWhitelist(tokenId)}/>
        </div>
    );
    return (
        <div>
          <h1>Token Farm</h1>
          <div style={{minHeight: "10em"}}>
            {content}
          </div>
          <div>
            {tokens}
          </div>
        </div>
    );
  }
}


export default App;
