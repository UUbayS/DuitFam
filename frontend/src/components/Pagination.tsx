import React from 'react';
import { Form, Pagination as BsPagination } from 'react-bootstrap';
import { ChevronLeft, ChevronRight } from 'react-bootstrap-icons';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    perPage: number;
    perPageOptions?: number[];
    onPerPageChange: (perPage: number) => void;
    total?: number;
}

const buildPageItems = (current: number, total: number): (number | 'ellipsis')[] => {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    const items: (number | 'ellipsis')[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) items.push('ellipsis');
    for (let p = start; p <= end; p++) items.push(p);
    if (end < total - 1) items.push('ellipsis');
    items.push(total);
    return items;
};

const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    perPage,
    perPageOptions = [20, 50, 100],
    onPerPageChange,
    total,
}) => {
    if (totalPages <= 0 && !total) return null;

    const items = buildPageItems(currentPage, Math.max(totalPages, 1));

    return (
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 py-2 px-1">
            <div className="d-flex align-items-center gap-2" style={{ fontSize: 12 }}>
                <span className="text-muted">Tampilkan</span>
                <Form.Select
                    size="sm"
                    value={perPage}
                    onChange={(e) => onPerPageChange(Number(e.target.value))}
                    style={{ width: 72, fontSize: 12, borderRadius: 8 }}
                >
                    {perPageOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </Form.Select>
                {typeof total === 'number' && (
                    <span className="text-muted">dari {total} data</span>
                )}
            </div>

            <BsPagination className="mb-0" style={{ fontSize: 12 }}>
                <BsPagination.Prev
                    disabled={currentPage <= 1}
                    onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
                >
                    <ChevronLeft size={12} />
                </BsPagination.Prev>
                {items.map((it, idx) =>
                    it === 'ellipsis' ? (
                        <BsPagination.Ellipsis key={`e-${idx}`} disabled />
                    ) : (
                        <BsPagination.Item
                            key={it}
                            active={it === currentPage}
                            onClick={() => onPageChange(it)}
                        >
                            {it}
                        </BsPagination.Item>
                    )
                )}
                <BsPagination.Next
                    disabled={currentPage >= totalPages}
                    onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
                >
                    <ChevronRight size={12} />
                </BsPagination.Next>
            </BsPagination>
        </div>
    );
};

export default Pagination;
