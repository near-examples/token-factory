import React from 'react';
import { useTable } from 'react-table'
import BTable from 'react-bootstrap/Table';
import DefaultTokenIcon from './default-token.png';
import Big from 'big.js';
import ls from "local-storage";
import * as nearAPI from 'near-api-js';

export const ContractName = 'tkn.near';
const SimplePool = 'SIMPLE_POOL';
const RefContractId = 'ref-finance.near';
const ExplorerBaseUrl = 'https://explorer.near.org';
const wNEAR = 'wrap.near';
const OneNear = Big(10).pow(24);

const ot = (pool, token) => (token in pool.tokens) ? pool.tt[1 - pool.tt.indexOf(token)] : null;

export const toTokenAccountId = (tokenId) => `${tokenId.toLowerCase()}.${ContractName}`;

function Table({ columns, data }) {
    // Use the state and functions returned from useTable to build your UI
    const { getTableProps, headerGroups, rows, prepareRow } = useTable({
        columns,
        data,
    })

    // Render the UI for your table
    return (
        <BTable striped bordered hover {...getTableProps()}>
            <thead>
            {headerGroups.map(headerGroup => (
                <tr {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map(column => (
                        <th {...column.getHeaderProps()}>
                            {column.render('Header')}
                        </th>
                    ))}
                </tr>
            ))}
            </thead>
            <tbody>
            {rows.map((row, i) => {
                prepareRow(row)
                return (
                    <tr {...row.getRowProps()}>
                        {row.cells.map(cell => {
                            return (
                                <td {...cell.getCellProps()}>
                                    {cell.render('Cell')}
                                </td>
                            )
                        })}
                    </tr>
                )
            })}
            </tbody>
        </BTable>
    )
}

export class Tokens extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            tokens: ls.get(props.lsKeyCachedTokens) || [],
            prices: {},
        };
        this.columns = [
            {
                Header: 'Icon',
                accessor: 'icon',
                Cell: ({row}) => <img className="rounded token-icon" src={row.original.metadata.icon || DefaultTokenIcon} alt="Icon"/>
            },
            {
                Header: 'Symbol',
                accessor: 'token_id',
                Cell: ({row}) => <a href={`${ExplorerBaseUrl}/accounts/${row.original.metadata.symbol.toLowerCase()}.${ContractName}`}>{row.original.metadata.symbol}</a>
            },
            {
                Header: () => <span style={{whiteSpace: 'nowrap'}}>Token Name</span>,
                accessor: 'name',
                Cell: ({row}) => row.original.metadata.name
            },
            {
                Header: 'Owner ID',
                accessor: 'owner_id',
                Cell: ({row}) => <a href={`${ExplorerBaseUrl}/accounts/${row.original.owner_id}`}>{row.original.owner_id}</a>
            },
            {
                Header: 'Total Supply',
                accessor: 'total_supply',
                Cell: ({row}) => Big(row.original.total_supply).div(Big(10).pow(row.original.metadata.decimals)).round(0, 0).toFixed(0)
            },
            {
                Header: 'Wallet',
                accessor: 'wallet',
                Cell: ({row}) => props.accountId && <button
                  className="btn btn-outline-success"
                  onClick={() => props.registerToken(row.original.metadata.symbol)}>Add to Wallet</button>
            },
            {
                Header: 'Ref Finance',
                accessor: 'REF',
                Cell: ({row}) => this.poolExists(row.original.metadata.symbol) && (
                    <a
                      className="btn btn-outline-success"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://app.ref.finance/#wrap.near|${toTokenAccountId(row.original.metadata.symbol)}`}>
                        Buy <b>{row.original.metadata.symbol}</b>
                    </a>
                )
            },
        ];
        this._initialized = false;
    }

    _init() {
        if (this._initialized) {
            return;
        }
        this._initialized = true;

        this._account = this.props.contract.account;
        this._accountId = this._account.accountId;
        this._refContract = new nearAPI.Contract(this._account, RefContractId, {
            viewMethods: ['get_number_of_pools', 'get_whitelisted_tokens', 'storage_balance_of', 'get_deposits', 'get_pool', 'get_pools', 'get_pool_volumes', 'get_pool_shares', 'get_return', 'get_owner'],
            changeMethods: ['add_simple_pool', 'storage_deposit', 'register_tokens', 'add_liquidity', 'remove_liquidity', 'swap', 'withdraw'],
        });

        this.refetchTokens();
        this.refreshRefPools();
    }

    poolExists(tokenId) {
        return toTokenAccountId(tokenId) in this.state.prices;
    }

    async refetchTokens() {
        const contract = this.props.contract;
        const numTokens = await contract.get_number_of_tokens();
        const tokens = JSON.parse(JSON.stringify(this.state.tokens));
        const limit = 5;
        for (let i = tokens.length; i < numTokens; i += limit) {
            const newTokens = await contract.get_tokens({from_index: i, limit});
            tokens.push(...newTokens);
            ls.set(this.props.lsKeyCachedTokens, tokens);
            this.setState({
                tokens: ls.get(this.props.lsKeyCachedTokens) || [],
            })
        }
    }

    async refreshRefPools() {
        const numPools = await this._refContract.get_number_of_pools();
        const promises = [];
        const limit = 100;
        for (let i = 0; i < numPools; i += limit) {
            promises.push(this._refContract.get_pools({from_index: i, limit}));
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
                if (p.shares.gt(0)) {
                    pools[p.index] = p;
                }
            }
        });
        this.ref = {
            pools,
        };

        const prices = {
            [wNEAR]: OneNear,
        }

        Object.values(pools).forEach((pool) => {
            if (wNEAR in pool.tokens) {
                const wNearAmount = pool.tokens[wNEAR];
                if (wNearAmount.lt(OneNear)) {
                    return;
                }
                pool.otherToken = ot(pool, wNEAR);
                pool.price = pool.tokens[pool.otherToken].mul(OneNear).div(pool.tokens[wNEAR]);
                if (!(pool.otherToken in prices) || prices[pool.otherToken].gt(pool.price)) {
                    prices[pool.otherToken] = pool.price;
                }
            }
        });
        this.ref.prices = prices;
        this.setState({
            prices,
        })
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

    render() {
        const columns = this.columns;
        const data = this.state.tokens;
        return (
            <div className="tokens-table">
                <Table columns={columns} data={data} />
            </div>
        );
    }
}
