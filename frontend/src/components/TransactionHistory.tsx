import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Spinner, Form, Dropdown } from 'react-bootstrap';
import * as Icons from 'react-bootstrap-icons';
import { EyeFill, EyeSlashFill, Tag, PeopleFill, PersonFill, PersonWorkspace, ThreeDotsVertical, PencilSquare, Trash, Lock } from 'react-bootstrap-icons';
import { fetchTransactionHistory, fetchMonthlySummary, fetchFamilyTransactionHistory, fetchFamilyMonthlySummary } from '../services/report.service';
import type { TransactionHistoryItem, MonthlySummary } from '../types/report.types';
import { useTimeFilter } from '../hooks/useTimeFilter';
import Pagination from './Pagination';

interface TransactionHistoryProps {
    onTransactionAdded: () => void;
    openTransactionModal: () => void;
    hideAddButton?: boolean;
    onEditTransaction?: (tx: TransactionHistoryItem) => void;
    onDeleteTransaction?: (tx: TransactionHistoryItem) => void;
}

const formatRupiah = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
    return formatted.replace('Rp', 'Rp. ');
};

type ViewFilter = 'semua' | 'ortu' | 'anak';

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ onTransactionAdded, openTransactionModal, hideAddButton = false, onEditTransaction, onDeleteTransaction }) => {
    const { unit, period, changeUnit, customRange, setCustomRange } = useTimeFilter('bulan');

    const [isBalanceVisible, setIsBalanceVisible] = useState(true);

    const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
    const [summary, setSummary] = useState<MonthlySummary | null>(null);
    const [filter, setFilter] = useState<'all' | 'pemasukan' | 'pengeluaran'>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewFilter, setViewFilter] = useState<ViewFilter>('semua');

    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const periodKey = useMemo(() => JSON.stringify(period.apiParam), [period.apiParam]);

    const isParent = useMemo(() => {
        const userStr = localStorage.getItem('user');
        return userStr ? (JSON.parse(userStr).role === 'parent') : false;
    }, []);

    const loadHistoryData = useCallback(async () => {
        setLoading(true);
        try {
            if (isParent) {
                const params = {
                    ...period.apiParam,
                    group: viewFilter !== 'semua' ? viewFilter : undefined,
                    page: currentPage,
                    per_page: perPage,
                };
                const [history, monthlySummary] = await Promise.all([
                    fetchFamilyTransactionHistory(params),
                    fetchFamilyMonthlySummary(params)
                ]);
                setTransactions(history.data);
                setTotal(history.meta?.total ?? 0);
                setTotalPages(history.meta?.total_pages ?? 0);
                setSummary(monthlySummary);
            } else {
                const params = {
                    ...period.apiParam,
                    page: currentPage,
                    per_page: perPage,
                };
                const [history, monthlySummary] = await Promise.all([
                    fetchTransactionHistory(params),
                    fetchMonthlySummary(params)
                ]);
                setTransactions(history.data);
                setTotal(history.meta?.total ?? 0);
                setTotalPages(history.meta?.total_pages ?? 0);
                setSummary(monthlySummary);
            }
            setError(null);
        } catch (err) {
            console.error(err);
            setError("Gagal memuat riwayat transaksi.");
        } finally {
            setLoading(false);
        }
    }, [periodKey, viewFilter, isParent, currentPage, perPage]);

    useEffect(() => {
        loadHistoryData();
    }, [loadHistoryData, onTransactionAdded]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilter(e.target.value as 'all' | 'pemasukan' | 'pengeluaran');
        setCurrentPage(1);
    };

    const handleViewFilterChange = (v: ViewFilter) => {
        setViewFilter(v);
        setCurrentPage(1);
    };

    const handlePerPageChange = (n: number) => {
        setPerPage(n);
        setCurrentPage(1);
    };

    const totalPemasukan = summary?.totalPemasukan || 0;
    const totalPengeluaran = summary?.totalPengeluaran || 0;
    const totalNeto = summary?.neto || 0;

    const hasNoData = transactions.length === 0 && totalNeto === 0;
    const filteredTransactions = transactions.filter((tx) => {
        if (filter === 'all') return true;
        if (filter === 'pemasukan' || filter === 'pengeluaran') return tx.jenis === filter;
        return true;
    });

    return (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 20px 24px 20px', backgroundColor: 'var(--bg-history)' }}>
            
        <Card className="mb-4 border-0 shadow-sm" style={{ borderRadius: 24, overflow: 'hidden', flexShrink: 0, backgroundColor: '#ffffff' }}>
            <Card.Body className="p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: 17 }}>
                        {period.display}
                    </h5>
                    <Button variant="link" className="p-0 text-secondary shadow-none" onClick={() => setIsBalanceVisible(!isBalanceVisible)}>
                        {isBalanceVisible ? <EyeFill size={18} /> : <EyeSlashFill size={18} />}
                    </Button>
                </div>

                {loading ? (
                    <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>
                ) : (
                    <>
                        <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted" style={{ fontSize: 13 }}>Pemasukan</span>
                            <span className="fw-bold text-success" style={{ fontSize: 13 }}>
                                {isBalanceVisible ? formatRupiah(totalPemasukan) : 'Rp •••••••'}
                            </span>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted" style={{ fontSize: 13 }}>Pengeluaran</span>
                            <span className="fw-bold text-danger" style={{ fontSize: 13 }}>
                                {isBalanceVisible ? formatRupiah(totalPengeluaran) : 'Rp •••••••'}
                            </span>
                        </div>
                        <hr className="my-2 opacity-25" />
                        <div className="d-flex justify-content-between align-items-center">
                            <span className="fw-bold text-dark" style={{ fontSize: 13 }}>Total</span>
                            <span className="fw-bold" style={{ color: totalNeto >= 0 ? '#28a745' : '#dc3545', fontSize: 18 }}>
                                {isBalanceVisible ? `${totalNeto >= 0 ? '+' : ''}${formatRupiah(totalNeto)}` : 'Rp ••••••••'}
                            </span>
                        </div>
                    </>
                )}

                <div className="d-flex mt-3 bg-primary bg-opacity-10 p-1" style={{ borderRadius: 12, overflow: 'hidden' }}>
                    {(['mingguan', 'bulan', 'tahunan', 'custom'] as const).map((u) => {
                        const active = unit === u;
                        return (
                            <Button
                                key={u}
                                variant="link"
                                size="sm"
                                onClick={() => { changeUnit(u); setCurrentPage(1); }}
                                className={`flex-fill border-0 ${active ? 'bg-primary text-white shadow-sm' : 'text-primary'}`}
                                style={{
                                    textDecoration: 'none',
                                    fontWeight: 'bold',
                                    fontSize: '11px',
                                    padding: '8px 0',
                                    borderRadius: 10,
                                    transition: '0.3s'
                                }}
                            >
                                {u === 'mingguan' ? 'Minggu' : u === 'bulan' ? 'Bulan' : u === 'tahunan' ? 'Tahun' : 'Rentang'}
                            </Button>
                        );
                    })}
                </div>
                {unit === 'custom' && (
                    <div className="d-flex gap-2 mt-2 align-items-center flex-wrap">
                        <Form.Control
                            type="date"
                            size="sm"
                            value={customRange.start}
                            max={customRange.end}
                            onChange={(e) => setCustomRange(e.target.value, customRange.end)}
                            style={{ fontSize: 12, borderRadius: 8, flex: '1 1 130px' }}
                        />
                        <span className="text-muted" style={{ fontSize: 12 }}>–</span>
                        <Form.Control
                            type="date"
                            size="sm"
                            value={customRange.end}
                            min={customRange.start}
                            onChange={(e) => setCustomRange(customRange.start, e.target.value)}
                            style={{ fontSize: 12, borderRadius: 8, flex: '1 1 130px' }}
                        />
                    </div>
                )}
            </Card.Body>
        </Card>

        {isParent && (
            <Card className="border-0 shadow-sm mb-3" style={{ borderRadius: 15, backgroundColor: '#f8f9fa', flexShrink: 0 }}>
                <Card.Body className="p-2">
                    <div className="d-flex gap-2 justify-content-center">
                        {([
                            { key: 'semua', label: 'Semua', icon: PeopleFill },
                            { key: 'ortu', label: 'Orang Tua', icon: PersonWorkspace },
                            { key: 'anak', label: 'Anak', icon: PersonFill }
                        ] as const).map(({ key, label, icon: Icon }) => (
                            <Button
                                key={key}
                                variant={viewFilter === key ? 'primary' : 'outline-secondary'}
                                size="sm"
                                onClick={() => handleViewFilterChange(key)}
                                className="rounded-pill d-flex align-items-center gap-1 px-3"
                                style={{ fontSize: 11, fontWeight: 600 }}
                            >
                                <Icon size={12} />
                                {label}
                            </Button>
                        ))}
                    </div>
                </Card.Body>
            </Card>
        )}

        <div className="mb-3">
        </div>

        <Form.Select
            size="sm"
            value={filter}
            onChange={handleFilterChange}
            className="border-0 shadow-sm mb-4"
            style={{ borderRadius: 12, fontSize: '13px', backgroundColor: '#fff', padding: '12px', flexShrink: 0 }}
        >
            <option value="all">Semua Transaksi</option>
            <option value="pemasukan">Pemasukan</option>
            <option value="pengeluaran">Pengeluaran</option>
        </Form.Select>

        <div className="mb-3 fw-bold text-dark" style={{ flexShrink: 0, fontSize: 18, textAlign: 'center' }}>Riwayat Transaksi</div>
                    
        <div style={{ flexGrow: 1, overflowY: 'auto', minHeight: 0 }} className="no-scrollbar px-1">
            {error ? (
                <div className="text-danger small mb-2 text-center">{error}</div>
            ) : null}
            {hasNoData ? (
                <div className="text-center p-4 text-muted">
                    <p className="mb-0">Belum ada transaksi.</p>
                </div>
            ) : (
                filteredTransactions.map((tx) => {
                    const isCancelled = tx.status === 'dibatalkan';
                    const canManage = !tx.is_internal && !isCancelled && Boolean(onEditTransaction || onDeleteTransaction);
                    return (
                    <Card key={tx.id_transaksi} className="mb-3 shadow-sm border-0 transition-all hover-shadow" style={{ borderRadius: '18px', opacity: isCancelled ? 0.55 : 1 }}>
                        <Card.Body className="p-3">
                            <div className="d-flex align-items-center gap-3">
                                <div 
                                    className={`d-flex align-items-center justify-content-center flex-shrink-0`}
                                    style={{ 
                                        width: '45px', 
                                        height: '45px', 
                                        borderRadius: '14px', 
                                        backgroundColor: tx.jenis === 'pemasukan' ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                                        color: tx.jenis === 'pemasukan' ? '#28a745' : '#dc3545',
                                        fontSize: '20px'
                                    }}
                                >
                                    {React.createElement((Icons as any)[tx.icon_kategori || 'Tag'] || Tag)}
                                </div>
                                <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
                                    <div className="fw-bold text-dark text-truncate" style={{ fontSize: '14px', maxWidth: '100%' }} title={tx.keterangan || ''}>
                                        {(tx.keterangan || '').replace('Kontribusi Target ID:', 'Tabungan #')}
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center">
                                        <small className="text-muted text-truncate me-2" style={{ fontSize: '11px', maxWidth: '100%' }}>
                                            {tx.username && <span className="fw-medium text-primary me-1">{tx.username}</span>}
                                            {(tx.nama_kategori || 'Lainnya')} • {new Date(tx.tanggal).toLocaleDateString('id-ID', {
                                                day: '2-digit',
                                                month: 'short'
                                            })}
                                            {isCancelled && <span className="ms-2 badge bg-secondary" style={{ fontSize: 9 }}>DIBATALKAN</span>}
                                        </small>
                                    </div>
                                    <div
                                        className="fw-bold flex-shrink-0"
                                        style={{
                                            color: tx.jenis === 'pemasukan' ? '#28a745' : '#dc3545',
                                            fontSize: '14px',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {tx.jenis === 'pengeluaran' ? '- ' : '+ '}
                                        {formatRupiah(tx.jumlah)}
                                    </div>
                                </div>
                                {canManage ? (
                                    <Dropdown align="end" onClick={(e) => e.stopPropagation()}>
                                        <Dropdown.Toggle
                                            variant="link"
                                            id={`tx-actions-${tx.id_transaksi}`}
                                            className="p-1 text-secondary shadow-none border-0"
                                            style={{ background: 'transparent' }}
                                        >
                                            <ThreeDotsVertical size={18} />
                                        </Dropdown.Toggle>
                                        <Dropdown.Menu
                                            popperConfig={{ modifiers: [{ name: 'preventOverflow', options: { boundary: 'viewport' } }] }}
                                            style={{ borderRadius: 12, fontSize: 13 }}
                                        >
                                            {onEditTransaction && (
                                                <Dropdown.Item
                                                    onClick={() => onEditTransaction(tx)}
                                                    className="d-flex align-items-center gap-2"
                                                >
                                                    <PencilSquare size={14} /> Edit
                                                </Dropdown.Item>
                                            )}
                                            {onDeleteTransaction && (
                                                <Dropdown.Item
                                                    onClick={() => onDeleteTransaction(tx)}
                                                    className="d-flex align-items-center gap-2 text-danger"
                                                >
                                                    <Trash size={14} /> Hapus
                                                </Dropdown.Item>
                                            )}
                                        </Dropdown.Menu>
                                    </Dropdown>
                                ) : tx.is_internal ? (
                                    <span className="text-muted flex-shrink-0" title="Transaksi internal tidak dapat diedit/dihapus">
                                        <Lock size={14} />
                                    </span>
                                ) : null}
                            </div>
                        </Card.Body>
                    </Card>
                    );
                })
            )}
        </div>

        {!loading && (totalPages > 0 || total > 0) && (
            <div style={{ flexShrink: 0, backgroundColor: 'var(--bg-history)' }}>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    perPage={perPage}
                    onPerPageChange={handlePerPageChange}
                    total={total}
                />
            </div>
        )}
            
        {!hideAddButton && (
            <div className="pt-3 pb-3" style={{ flexShrink: 0, backgroundColor: 'var(--bg-history)' }}>
                <Button variant="primary" className="w-100 py-3 fw-bold shadow" style={{ borderRadius: 999, border: 'none', backgroundColor: '#007bff' }} onClick={openTransactionModal}>
                    + Tambah Transaksi
                </Button>
            </div>
        )}
    </div>
    );
};

export default TransactionHistory;
