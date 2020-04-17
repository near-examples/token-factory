import React from 'react';
import { useTable } from 'react-table'
import BTable from 'react-bootstrap/Table';
import DefaultTokenIcon from './default-token.jpg';
import BN from 'bn.js';

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
                                <th {...cell.getCellProps()}>
                                    {cell.render('Cell')}
                                </th>
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
            tokens: JSON.parse(localStorage.getItem("cached_tokens") || '[]'),
        };
        this.columns = [
            {
                Header: 'Icon',
                accessor: 'icon_base64',
                Cell: ({row}) => <img className="rounded token-icon" src={row.original.icon_base64 || DefaultTokenIcon} alt="Icon"/>
            },
            {
                Header: 'ID',
                accessor: 'token_id',
                Cell: ({row}) => <a href={`https://explorer.nearprotocol.com/accounts/${row.original.token_id}.tf`}>{row.original.token_id}</a>
            },
            {
                Header: 'Name',
                accessor: 'name',
            },
            {
                Header: 'Owner ID',
                accessor: 'owner_id',
            },
            {
                Header: 'Total Supply',
                accessor: 'total_supply',
                Cell: ({row}) => new BN(row.original.total_supply).div(new BN(row.original.precision)).toString()
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
            const newTokens = await contract.get_token_descriptions({from_index: i, limit});
            tokens.push(...newTokens);
            localStorage.setItem("cached_tokens", JSON.stringify(tokens));
            console.log(tokens);
            this.setState({
                tokens: JSON.parse(localStorage.getItem("cached_tokens") || '[]'),
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
            <div>
                <Table columns={columns} data={data} />
            </div>
        );
    }
}
