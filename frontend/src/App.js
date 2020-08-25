import "./App.css";
import React from 'react';
import * as nearAPI from 'near-api-js';
import Files from "react-files";
import BN from 'bn.js';
import { Tokens } from './Tokens.js';
import DefaultTokenIcon from './default-token.jpg';

const UploadResizeWidth = 96;
const UploadResizeHeight = 96;

const YourTokenIdKey = "your_token_id";
const OneNear = new BN("1000000000000000000000000");
const ContractName = 'tf';
const MinAccountIdLen = 2;
const MaxAccountIdLen = 64;
const ValidAccountRe = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const ValidTokenIdRe = /^[a-z\d]+$/
const GAS = new BN("100000000000000")

const fromYocto = (a) => Math.floor(a / OneNear * 1000) / 1000;

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      connected: false,
      signedIn: false,
      creating: false,
      accountId: null,
      tokenLoading: false,
      tokenAlreadyExists: false,

      tokenId: "",
      totalSupply: "1000000000",
      tokenPrecision: "1000000000000000000",
      tokenName: "",
      tokenDescription: "",
      tokenIconBase64: "",

      yourTokenDescription: null,
    };

    this._initNear().then(() => {
      this.setState({
        connected: true,
        signedIn: !!this._accountId,
        accountId: this._accountId,
      })
    })
  }

  async _initYourToken() {
    const yourTokenId = window.localStorage.getItem(YourTokenIdKey);
    if (!yourTokenId) {
      return;
    }
    window.localStorage.removeItem(YourTokenIdKey);

    let tokenDescription = await this._contract.get_token_description({token_id: yourTokenId});

    if (!tokenDescription) {
      console.log(`Creation of token "${yourTokenId}" has likely failed`);
      return;
    }

    console.log(tokenDescription);

    this.setState({
      yourTokenDescription: tokenDescription
    })
  }

  async _initNear() {
    const nearConfig = {
      networkId: 'default',
      nodeUrl: 'https://rpc.testnet.near.org',
      contractName: ContractName,
      walletUrl: 'https://wallet.testnet.near.org',
    };
    const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
    const near = await nearAPI.connect(Object.assign({ deps: { keyStore } }, nearConfig));
    this._keyStore = keyStore;
    this._nearConfig = nearConfig;
    this._near = near;

    this._walletConnection = new nearAPI.WalletConnection(near, ContractName);
    this._accountId = this._walletConnection.getAccountId();

    this._account = this._walletConnection.account();
    this._contract = new nearAPI.Contract(this._account, ContractName, {
      viewMethods: ['get_min_attached_balance', 'get_number_of_tokens', 'get_token_descriptions', 'get_token_description'],
      changeMethods: ['create_token'],
    });
    this._minAttachedBalance = await this._contract.get_min_attached_balance();
    await this._initYourToken();

  }

  handleChange(key, value) {
    const stateChange = {
      [key]: value,
    };
    if (key === 'tokenId') {
      value = value.toLowerCase().replace(/[^a-z\d]/, '');
      stateChange[key] = value;
      stateChange.tokenAlreadyExists = false;
      if (this.isValidTokenId(value)) {
        stateChange.tokenLoading = true;
        this._contract.get_token_description({token_id: value}).then((tokenDescription) => {
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
    }
    this.setState(stateChange);
  }

  isValidAccountId(tokenId) {
    return tokenId.length >= MinAccountIdLen &&
        tokenId.length <= MaxAccountIdLen &&
        tokenId.match(ValidAccountRe);
  }

  isValidTokenId(tokenId) {
    return tokenId.match(ValidTokenIdRe) && this.isValidAccountId(tokenId + '.' + ContractName);
  }

  tokenIdClass() {
    if (!this.state.tokenId || (this.isValidTokenId(this.state.tokenId) && this.state.tokenLoading)) {
      return "form-control form-control-large";
    } else if (this.isValidTokenId(this.state.tokenId)) {
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
    window.localStorage.setItem(YourTokenIdKey, this.state.tokenId);
    await this._contract.create_token({
      token_description: {
        token_id: this.state.tokenId,
        owner_id: this.state.accountId,
        total_supply: new BN(this.state.totalSupply).mul(new BN(this.state.tokenPrecision)).toString(),
        precision: this.state.tokenPrecision.toString(),
        name: this.state.tokenName || null,
        description: this.state.tokenDescription || null,
        icon_base64: this.state.tokenIconBase64 || null,
      }
    }, GAS, this._minAttachedBalance)
  }

  render() {
    const content = !this.state.connected ? (
        <div>Connecting... <span className="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span></div>
    ) : (this.state.signedIn ? (
        <div>
          <div className="float-right">
            <button
                className="btn btn-outline-secondary"
                onClick={() => this.logOut()}>Log out</button>
          </div>
          <h4>Hello, <span className="font-weight-bold">{this.state.accountId}</span>!</h4>
          <p>
            Issue a new token. It'll cost you <span className="font-weight-bold">{fromYocto(this._minAttachedBalance)} Ⓝ</span>
          </p>
          <div className="form-group">
            <label forhtml="tokenId">Token ID</label>
            <div className="input-group">
              <div className="input-group-prepend">
                <div className="input-group-text">@</div>
              </div>
              <input type="text"
                     className={this.tokenIdClass()}
                     id="tokenId"
                     placeholder="fdai"
                     disabled={this.state.creating}
                     value={this.state.tokenId}
                     onChange={(e) => this.handleChange('tokenId', e.target.value)}
              />
              <div className="input-group-append">
                <div className="input-group-text">.tf</div>
              </div>
            </div>
            <small>It'll be used to uniquely identify the token and to create an Account ID for the token</small>
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
            <label forhtml="tokenPrecision">Token Precision</label>
            <div className="input-group">
              <input type="number"
                     className="form-control form-control-large"
                     id="tokenPrecision"
                     placeholder="1000000000000000000"
                     disabled={this.state.creating}
                     value={this.state.tokenPrecision}
                     onChange={(e) => this.handleChange('tokenPrecision', e.target.value)}
              />
            </div>
            <small>Tokens operate on integer numbers. <code>1 / precision</code> is the smallest fractional value of the new token.</small>
          </div>

          <div className="form-group">
            <label forhtml="tokenName">Token Name</label>
            <div className="input-group">
              <input type="text"
                     className="form-control form-control-large"
                     id="tokenName"
                     placeholder="Fake DAI"
                     disabled={this.state.creating}
                     value={this.state.tokenName}
                     onChange={(e) => this.handleChange('tokenName', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label forhtml="tokenDescription">Token Description</label>
            <div className="input-group">
              <textarea
                  className="form-control form-control-large"
                  id="tokenDescription"
                  placeholder="Fake DAI token. It like a stable token on Ethereum, but it's not really stable, not on Ethereum."
                  disabled={this.state.creating}
                  value={this.state.tokenDescription}
                  onChange={(e) => this.handleChange('tokenDescription', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label forhtml="tokenIcon">Token Icon</label>
            <div className="input-group">
              <div>
                <img className="rounded token-icon" style={{marginRight: '1em'}} src={this.state.tokenIconBase64 || DefaultTokenIcon} alt="Token Icon"/>
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
            <div>
              <button
                  className="btn btn-success"
                  disabled={this.state.creating || !this.isValidTokenId(this.state.tokenId) || this.state.tokenLoading || this.state.tokenAlreadyExists}
                  onClick={() => this.createToken()}>Create Token ({fromYocto(this._minAttachedBalance)} Ⓝ)</button>
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
          <Tokens contract={this._contract}/>
        </div>
    );
    return (
        <div>
          <h1>Token Factory</h1>
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
