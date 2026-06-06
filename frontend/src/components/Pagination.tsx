import React from 'react';
import { Form } from 'react-bootstrap';
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

    const arrowBtn = (disabled: boolean, onClick: () => void, Icon: typeof ChevronLeft) => (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                color: '#999',
            }}
        >
            <Icon size={12} />
        </button>
    );

    return (
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 py-1 px-1">
            <div className="d-flex align-items-center gap-2" style={{ fontSize: 12 }}>
                <span className="text-muted">Tampilkan</span>
                <Form.Select
                    size="sm"
                    value={perPage}
                    onChange={(e) => onPerPageChange(Number(e.target.value))}
                    style={{ width: 64, fontSize: 12, borderRadius: 8 }}
                >
                    {perPageOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </Form.Select>
                {typeof total === 'number' && (
                    <span className="text-muted">dari {total} data</span>
                )}
            </div>

            <div className="d-flex align-items-center gap-1">
                {arrowBtn(
                    currentPage <= 1,
                    () => currentPage > 1 && onPageChange(currentPage - 1),
                    ChevronLeft
                )}
                {items.map((it, idx) =>
                    it === 'ellipsis' ? (
                        <span key={`e-${idx}`} style={{ fontSize: 10, padding: '0 2px', color: '#999' }}>...</span>
                    ) : (
                        <button
                            key={it}
                            type="button"
                            onClick={() => onPageChange(it)}
                            style={{
                                fontSize: 12,
                                padding: '6px 12px',
                                border: 'none',
                                background: it === currentPage ? '#007bff' : 'transparent',
                                color: it === currentPage ? '#fff' : '#666',
                                borderRadius: 4,
                                cursor: 'pointer',
                                lineHeight: 1,
                                minWidth: 20,
                                textAlign: 'center',
                            }}
                        >
                            {it}
                        </button>
                    )
                )}
                {arrowBtn(
                    currentPage >= totalPages,
                    () => currentPage < totalPages && onPageChange(currentPage + 1),
                    ChevronRight
                )}
            </div>
        </div>
    );
};

export default Pagination;
