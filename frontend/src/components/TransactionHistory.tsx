import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge, Spinner, Form } from 'react-bootstrap';
import { EyeFill, EyeSlashFill } from 'react-bootstrap-icons';
import { fetchTransactionHistory, fetchMonthlySummary } from '../services/report.service';
import type { TransactionHistoryItem, MonthlySummary } from '../types/report.types';
import { useTimeFilter } from '../hooks/useTimeFilter'; 

interface TransactionHistoryProps {
    onTransactionAdded: () => void; 
    openTransactionModal: () => void;
    hideAddButton?: boolean; 
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

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ onTransactionAdded, openTransactionModal, hideAddButton = false }) => {
    const { unit, period, changeUnit } = useTimeFilter('bulan'); 

    const [isBalanceVisible, setIsBalanceVisible] = useState(true);

    const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
    const [summary, setSummary] = useState<MonthlySummary | null>(null);
    const [filter, setFilter] = useState<'all' | 'pemasukan' | 'pengeluaran' | 'pending' | 'ditolak'>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadHistoryData = useCallback(async () => {
        setLoading(true);
        try {
            const history = await fetchTransactionHistory(period.apiParam); 
            const monthlySummary = await fetchMonthlySummary(period.apiParam); 
            
            setTransactions(history); 
            setSummary(monthlySummary);
            setError(null);
        } catch {
            setError("Gagal memuat riwayat transaksi.");
        } finally {
            setLoading(false);
        }
    }, [period.apiParam]);

    useEffect(() => {
        loadHistoryData();
    }, [loadHistoryData, onTransactionAdded]); 

    const totalPemasukan = summary?.totalPemasukan || 0;
    const totalPengeluaran = summary?.totalPengeluaran || 0;
    const totalNeto = summary?.neto || 0;
    
    const hasNoData = transactions.length === 0 && totalNeto === 0;
    const filteredTransactions = transactions.filter((tx) => {
        if (filter === 'all') return true;
        if (filter === 'pemasukan' || filter === 'pengeluaran') return tx.jenis === filter;
        if (filter === 'pending') return tx.status === 'pending';
        if (filter === 'ditolak') return tx.status === 'ditolak';
        return true;
    });

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 20px 24px 20px', backgroundColor: 'var(--bg-history)' }}>
            
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
                    {['mingguan', 'bulan', 'tahunan'].map((u) => {
                        const active = unit === u;
                        return (
                            <Button
                                key={u}
                                variant="link"
                                size="sm"
                                onClick={() => changeUnit(u as any)}
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
                                {u === 'mingguan' ? 'Minggu' : u === 'bulan' ? 'Bulan' : 'Tahun'}
                            </Button>
                        );
                    })}
                </div>
            </Card.Body>
        </Card>
        
        <Form.Select
            size="sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="border-0 shadow-sm mb-4"
            style={{ borderRadius: 12, fontSize: '13px', backgroundColor: '#fff', padding: '12px' }}
        >
            <option value="all">Semua Transaksi</option>
            <option value="pemasukan">Pemasukan</option>
            <option value="pengeluaran">Pengeluaran</option>
            <option value="pending">Pending</option>
            <option value="ditolak">Ditolak</option>
        </Form.Select>

        <div className="mb-3 fw-bold text-dark" style={{ flexShrink: 0, fontSize: 18, textAlign: 'center' }}>Riwayat Transaksi</div>
                    
        <div style={{ flexGrow: 1, overflowY: 'auto' }} className="no-scrollbar px-1">
            {error ? (
                <div className="text-danger small mb-2 text-center">{error}</div>
            ) : null}
            {hasNoData ? (
                <div className="text-center p-4 text-muted">
                    <p className="mb-0">Belum ada transaksi.</p>
                </div>
            ) : (
                filteredTransactions.map((tx) => (
                    <Card key={tx.id_transaksi} className="mb-3 shadow-sm border-0" style={{ borderRadius: '18px' }}>
                        <Card.Body className="p-3">
                            <div className="d-flex flex-column">
                                <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                                    <div className="fw-bold text-dark text-truncate" style={{ fontSize: '14px' }} title={tx.keterangan}>
                                        {tx.keterangan.replace('Kontribusi Target ID:', 'Tabungan #')}
                                    </div>
                                    {tx.status && tx.status !== 'berhasil' ? (
                                        <Badge bg={tx.status === 'pending' ? 'warning' : 'danger'} style={{ fontSize: '10px', borderRadius: 6 }}>
                                            {tx.status === 'pending' ? 'Pending' : 'Ditolak'}
                                        </Badge>
                                    ) : null}
                                </div>

                                <div className="d-flex justify-content-between align-items-center">
                                    <small className="text-muted" style={{ fontSize: '11px' }}>
                                        {new Date(tx.tanggal).toLocaleDateString('id-ID', { 
                                            day: '2-digit', 
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </small>

                                    <div 
                                        className="fw-bold" 
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
                            </div>
                        </Card.Body>
                    </Card>
                ))
            )}
        </div>
            
        {!hideAddButton && (
            <div className="pt-4 bg-transparent" style={{ flexShrink: 0, marginTop: 'auto' }}>
                <Button variant="primary" className="w-100 py-3 fw-bold shadow" style={{ borderRadius: 999, border: 'none', backgroundColor: '#007bff' }} onClick={openTransactionModal}>
                    + Tambah Transaksi
                </Button>
            </div>
        )}
    </div>
    );
};

export default TransactionHistory;
