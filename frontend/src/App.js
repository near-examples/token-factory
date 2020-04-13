import "./App.css";
import React from 'react';
import * as nearlib from 'nearlib';
import * as nacl from "tweetnacl";
import WebRTC from './rtc.js';

const ContractName = 'webrtc-chat';
const MaxTimeForResponse = 60 * 1000;
const MinAccountIdLen = 2;
const MaxAccountIdLen = 64;
const ValidAccountRe = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const MediaConstraints = {
  audio: true,
  video: true
};

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      connected: false,
      signedIn: false,
      calling: false,
      accountId: null,
      receiverId: "",
      receiversKey: null,
      accountLoading: false,
      callConnected: false,
    };

    this._parseEncryptionKey()
    this._initNear().then(() => {
      this.setState({
        connected: true,
        signedIn: !!this._accountId,
        accountId: this._accountId,
      })
    })

    this.localVideoRef = React.createRef();
    this.remoteVideoRef = React.createRef();
  }

  /**
   read private key from local storage
   - if found, recreate the related key pair
   - if not found, create a new key pair and save it to local storage
   */
  _parseEncryptionKey() {
    const keyKey = "enc_key:";
    let key = localStorage.getItem(keyKey);
    if (key) {
      const buf = Buffer.from(key, 'base64');
      if (buf.length !== nacl.box.secretKeyLength) {
        throw new Error("Given secret key has wrong length");
      }
      key = nacl.box.keyPair.fromSecretKey(buf);
    } else {
      key = new nacl.box.keyPair();
      localStorage.setItem(keyKey, Buffer.from(key.secretKey).toString('base64'));
    }
    this._key = key;
  }

  async _updateEncryptionPublicKey() {
    const key = Buffer.from(this._key.publicKey).toString('base64');

    const currentKey = await this._contract.get_key({account_id: this._accountId});
    if (currentKey !== key) {
      console.log(`Updating public encryption key to ${key}`);
      await this._contract.set_key({key});
    } else {
      console.log(`Current public encryption key is up to date: ${key}`);
    }
  }

  async _initNear() {
    const nearConfig = {
      networkId: 'default',
      nodeUrl: 'https://rpc.nearprotocol.com',
      contractName: ContractName,
      walletUrl: 'https://wallet.nearprotocol.com',
    };
    const keyStore = new nearlib.keyStores.BrowserLocalStorageKeyStore();
    const near = await nearlib.connect(Object.assign({ deps: { keyStore } }, nearConfig));
    this._keyStore = keyStore;
    this._nearConfig = nearConfig;
    this._near = near;

    this._walletConnection = new nearlib.WalletConnection(near, "webrtc-chat");
    this._accountId = this._walletConnection.getAccountId();

    if (!!this._accountId) {
      this._account = this._walletConnection.account();
      this._contract = new nearlib.Contract(this._account, ContractName, {
        viewMethods: ['get_key', 'get_request', 'get_response'],
        changeMethods: ['set_key', 'request', 'respond'],
      });
      await this._updateEncryptionPublicKey();
    }
  }

  handleChange(key, value) {
    const stateChange = {
      [key]: value,
    };
    if (key === 'receiverId') {
      value = value.toLowerCase().replace(/[^a-z0-9\-_.]/, '');
      stateChange[key] = value;
      stateChange.receiversKey = null;
      if (this.isValidAccount(value)) {
        stateChange.accountLoading = true;
        this._contract.get_key({account_id: value}).then((receiversKey) => {
          if (this.state.receiverId === value) {
            this.setState({
              accountLoading: false,
              receiversKey,
            })
          }
        }).catch((e) => {
          if (this.state.receiverId === value) {
            this.setState({
              accountLoading: false,
            })
          }
        })
      }
    }
    this.setState(stateChange);
  }

  isValidAccount(accountId) {
    return accountId.length >= MinAccountIdLen &&
        accountId.length <= MaxAccountIdLen &&
        accountId.match(ValidAccountRe);
  }

  receiverClass() {
    if (!this.state.receiverId || (this.isValidAccount(this.state.receiverId) && this.state.accountLoading)) {
      return "form-control form-control-large";
    } else if (this.isValidAccount(this.state.receiverId) && this.state.receiversKey) {
      return "form-control form-control-large is-valid";
    } else {
      return "form-control form-control-large is-invalid";
    }
  }

  async requestSignIn() {
    const appTitle = 'WebRTC Chat';
    await this._walletConnection.requestSignIn(
        ContractName,
        appTitle
    )
  }

  /**
   unbox encrypted messages with our secret key
   @param {string} msg64 encrypted message encoded as Base64
   @param {Uint8Array} theirPublicKey the public key to use to verify the message
   @return {string} decoded contents of the box
   */
  decryptBox(msg64, theirPublicKey64) {
    const theirPublicKey = Buffer.from(theirPublicKey64, 'base64');
    if (theirPublicKey.length !== nacl.box.publicKeyLength) {
      throw new Error("Given encryption public key is invalid.");
    }
    const buf = Buffer.from(msg64, 'base64');
    const nonce = new Uint8Array(nacl.box.nonceLength);
    buf.copy(nonce, 0, 0, nonce.length);
    const box = new Uint8Array(buf.length - nacl.box.nonceLength);
    buf.copy(box, 0, nonce.length);
    const decodedBuf = nacl.box.open(box, nonce, theirPublicKey, this._key.secretKey);
    return Buffer.from(decodedBuf).toString()
  }

  /**
   box an unencrypted message with their public key and sign it with our secret key
   @param {string} str the message to wrap in a box
   @param {Uint8Array} theirPublicKey the public key to use to encrypt the message
   @returns {string} base64 encoded box of incoming message
   */
  encryptBox(str, theirPublicKey64) {
    const theirPublicKey = Buffer.from(theirPublicKey64, 'base64');
    if (theirPublicKey.length !== nacl.box.publicKeyLength) {
      throw new Error("Given encryption public key is invalid.");
    }
    const buf = Buffer.from(str);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const box = nacl.box(buf, nonce, theirPublicKey, this._key.secretKey);

    const fullBuf = new Uint8Array(box.length + nacl.box.nonceLength);
    fullBuf.set(nonce);
    fullBuf.set(box, nacl.box.nonceLength);
    return Buffer.from(fullBuf).toString('base64')
  }

  async initCall() {
    const receiverId = this.state.receiverId;
    const receiversKey = this.state.receiversKey;
    this.setState({
      calling: true,
    });

    this.webrtc = new WebRTC();
    this.webrtc.addOnTrackListener((e) => {
      console.log("got remote streams", e);
      if (this.remoteVideoRef.current.srcObject !== e.streams[0]) {
        this.remoteVideoRef.current.srcObject = e.streams[0];
        this.remoteVideoRef.current.play();
      }
    });

    const stream = await navigator.mediaDevices.getUserMedia(MediaConstraints);
    this.localVideoRef.current.srcObject = stream;
    this.localVideoRef.current.play();

    this.webrtc.addStream(stream);

    try {
      // First check if they called us first
      const theirRequestEncoded = await this._contract.get_request({
        from_account_id: receiverId,
        to_account_id: this._accountId,
      });

      if (theirRequestEncoded) {
        // decoding
        const theirRequest = JSON.parse(this.decryptBox(theirRequestEncoded, receiversKey));
        console.log(theirRequest);
        if (theirRequest) {
          const theirTime = theirRequest.time || 0;
          if (theirTime + MaxTimeForResponse > new Date().getTime()) {
            const offer = theirRequest.offer;
            console.log("Remote offer: ", offer);
            const answer = await this.webrtc.createAnswer(offer);
            console.log("Local answer: ", answer);
            // Publishing answer
            const response = this.encryptBox(JSON.stringify({
              answer,
              time: new Date().getTime(),
            }), receiversKey);
            await this._contract.respond({
              to_account_id: receiverId,
              response,
            });
            this.setState({
              callConnected: true,
            })
            return;
          }
        }
      }
    } catch (e) {
      console.log("Failed to parse request", e);
    }

    // Sending a new request
    const offer = await this.webrtc.createOffer();
    console.log("Local offer: ", offer);
    const requestTime = new Date().getTime();
    const request = this.encryptBox(JSON.stringify({
      offer,
      time: requestTime,
    }), receiversKey);
    await this._contract.request({
      to_account_id: receiverId,
      request,
    });

    this.setState({
      awaitingResponse: true,
    })

    // Sent request, now need to check for the answer.
    while (this.state.calling && requestTime + MaxTimeForResponse > new Date().getTime()) {
      try {
        const theirResponseEncoded = await this._contract.get_response({
          from_account_id: this._accountId,
          to_account_id: receiverId,
        });

        if (theirResponseEncoded) {
          // decoding
          const theirResponse = JSON.parse(this.decryptBox(theirResponseEncoded, receiversKey));
          console.log(theirResponse);
          if (theirResponse) {
            const answer = theirResponse.answer;
            console.log("Remote answer: ", answer);
            await this.webrtc.onAnswer(answer);
            this.setState({
              callConnected: true,
              awaitingResponse: false,
            })
            return;
          }
        }
      } catch (e) {
        console.log("Failed to get response", e);
        this.setState({
          awaitingResponse: false,
          calling: false,
        })
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.setState({
      awaitingResponse: false,
      calling: false,
    })

    this.hangUp();
  }

  hangUp() {
    if (this.state.calling) {
      this.webrtc.close();
      this.webrtc = null;
      this.localVideoRef.current.pause();
      this.setState({
        calling: false,
      })
    }
  }

  async localCall() {
    const local = new WebRTC();
    const remote = new WebRTC();

    local.addOnTrackListener((e) => console.log("local", e));
    remote.addOnTrackListener((e) => {
      console.log("remote", e);
      if (this.remoteVideoRef.current.srcObject !== e.streams[0]) {
        this.remoteVideoRef.current.srcObject = e.streams[0];
        this.remoteVideoRef.current.play();
      }
    });

    const stream = await navigator.mediaDevices.getUserMedia(MediaConstraints);
    this.localVideoRef.current.srcObject = stream;
    this.localVideoRef.current.play();

    local.addStream(stream);

    const offer = await local.createOffer();
    console.log(offer);
    const answer = await remote.createAnswer(offer);
    console.log(answer);

    await local.onAnswer(answer);
  }

  render() {
    const content = !this.state.connected ? (
        <div>Connecting... <span className="spinner-grow spinner-grow-sm" role="status" aria-hidden="true"></span></div>
    ) : (this.state.signedIn ? (
        <div>
          <h3>Hello, {this.state.accountId}</h3>
          <div className="form-group">
            <label className="sr-only" htmlFor="toAccountId">Video Call</label>
            <div className="input-group">
              <div className="input-group-prepend">
                <div className="input-group-text">@</div>
              </div>
              <input type="text"
                     className={this.receiverClass()}
                     id="toAccountId"
                     placeholder="eugenethedream"
                     disabled={this.state.calling}
                     value={this.state.receiverId}
                     onChange={(e) => this.handleChange('receiverId', e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <div>
              <button
                  className="btn btn-success"
                  disabled={this.state.calling || !this.isValidAccount(this.state.receiverId) || !this.state.receiversKey}
                  onClick={() => this.initCall()}>Initiate Video Call</button>
              <span> </span>
              <button
                  className="btn btn-danger"
                  disabled={!this.state.calling}
                  onClick={() => this.hangUp()}>Hang up</button>
            </div>
          </div>
          <hr/>
          <video className="local-video" ref={this.localVideoRef} playsInline muted></video>
          <video className="remote-video" ref={this.remoteVideoRef} playsInline ></video>
        </div>
    ) : (
        <div>
          <button
              className="btn btn-primary"
              onClick={() => this.requestSignIn()}>Log in with NEAR Wallet</button>
        </div>
    ));
    return (
        <div>
          <h1>WebRTC Chat</h1>
          {content}
        </div>
    );
  }
}

export default App;
