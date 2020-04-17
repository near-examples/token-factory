import React from 'react';
import { useTable } from 'react-table'
import BTable from 'react-bootstrap/Table';
import DefaultTokenIcon from './default-token.jpg';

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
            tokens: [],
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
        console.log(numTokens);
        const tokens = [];
        const limit = 5;
        for (let i = 0; i < numTokens; i += limit) {
            const newTokens = await contract.get_token_descriptions({from_index: 0, limit});
            tokens.push(...newTokens);
            console.log(tokens);
            this.setState({
                tokens: JSON.parse(JSON.stringify(tokens)),
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
