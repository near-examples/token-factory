import React from 'react';
import { useTable } from 'react-table'
import BTable from 'react-bootstrap/Table';
import DefaultTokenIcon from './default-token.png';
import Big from 'big.js';
import ls from "local-storage";

export const ContractName = 'tkn.near';
const ExplorerBaseUrl = 'https://explorer.near.org';

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
        ];
        this._initialized = false;
    }

    _init() {
        if (this._initialized) {
            return;
        }
        this._initialized = true;

        this.refetchTokens();
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
