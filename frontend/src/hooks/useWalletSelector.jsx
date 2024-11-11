import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupNearWallet } from "@near-wallet-selector/near-wallet";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { useMemo, useState, useEffect } from "react";
import { useCallback } from "react";

export const useWalletSelector = () => {

  const [walletModal, setWalletModal] = useState(null)
  const [walletSelector, setWalletSelector] = useState(null)
  const [isConnected, setIsConnected] = useState(false);


  // slim scan velvet demise country exchange cradle bacon panel claim bonus bundle
  setupWalletSelector({
    network: "mainnet",
    modules: [setupNearWallet(), setupMyNearWallet()],
  }).then((walletSelector) => {
    setWalletModal(setupModal(walletSelector, {
      contractId: "tkn.near",
    }));
    setWalletSelector(walletSelector);
  });

  const logOutWs = useCallback(async () => {
    if (walletSelector) {
      const wallet = await walletSelector.wallet("my-near-wallet");
      await wallet.signOut();
      setIsConnected(false);
    }
  }, [walletSelector])


  useEffect(() => {
    if (walletSelector) {
      const getAccounts = async () => {
        const wallet = await walletSelector.wallet("my-near-wallet");
        const accounts = await wallet.getAccounts();
        console.debug(accounts); // [{ accountId: "test.testnet" }]
        if (accounts.length > 0) {
          setIsConnected(true);
        }

      }
      getAccounts();

    }
  }, [walletSelector]);


  return useMemo(() => { return { walletSelector, walletModal, isConnected, logOutWs } }, [isConnected, logOutWs, walletModal, walletSelector])
}
