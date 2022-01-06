import "./App.css";
import React from "react";
import * as nearAPI from "near-api-js";
import {
  BoatOfGas,
  ContractName,
} from "./components/Tokens/Tokens.jsx";
import Big from "big.js";
import ls from "local-storage";
import { AppProvider } from "./context/AppContext";
import TokensPage from './pages/Tokens/Tokens';
import NavBar from "./components/NavBar";

const UploadResizeWidth = 96;
const UploadResizeHeight = 96;

const MaxU128 = Big(2).pow(128).sub(1);
const MinAccountIdLen = 2;
const MaxAccountIdLen = 64;
const ValidAccountRe = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const ValidTokenIdRe = /^[a-z\d]+$/;

class App extends React.Component {
  constructor(props) {
    super(props);

    this.lsKey = ContractName + ":v02:";
    this.lsKeyToken = this.lsKey + "token";
    this.lsKeyCachedTokens = this.lsKey + "cachedTokens";
    this.lsKeyCreateToken = this.lsKey + "createToken";
    this._updateRequiredDeposit = null;

    this.handleChange = this.handleChange.bind(this);
    this.logOut = this.logOut.bind(this);
    this.onFilesChange = this.onFilesChange.bind(this);
    this.onFilesError = this.onFilesError.bind(this);
    this.createToken = this.createToken.bind(this);
    this.setState = this.setState.bind(this);
    this.requestSignIn = this.requestSignIn.bind(this);

    this.state = {
      connected: false,
      signedIn: false,
      creating: false,
      accountId: null,
      tokenLoading: false,
      tokenAlreadyExists: false,
      readyForWalletWhitelist: false,
      expandCreateToken: false,

      accountLoading: false,
      accountExists: true,

      tokenId: "",
      totalSupply: Big("1000000000"),
      tokenDecimals: 18,
      tokenName: "",
      tokenIconBase64: null,
      requiredDeposit: null,
      isDarkMode: false,
      toggleDarkMode: this.toggleDarkMode
    };

    this._initNear().then(() => {
      this.setState({
        connected: true,
        signedIn: !!this._accountId,
        accountId: this._accountId,
        ownerId: this._ownerId,
      });
    });
  }

  toggleDarkMode = () => {
    this.setState({ isDarkMode: !this.state.isDarkMode })
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
          await this._contract.create_token({ args }, BoatOfGas.toFixed(0));
        } else {
          this._ownerId = args.owner_id;
          this.setState({
            tokenId: args.metadata.symbol,
            totalSupply: Big(args.total_supply).div(
              Big(10).pow(args.metadata.decimals)
            ),
            tokenDecimals: args.metadata.decimals,
            tokenName: args.metadata.name,
            tokenIconBase64: args.metadata.icon,
          });
          // Transaction was canceled.
        }
        ls.remove(this.lsKeyToken);
        this.setState({
          creating: false,
          readyForWalletWhitelist: true,
          tokenId: args.metadata.symbol,
          totalSupply: Big(args.total_supply).div(
            Big(10).pow(args.metadata.decimals)
          ),
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
      total_supply: this.state.totalSupply
        .mul(Big(10).pow(this.state.tokenDecimals))
        .round(0, 0)
        .toFixed(0),
      metadata: {
        spec: "ft-1.0.0",
        name: this.state.tokenName,
        symbol: this.state.tokenId,
        icon: this.state.tokenIconBase64,
        decimals: this.state.tokenDecimals,
      },
    };
  }

  async internalUpdateRequiredDeposit() {
    if (this._accountId) {
      const requiredDeposit = await this.computeRequiredDeposit();
      if (!requiredDeposit || requiredDeposit !== this.state.requiredDeposit) {
        this.setState({
          requiredDeposit,
        });
      }
    }
  }

  updateRequiredDeposit() {
    if (this._updateRequiredDeposit) {
      clearTimeout(this._updateRequiredDeposit);
      this._updateRequiredDeposit = null;
    }
    this._updateRequiredDeposit = setTimeout(
      () => this.internalUpdateRequiredDeposit(),
      250
    );
  }

  async computeRequiredDeposit(args) {
    args = args || this.constructArgs();
    return Big(
      await this._contract.get_required_deposit({
        args,
        account_id: this._accountId,
      })
    );
  }

  async _initNear() {
    const nearConfig = {
      networkId: "mainnet",
      nodeUrl: "https://rpc.mainnet.near.org",
      contractName: ContractName,
      walletUrl: "https://wallet.near.org",
    };
    const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
    const near = await nearAPI.connect(
      Object.assign({ deps: { keyStore } }, nearConfig)
    );
    this._keyStore = keyStore;
    this._nearConfig = nearConfig;
    this._near = near;

    this._walletConnection = new nearAPI.WalletConnection(near, ContractName);
    this._accountId = this._walletConnection.getAccountId();
    this._ownerId = this._accountId;

    this._account = this._walletConnection.account();
    this._contract = new nearAPI.Contract(this._account, ContractName, {
      viewMethods: [
        "get_required_deposit",
        "get_number_of_tokens",
        "get_tokens",
        "get_token",
      ],
      changeMethods: ["create_token", "storage_deposit"],
    });
    await this._initYourToken();
  }

  handleChange(key, value) {
    const stateChange = {
      [key]: value,
    };
    if (key === "tokenDecimals") {
      value = parseInt(value);
      value = Math.max(0, Math.min(24, value));
      stateChange[key] = value;
    } else if (key === "totalSupply") {
      value = value ? Big(value) : Big(1);
      const dec = Big(10).pow(this.state.tokenDecimals);
      const intTotalSupply = value.mul(dec).round(0, 0);
      if (intTotalSupply.lt(1)) {
        value = Big(1);
      } else if (intTotalSupply.gt(MaxU128)) {
        value = MaxU128.div(dec).round(0, 0);
      }
      stateChange[key] = value;
    } else if (key === "tokenId") {
      value = value.replace(/[^a-zA-Z\d]/, "");
      stateChange[key] = value;
      stateChange.tokenAlreadyExists = false;
      const tokenId = value.toLowerCase();
      if (this.isValidTokenId(value)) {
        stateChange.tokenLoading = true;
        this._contract
          .get_token({ token_id: tokenId })
          .then((tokenDescription) => {
            if (this.state.tokenId === value) {
              this.setState({
                tokenLoading: false,
                tokenAlreadyExists: tokenDescription !== null,
              });
            }
          })
          .catch((e) => {
            if (this.state.tokenId === value) {
              this.setState({
                tokenLoading: false,
              });
            }
          });
      }
    } else if (key === "ownerId") {
      value = value.replace(/[^a-z\-_\d]/, "");
      stateChange[key] = value;
      stateChange.accountExists = true;
      if (this.isValidTokenId(value)) {
        stateChange.accountLoading = true;
        this._near.connection.provider
          .query(`account/${value}`, "")
          .then((_a) => {
            if (this.state.ownerId === value) {
              this.setState({
                accountLoading: false,
              });
            }
          })
          .catch((e) => {
            if (this.state.ownerId === value) {
              this.setState({
                accountLoading: false,
                accountExists: false,
              });
            }
          });
      }
    }
    this.setState(stateChange, () => this.updateRequiredDeposit());
  }

  isValidAccountId(accountId) {
    return (
      accountId.length >= MinAccountIdLen &&
      accountId.length <= MaxAccountIdLen &&
      accountId.match(ValidAccountRe)
    );
  }

  isValidTokenId(tokenId) {
    tokenId = tokenId.toLowerCase();
    return (
      tokenId.match(ValidTokenIdRe) &&
      this.isValidAccountId(tokenId + "." + ContractName)
    );
  }

  async requestSignIn() {
    const appTitle = "Token Factory";
    await this._walletConnection.requestSignIn(ContractName, appTitle);
  }

  async logOut() {
    this._walletConnection.signOut();
    this._accountId = null;
    this.setState({
      signedIn: !!this._accountId,
      accountId: this._accountId,
    });
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
      ctx.drawImage(
        sourceImage,
        (UploadResizeWidth - width) / 2,
        (UploadResizeHeight - height) / 2,
        width,
        height
      );

      // Convert the canvas to a data URL in PNG format
      const options = [
        canvas.toDataURL("image/jpeg", 0.92),
        // Disabling webp because it doesn't work on iOS.
        // canvas.toDataURL('image/webp', 0.92),
        canvas.toDataURL("image/png"),
      ];
      options.sort((a, b) => a.length - b.length);

      this.handleChange("tokenIconBase64", options[0]);
    };

    reader.onload = function (event) {
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
    await this._contract.storage_deposit(
      {},
      BoatOfGas.toFixed(0),
      requiredDeposit.toFixed(0)
    );
  }

  render() {
    return (
      <div className='flex screenHeight'>
        <AppProvider value={ this.state }>
          <div className='flexBasis17'>
            <NavBar />
          </div>
          <div className='flexBasis83 fixedWrapper'>
            <TokensPage
                state={ this.state }
                contract={ this._contract }
                lsKey={ this.lsKey }
                lsKeyCachedTokens={ this.lsKeyCachedTokens }
                onFilesChange={ this.onFilesChange }
                onFilesError={ this.onFilesError }
                handleChange={ this.handleChange }
                logOut={ this.logOut }
                createToken={ this.createToken }
                setState={ this.setState }
                requestSignIn={ this.requestSignIn }
                requestWhitelist={ this.requestWhitelist }
            />
          </div>
        </AppProvider>
      </div>
    );
  }
}

export default App;
