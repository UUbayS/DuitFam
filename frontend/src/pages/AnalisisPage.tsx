import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Button, Spinner, Alert } from 'react-bootstrap';
import MainLayout from '../components/MainLayout';
import { ArrowLeftShort, ArrowRightShort } from 'react-bootstrap-icons';
import { fetchAnalysisReport, fetchFamilyAnalysisReport, fetchFamilyHistoricalData, fetchHistoricalData } from '../services/report.service';
import type * as ReportTypes from '../types/report.types';
import MonthlyBarChart from '../components/MonthlyBarChart';
import { useAuth } from '../context/AuthContext';
import { useTimeFilter } from '../hooks/useTimeFilter';
import TransactionModal from '../components/TransactionModal';
import IconAnalisisBiru from '../assets/IconAnalisisBiru.svg';
import IconBuku from '../assets/Buku.svg';
import IconLampu from '../assets/Lampu.svg';
import IconHurufI from '../assets/HurufIHijau.svg';
import IconChecklist from '../assets/ChecklistHijau.svg';

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
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);

        const loadData = useCallback(async () => {
            setLoading(true);
            try {
                const isParent = user?.role === 'parent';
                const [analysisRes, historical] = await Promise.all([
                    isParent ? fetchFamilyAnalysisReport(period.apiParam) : fetchAnalysisReport(period.apiParam),
                    isParent ? fetchFamilyHistoricalData() : fetchHistoricalData({ unit: unit === 'bulan' ? 'bulanan' : unit })
                ]);
                setReport(analysisRes);
                setHistoricalData(historical);
                setError(null);
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
    const smartAi = report?.smartRecommendation;
    const rec = report?.recommendation;

    return (
        <MainLayout onTransactionAdded={loadData} openTransactionModal={() => setShowModal(true)} hideAddButton={true}>
            <div className="d-flex align-items-center gap-2 mb-4">
                <img src={IconAnalisisBiru} alt="Ikon Analisis" style={{ width: 32, height: 32 }} />
                <h2 className="text-primary fw-bold mb-0" style={{ fontSize: 35 }}>
                    Analisis
                </h2>
            </div>

            <div className="d-flex mb-4 align-items-center flex-wrap gap-3 justify-content-between">
                <div className="d-flex gap-2 bg-white p-1 rounded-pill shadow-sm border">
                    {['mingguan', 'bulan', 'tahunan'].map((u) => (
                        <Button 
                            key={u}
                            variant={unit === u ? 'primary' : 'link'} 
                            onClick={() => changeUnit(u as any)} 
                            className={`rounded-pill px-4 fw-bold text-decoration-none ${unit === u ? '' : 'text-muted'}`}
                            style={{ fontSize: 13 }}
                        >
                            {u === 'mingguan' ? 'Mingguan' : u === 'bulan' ? 'Bulanan' : 'Tahunan'}
                        </Button>
                    ))}
                </div>

                <div className="d-flex align-items-center bg-white p-1 rounded-pill shadow-sm border">
                    <Button variant="link" onClick={() => navigate('prev')} className="text-primary p-1"><ArrowLeftShort size={24} /></Button>
                    <div className="px-3 fw-bold text-dark" style={{ fontSize: 14 }}>{period.display}</div>
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

            {smartAi && (
                <Card className="border-0 shadow-sm mb-4 overflow-hidden" style={{ borderRadius: 25 }}>
                    <Card.Header className="bg-primary text-white border-0 py-3 px-4 d-flex align-items-center">
                        <img src={IconLampu} alt="" style={{ width: 22, filter: 'brightness(0) invert(1)', marginRight: 10 }} />
                        <h5 className="mb-0 fw-bold">Smart Spending AI</h5>
                    </Card.Header>
                    <Card.Body className="p-4">
                        <p className="mb-0 text-muted">{smartAi}</p>
                    </Card.Body>
                </Card>
            )}

            {rec && (
                <Card className="border-0 shadow-sm mb-5 overflow-hidden" style={{ borderRadius: 25 }}>
                    <Card.Header className="bg-primary text-white border-0 py-3 px-4 d-flex align-items-center">
                        <img src={IconBuku} alt="" style={{ width: 22, filter: 'brightness(0) invert(1)', marginRight: 10 }} />
                        <h5 className="mb-0 fw-bold">Metode Mengelola Keuangan</h5>
                    </Card.Header>
                    <Card.Body className="p-4">
                        <div className="d-flex align-items-start mb-3">
                            <div className="bg-primary rounded-4 p-3 me-3">
                                <img src={IconLampu} alt="" style={{ width: 40, filter: 'brightness(0) invert(1)' }} />
                            </div>
                            <div>
                                <h4 className="text-primary fw-bold mb-1">{rec.namaMetode}</h4>
                                <div className="badge bg-success-subtle text-success px-3 py-2 rounded-pill fw-bold" style={{ fontSize: 11 }}>
                                    <img src={IconChecklist} alt="" className="me-1" style={{ width: 14 }} /> DIREKOMENDASIKAN
                                </div>
                            </div>
                        </div>
                        <p className="text-muted">{rec.detailRekomendasi || rec.deskripsiMetode}</p>
                        
                        {rec.langkah_implementasi && (
                            <div className="mt-4 p-4 rounded-4" style={{ backgroundColor: '#f0fff4' }}>
                                <h5 className="text-success fw-bold mb-3 d-flex align-items-center">
                                    <img src={IconHurufI} alt="" className="me-2" style={{ width: 24 }} /> Cara Implementasi Metode
                                </h5>
                                <ul className="list-unstyled mb-0">
                                    {rec.langkah_implementasi.split('|').map((step: string, i: number) => (
                                        <li key={i} className="mb-2 text-muted d-flex align-items-start">
                                            <span className="me-2">•</span> {step.trim()}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Card.Body>
                </Card>
            )}

            <TransactionModal show={showModal} handleClose={() => setShowModal(false)} onSuccess={loadData} />
        </MainLayout>
    );
};

export default AnalisisPage;
