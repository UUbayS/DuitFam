import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Button, Spinner, Alert } from 'react-bootstrap';
import MainLayout from '../components/MainLayout';
import { ArrowLeftShort, ArrowRightShort, Tag } from 'react-bootstrap-icons';
import * as Icons from 'react-bootstrap-icons';
import { fetchAnalysisReport, fetchFamilyAnalysisReport, fetchFamilyHistoricalData, fetchHistoricalData, fetchTransactionHistory, fetchFamilyTransactionHistory } from '../services/report.service';
import type * as ReportTypes from '../types/report.types';
import MonthlyBarChart from '../components/MonthlyBarChart';
import { useAuth } from '../context/AuthContext';
import { useTimeFilter } from '../hooks/useTimeFilter';
import TransactionModal from '../components/TransactionModal';
import IconAnalisisBiru from '../assets/IconAnalisisBiru.svg';

const formatRupiah = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.floor(amount));
    return formatted.replace('Rp', 'Rp ');
};

const AnalisisPage = () => {
    const { user } = useAuth();
    const { unit, period, navigate, changeUnit } = useTimeFilter('bulan');
    const [report, setReport] = useState<any>(null);
    const [historicalData, setHistoricalData] = useState<ReportTypes.AnalysisReport['chartData']>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const isParent = user?.role === 'parent';
            const [analysisRes, historical] = await Promise.all([
                isParent ? fetchFamilyAnalysisReport(period.apiParam) : fetchAnalysisReport(period.apiParam),
                isParent 
                    ? fetchFamilyHistoricalData({ unit: unit === 'bulan' ? 'bulan' : unit, ...period.apiParam }) 
                    : fetchHistoricalData({ unit: unit === 'bulan' ? 'bulan' : unit, ...period.apiParam })
            ]);
            setReport(analysisRes);
            setHistoricalData(historical);
            setError(null);
            
            // Load history separately to not block main UI and avoid rate limit spikes
            const history = await (isParent ? fetchFamilyTransactionHistory(period.apiParam) : fetchTransactionHistory(period.apiParam));
            setTransactions(history);
        } catch (err: any) {
            setError("Gagal memuat data analisis.");
        } finally {
            setLoading(false);
        }
    }, [period.apiParam, unit, user?.role]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <MainLayout hideAddButton={true}>
                <div className="d-flex justify-content-center mt-5">
                    <Spinner animation="border" variant="primary" />
                </div>
            </MainLayout>
        );
    }

    const summary = report?.summary;


    return (
        <MainLayout onTransactionAdded={loadData} openTransactionModal={() => setShowModal(true)} hideAddButton={false}>
            <div className="d-flex align-items-center gap-2 mb-4">
                <img src={IconAnalisisBiru} alt="Ikon Analisis" style={{ width: window.innerWidth > 768 ? 32 : 24, height: window.innerWidth > 768 ? 32 : 24 }} />
                <h2 className="text-primary fw-bold mb-0 responsive-h2" style={{ fontSize: 'calc(1.5rem + 1.5vw)' }}>
                    Analisis
                </h2>
            </div>

            <div className="d-flex mb-4 align-items-center flex-wrap gap-3 justify-content-between">
                <div className="d-flex gap-2 bg-white p-1 rounded-pill shadow-sm border overflow-auto no-scrollbar" style={{ maxWidth: '100%' }}>
                    {['mingguan', 'bulan', 'tahunan'].map((u) => (
                        <Button 
                            key={u}
                            variant={unit === u ? 'primary' : 'link'} 
                            onClick={() => changeUnit(u as any)} 
                            className={`rounded-pill px-3 px-md-4 fw-bold text-decoration-none ${unit === u ? '' : 'text-muted'}`}
                            style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                        >
                            {u === 'mingguan' ? 'Mingguan' : u === 'bulan' ? 'Bulanan' : 'Tahunan'}
                        </Button>
                    ))}
                </div>

                <div className="d-flex align-items-center bg-white p-1 rounded-pill shadow-sm border">
                    <Button variant="link" onClick={() => navigate('prev')} className="text-primary p-1"><ArrowLeftShort size={24} /></Button>
                    <div className="px-2 px-md-3 fw-bold text-dark text-nowrap" style={{ fontSize: 13 }}>{period.display}</div>
                    <Button variant="link" onClick={() => navigate('next')} className="text-primary p-1"><ArrowRightShort size={24} /></Button>
                </div>
            </div>

            {error ? <Alert variant="danger" style={{ borderRadius: 15 }}>{error}</Alert> : null}

            <Row className="g-4 mb-5">
                <Col md={4}>
                    <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 25, borderBottom: '5px solid #28a745' }}>
                        <Card.Body className="p-4">
                            <div className="text-success fw-bold small mb-1">TOTAL PEMASUKAN</div>
                            <div className="fw-bold text-dark" style={{ fontSize: 24 }}>{formatRupiah(summary?.totalPemasukan || 0)}</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 25, borderBottom: '5px solid #dc3545' }}>
                        <Card.Body className="p-4">
                            <div className="text-danger fw-bold small mb-1">TOTAL PENGELUARAN</div>
                            <div className="fw-bold text-dark" style={{ fontSize: 24 }}>{formatRupiah(summary?.totalPengeluaran || 0)}</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 25, borderBottom: '5px solid #007bff' }}>
                        <Card.Body className="p-4">
                            <div className="text-primary fw-bold small mb-1">SELISIH</div>
                            <div className="fw-bold text-dark" style={{ fontSize: 24 }}>{formatRupiah(summary?.neto || 0)}</div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Card className="border-0 shadow-sm mb-5" style={{ borderRadius: 25 }}>
                <Card.Body className="p-4">
                    <div className="fw-bold mb-4 text-dark" style={{ fontSize: 22 }}>Grafik Keuangan</div>
                    <div style={{ minHeight: 300 }}>
                        <MonthlyBarChart chartData={historicalData} />
                    </div>
                </Card.Body>
            </Card>

            <TransactionModal show={showModal} handleClose={() => setShowModal(false)} onSuccess={loadData} />

            <Card className="border-0 shadow-sm mb-5" style={{ borderRadius: 25 }}>
                <Card.Body className="p-4">
                    <div className="fw-bold mb-4 text-dark" style={{ fontSize: 22 }}>Riwayat Transaksi</div>
                    {historyLoading ? (
                        <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-5 text-muted">Belum ada transaksi pada periode ini.</div>
                    ) : (
                        <div className="px-1">
                            {transactions.map((tx: any) => (
                                <Card key={tx.id_transaksi} className="mb-3 shadow-sm border-0 transition-all" style={{ borderRadius: '18px', overflow: 'hidden' }}>
                                    <Card.Body className="p-3">
                                        <div className="d-flex align-items-center gap-3">
                                            <div 
                                                className="d-flex align-items-center justify-content-center flex-shrink-0"
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
                                            <div className="flex-grow-1 d-flex flex-column min-width-0">
                                                <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                                                    <div className="fw-bold text-dark text-truncate" style={{ fontSize: '14px' }}>
                                                        {tx.keterangan || 'Tanpa keterangan'}
                                                    </div>
                                                </div>
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <small className="text-muted" style={{ fontSize: '11px' }}>
                                                        {tx.nama_kategori || 'Lainnya'} • {new Date(tx.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                                    </small>
                                                    <div 
                                                        className="fw-bold" 
                                                        style={{ 
                                                            color: tx.jenis === 'pemasukan' ? '#28a745' : '#dc3545', 
                                                            fontSize: '14px'
                                                        }}
                                                    >
                                                        {tx.jenis === 'pengeluaran' ? '- ' : '+ '}
                                                        {formatRupiah(tx.jumlah)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            ))}
                        </div>
                    )}
                </Card.Body>
            </Card>
        </MainLayout>
    );
};

export default AnalisisPage;
