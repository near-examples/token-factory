import React from "react";
import DefaultTokenIcon from "../../../../default-token.png";
import Big from "big.js";
import ls from "local-storage";
import * as nearAPI from "near-api-js";
import styles from "./TokensSection.module.css";
import PaginationBox from "../../../../components/elements/PaginationBox";
import Table from "../../../../components/elements/Table";
export const ContractName = "tkn.near";
const SimplePool = "SIMPLE_POOL";
const RefContractId = "v2.ref-finance.near";
const ExplorerBaseUrl = "https://explorer.near.org";
const wNEAR = "wrap.near";
export const OneNear = Big(10).pow(24);
const TGas = Big(10).pow(12);
export const BoatOfGas = Big(200).mul(TGas);
const RefStorageDeposit = Big(250).mul(Big(10).pow(19)).add(1);
const StorageDeposit = Big(125).mul(Big(10).pow(19));
const PoolStorageDeposit = Big(500).mul(Big(10).pow(19));

const SortedByLiquidity = "liquidity";
const SortedByYourTokens = "your";
const SortedByIndex = "index";
const rowsPerPage = 20;

const ot = (pool, token) =>
  token in pool.tokens ? pool.tt[1 - pool.tt.indexOf(token)] : null;

export const toTokenAccountId = (tokenId) =>
  `${tokenId.toLowerCase()}.${ContractName}`;

class TokensSection extends React.Component {
  constructor(props) {
    super(props);
    this.tokens = ls.get(props.lsKeyCachedTokens) || [];
    this.lsKey = props.lsKey;
    this.lsKeySortedBy = this.lsKey + "sortedBy";
    this.balances = {};

    this.state = {
      tokens: [...this.tokens],
      prices: {},
      liquidity: {},
      bestPool: {},
      sortedBy: ls.get(this.lsKeySortedBy) || SortedByLiquidity,
    };
    this.columns = [
      {
        Header: "Icon",
        accessor: "icon",
        Cell: ({ row }) => (
          <img
            className="rounded token-icon"
            src={row.original.metadata.icon || DefaultTokenIcon}
            alt="Icon"
          />
        ),
      },
      {
        Header: "Symbol",
        accessor: "token_id",
        Cell: ({ row }) => (
          <a
            href={`${ExplorerBaseUrl}/accounts/${row.original.metadata.symbol.toLowerCase()}.${ContractName}`}
          >
            {row.original.metadata.symbol}
          </a>
        ),
      },
      {
        Header: () => <span style={{ whiteSpace: "nowrap" }}>Token Name</span>,
        accessor: "name",
        Cell: ({ row }) => row.original.metadata.name,
      },
      {
        Header: "Owner ID",
        accessor: "owner_id",
        Cell: ({ row }) => (
          <a href={`${ExplorerBaseUrl}/accounts/${row.original.owner_id}`}>
            {row.original.owner_id}
          </a>
        ),
      },
      {
        Header: "Total Supply",
        accessor: "total_supply",
        Cell: ({ row }) =>
            Big(row.original.total_supply)
                .div(Big(10).pow(row.original.metadata.decimals))
                .round(0, 0)
                .toFixed(0)
                .toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, " ")
      },
      /* {
        Header: 'Ref Finance',
        accessor: 'REF',
        Cell: ({row}) => {
          const liq = this.poolLiquidity(row.original.metadata.symbol);
          const bestPool = this.state.bestPool[toTokenAccountId(row.original.metadata.symbol)];
          const price = this.tokenPrice(row.original.metadata.symbol);

          return (
            <div>
              {this.poolExists(row.original.metadata.symbol) && (
                <div>
                  <a
                    className="btn btn-outline-success"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://app.ref.finance/#wrap.near|${toTokenAccountId(row.original.metadata.symbol)}`}>
                    Buy <b>{row.original.metadata.symbol}</b>
                  </a>
                </div>
              )}
              {
                liq.gt(0) ? (
                  <div>
                    <span className="text-muted">Liquidity</span> {liq.div(OneNear).toFixed(3)} <b>wNEAR</b>
                  </div>
                ) : !!props.accountId && (!!bestPool ? (
                  <a
                    className="btn btn-outline-success"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://app.ref.finance/pool/${bestPool.index}`}>
                    Add Liquidity
                  </a>
                ) : this.renderListingToken(row.original))
              }
              {!!price && (
                <div>
                  <span className="text-muted">Price</span> {price.div(Big(10).pow(row.original.metadata.decimals)).toFixed(3)} <b>{row.original.metadata.symbol}</b>
                </div>
              )}
            </div>
          )
        }
      },
      {
        Header: 'Wallet',
        accessor: 'wallet',
        Cell: ({row}) => props.accountId && <button
          className="btn btn-outline-secondary"
          onClick={() => this.registerToken(row.original.metadata.symbol)}>Add to Wallet</button>
      },*/
    ];
    this._initialized = false;
  }

  async refRegisterToken(tokenId) {
    const tokenAccountId = toTokenAccountId(tokenId);
    await this._refContract.account.signAndSendTransaction(RefContractId, [
      nearAPI.transactions.functionCall(
        "storage_deposit",
        {
          account_id: this._accountId,
          registration_only: false,
        },
        TGas.mul(5).toFixed(0),
        RefStorageDeposit.toFixed(0)
      ),
      nearAPI.transactions.functionCall(
        "register_tokens",
        {
          token_ids: [tokenAccountId],
        },
        TGas.mul(5).toFixed(0),
        0
      ),
    ]);
  }

  async registerToken(tokenId) {
    const tokenContractId = toTokenAccountId(tokenId);
    const tokenContract = new nearAPI.Contract(this._account, tokenContractId, {
      changeMethods: ["storage_deposit"],
    });
    await tokenContract.storage_deposit(
      {
        registration_only: true,
      },
      BoatOfGas.toFixed(0),
      StorageDeposit.toFixed(0)
    );
  }

  async refDepositToken(tokenAccountId) {
    const tokenContract = new nearAPI.Contract(this._account, tokenAccountId, {
      viewMethods: ["ft_balance_of"],
    });
    let amount = await tokenContract.ft_balance_of({
      account_id: this._accountId,
    });
    await this._account.signAndSendTransaction(tokenAccountId, [
      nearAPI.transactions.functionCall(
        "storage_deposit",
        {
          account_id: RefContractId,
          registration_only: true,
        },
        TGas.mul(5).toFixed(0),
        StorageDeposit.toFixed(0)
      ),
      nearAPI.transactions.functionCall(
        "ft_transfer_call",
        {
          receiver_id: RefContractId,
          amount,
          msg: "",
        },
        TGas.mul(100).toFixed(0),
        "1"
      ),
    ]);
  }

  async addSimplePool(tokenAccountId) {
    await this._refContract.add_simple_pool(
      {
        tokens: [wNEAR, tokenAccountId],
        fee: 25,
      },
      TGas.mul(30).toFixed(0),
      PoolStorageDeposit.toFixed(0)
    );
  }

  renderListingToken(token) {
    const tokenId = token.metadata.symbol;
    const tokenAccountId = toTokenAccountId(tokenId);
    if (!this._refContract) {
      return false;
    }
    if (!(tokenAccountId in this.balances)) {
      return (
        <button
          className="btn btn-outline-secondary"
          onClick={() => this.refRegisterToken(tokenId)}
        >
          Register <b>{tokenId}</b>
        </button>
      );
    }
    if (this.balances[tokenAccountId].eq(0)) {
      return (
        <button
          className="btn btn-outline-success"
          onClick={() => this.refDepositToken(tokenAccountId)}
        >
          Deposit <b>{tokenId}</b>
        </button>
      );
    }

    return (
      <button
        className="btn btn-outline-success"
        onClick={() => this.addSimplePool(tokenAccountId)}
      >
        Create <b>{tokenId}</b> pool
      </button>
    );
  }

  _init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this._account = this.props.contract.account;
    this._accountId = this._account.accountId;
    this._refContract = new nearAPI.Contract(this._account, RefContractId, {
      viewMethods: [
        "get_number_of_pools",
        "get_whitelisted_tokens",
        "storage_balance_of",
        "get_deposits",
        "get_pool",
        "get_pools",
        "get_pool_volumes",
        "get_pool_shares",
        "get_return",
        "get_owner",
      ],
      changeMethods: [
        "add_simple_pool",
        "storage_deposit",
        "register_tokens",
        "add_liquidity",
        "remove_liquidity",
        "swap",
        "withdraw",
      ],
    });

    this.refetchTokens();
    this.refreshRef();
  }

  poolExists(tokenId) {
    return toTokenAccountId(tokenId) in this.state.prices;
  }

  tokenPrice(tokenId) {
    return this.state.prices[toTokenAccountId(tokenId)];
  }

  poolLiquidity(tokenId) {
    return this.state.liquidity[toTokenAccountId(tokenId)] || Big(0);
  }

  sortTokens(tokens) {
    if (this.state.sortedBy === SortedByLiquidity) {
      tokens.sort((a, b) => {
        const liqA = this.poolLiquidity(a.metadata.symbol);
        const liqB = this.poolLiquidity(b.metadata.symbol);
        return liqB.sub(liqA).toNumber();
      });
    } else if (this.state.sortedBy === SortedByYourTokens) {
      tokens.sort((a, b) => {
        const va = a.owner_id === this._accountId ? 1 : 0;
        const vb = b.owner_id === this._accountId ? 1 : 0;
        return vb - va;
      });
    }
    return tokens;
  }

  async refetchTokens() {
    const contract = this.props.contract;
    const numTokens = await contract.get_number_of_tokens();
    const tokens = this.tokens;
    const limit = 5;
    for (let i = tokens.length; i < numTokens; i += limit) {
      const newTokens = await contract.get_tokens({ from_index: i, limit });
      tokens.push(...newTokens);
      ls.set(this.props.lsKeyCachedTokens, tokens);
      this.updateTokens();
    }
  }

  updateTokens() {
    this.setState({
      tokens: this.sortTokens([
        ...(ls.get(this.props.lsKeyCachedTokens) || []),
      ]),
    });
    ls.set(this.lsKeySortedBy, this.state.sortedBy);
  }

  async refreshRefBalances() {
    if (this._accountId) {
      const balances = await this._refContract.get_deposits({account_id: this._accountId});
      Object.keys(balances).forEach((key) => {
        balances[key] = Big(balances[key]);
      });
      this.balances = balances;
    } else {
      this.balances = {};
    }
  }

  async refreshRef() {
    await Promise.all([this.refreshRefPools(), this.refreshRefBalances()]);

    this.setState(
      {
        prices: this.ref.prices,
        liquidity: this.ref.liquidity,
        bestPool: this.ref.bestPool,
        balances: this.balances,
      },
      () => this.updateTokens()
    );
  }

  async refreshRefPools() {
    let numPools = await this._refContract.get_number_of_pools();

    const promises = [];
    const limit = 100;
    for (let i = 0; i < numPools; i += limit) {
      promises.push(this._refContract.get_pools({ from_index: i, limit }));
    }
    const rawPools = (await Promise.all(promises)).flat();
    const pools = {};
    rawPools.forEach((pool, i) => {
      if (pool.pool_kind === SimplePool) {
        const tt = pool.token_account_ids;
        const p = {
          index: i,
          tt,
          tokens: tt.reduce((acc, token, tokenIndex) => {
            acc[token] = Big(pool.amounts[tokenIndex]);
            return acc;
          }, {}),
          fee: pool.total_fee,
          shares: Big(pool.shares_total_supply),
        };
        pools[p.index] = p;
      }
    });
    this.ref = {
      pools,
    };

    const liquidity = {};

    const prices = {
      [wNEAR]: OneNear,
    };

    const bestPool = {};

    Object.values(pools).forEach((pool) => {
      if (wNEAR in pool.tokens) {
        const wNearAmount = pool.tokens[wNEAR];
        pool.otherToken = ot(pool, wNEAR);

        if (
          !(pool.otherToken in bestPool) ||
          bestPool[pool.otherToken].liquidity.lt(wNearAmount)
        ) {
          bestPool[pool.otherToken] = {
            liquidity: wNearAmount,
            index: pool.index,
          };
        }
        if (wNearAmount.lt(OneNear)) {
          return;
        }
        liquidity[pool.otherToken] = (liquidity[pool.otherToken] || Big(0)).add(
          wNearAmount
        );
        pool.price = pool.tokens[pool.otherToken]
          .mul(OneNear)
          .div(pool.tokens[wNEAR]);
        if (
          !(pool.otherToken in prices) ||
          prices[pool.otherToken].gt(pool.price)
        ) {
          prices[pool.otherToken] = pool.price;
        }
      }
    });
    this.ref.prices = prices;
    this.ref.liquidity = liquidity;
    this.ref.bestPool = bestPool;
  }

  componentDidMount() {
    if (this.props.contract) {
      this._init();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.contract) {
      this._init();
    }
  }

  filterData(data) {
    return data.filter((item) => {
      let coinName = item.metadata.name.toLowerCase();

      if (!this.props.searchText) {
        return item;
      }

      if (coinName.includes(this.props.searchText.toLowerCase())) {
        return item;
      } else {
        return null;
      }
    });
  }

  render() {
    const { isDarkMode } = this.props;

    const columns = this.columns;
    const data = this.state.tokens;
    const dataFiltered = this.filterData(data);

    const lastPageIndex = this.props.currentPage * rowsPerPage;
    const firstPageIndex = lastPageIndex - rowsPerPage;
    const currentData = dataFiltered.slice(firstPageIndex, lastPageIndex);

    return (
        <div className={ styles.root }>
            <div className={ styles.sortBlock }>
              <span className={`padding-20-20-0-0 ${ isDarkMode && 'color-white'}`}>
                 {'Sort by'}
              </span>
              <div className="btn-group" role="group" aria-label="Sorted By">
                <button
                  type="button"
                  className={`btn ${ this.state.sortedBy === SortedByLiquidity
                      ? isDarkMode ? `${ styles.darkModeButtonPrimary }` : "btn-secondary background-color-black" 
                      : isDarkMode ? `${ styles.darkModeButtonSecondary }` : 'btn'
                  }`}
                  onClick={() =>
                    this.setState({ sortedBy: SortedByLiquidity }, () =>
                      this.updateTokens()
                    )
                  }
                >
                  Liquidity
                </button>
                { this.props.isSignedIn && (
                  <button
                    type="button"
                    className={`btn ${ this.state.sortedBy === SortedByYourTokens
                        ? isDarkMode ? `${ styles.darkModeButtonPrimary }` : "btn-secondary background-color-black"
                        : isDarkMode ? `${ styles.darkModeButtonSecondary }` : 'btn'
                    }`}
                    onClick={() =>
                      this.setState({ sortedBy: SortedByYourTokens }, () =>
                        this.updateTokens()
                      )
                    }
                  >
                    Your tokens
                  </button>
                )}
                <button
                  type="button"
                  className={`btn ${ this.state.sortedBy === SortedByIndex
                      ? isDarkMode ? `${ styles.darkModeButtonPrimary }` : "btn-secondary background-color-black"
                      : isDarkMode ? `${ styles.darkModeButtonSecondary }` : 'btn'
                  }`}
                  onClick={() =>
                    this.setState({ sortedBy: SortedByIndex }, () =>
                      this.updateTokens()
                    )
                  }
                >
                  Index
                </button>
              </div>
            </div>
            <div className={ styles.tokensTableBlock }>
                <Table
                    columns={ columns }
                    data={ currentData }
                    isDarkMode={ isDarkMode }
                />
            </div>
            <div className={ styles.paginationBlock }>
                <PaginationBox
                    handlePage={ this.props.handlePage }
                    rowsPerPage={ rowsPerPage }
                    dataLength={ dataFiltered.length }
                    currentPage={ this.props.currentPage }
                    isDarkMode={ isDarkMode }
                />
            </div>
        </div>
    );
  }
}

export default React.memo(TokensSection);
