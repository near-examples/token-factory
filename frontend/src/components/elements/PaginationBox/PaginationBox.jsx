import React, {useCallback, useEffect, useState} from "react";
import {Pagination} from "react-bootstrap";
import styles from './PaginationBox.module.css';
import '../../../assets/globals/boobstrap-restyles.css';

const PaginationBox = ({
                           handlePage,
                           rowsPerPage,
                           dataLength,
                           currentPage,
                           isDarkMode
                       }) => {
    const [pages, setPages] = useState([]);

    const createPageArr = useCallback(() => {
        let pages = [];
        const totalPages = Math.ceil(dataLength / rowsPerPage);

        for (let i = 0; i < totalPages; i++) {
            pages.push(i + 1);
        }

        setPages(pages);
    }, [rowsPerPage, dataLength]);

    useEffect(() => {
        createPageArr();
    }, [createPageArr]);

    const handlePageNext = () => {
        currentPage < pages.length
            ? handlePage(++currentPage)
            : handlePage(currentPage);
    };

    const handlePagePrev = () => {
        currentPage > 1 ? handlePage(--currentPage) : handlePage(currentPage);
    };

    return (
        <div className={ isDarkMode ? styles.rootDark : styles.root }>
            <Pagination>
                <Pagination.Prev onClick={handlePagePrev}/>
                {pages.map((item) => {
                    return (
                        <Pagination.Item
                            key={item}
                            onClick={() => handlePage(item)}
                            active={item === currentPage}
                        >
                            {item}
                        </Pagination.Item>
                    );
                })}

                <Pagination.Next onClick={handlePageNext}/>
            </Pagination>
        </div>
    );
};

export default PaginationBox;
