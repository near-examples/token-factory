import {useTable} from "react-table";
import BTable from "react-bootstrap/Table";
import React, {Fragment} from "react";
import styles from './Table.module.css';
import {Colors} from "../../../assets/colors/colors";

const Table = ({columns, data, isDarkMode = false}) => {
    // Use the state and functions returned from useTable to build your UI
    const {getTableProps, headerGroups, rows, prepareRow} = useTable({
        columns,
        data,
    });

    return (
        <div className={styles.root}>
            <BTable striped bordered hover {...getTableProps()}>
                <thead style={{
                    backgroundColor: isDarkMode && Colors.lightBlack,
                    color: isDarkMode && Colors.white
                }}>
                { headerGroups.map((headerGroup, key) => (
                    <Fragment key={ key } >
                        <tr {...headerGroup.getHeaderGroupProps()}>
                            { headerGroup.headers.map((column, key) => (
                                <th key={ key } {...column.getHeaderProps()}>{ column.render("Header") }</th>
                            ))}
                        </tr>
                        <tr className={styles.spacer}/>
                    </Fragment>
                ))}
                </thead>
                <tbody>
                { rows.map((row, key) => {
                    prepareRow(row);
                    return (
                        <Fragment key={ key } >
                            <tr {...row.getRowProps()}>
                                { row.cells.map((cell, key) => {
                                    return (
                                        <td
                                            key={ key }
                                            style={{
                                                backgroundColor: isDarkMode && Colors.lightBlack,
                                                color: isDarkMode && Colors.white
                                            }}
                                            {...cell.getCellProps()}
                                        >
                                            { cell.render("Cell") }
                                        </td>);
                                })}
                            </tr>
                            <tr className={styles.spacer}/>
                        </Fragment>
                    );
                })}
                </tbody>
            </BTable>
        </div>
    );
};

export default Table;
