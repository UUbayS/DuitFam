import { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Col, Row, Spinner } from 'react-bootstrap';
import { EyeFill, EyeSlashFill } from 'react-bootstrap-icons';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { fetchFamilyMonthlySummary, fetchFamilyHistoricalData, fetchMonthlySummary, fetchHistoricalData } from '../services/report.service';
import MonthlyBarChart from '../components/MonthlyBarChart';
import IconBerandaBiru from '../assets/IconBerandaBiru.svg';
import type * as ReportTypes from '../types/report.types';

const formatRupiah = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.floor(amount));

    return formatted.replace('Rp', 'Rp ');
};

const DashboardPage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showSaldo, setShowSaldo] = useState(true);
    const [showTransactionModal, setShowTransactionModal] = useState(false);

    const [summary, setSummary] = useState<ReportTypes.MonthlySummary | null>(null);
    const [parentSummary, setParentSummary] = useState<ReportTypes.MonthlySummary | null>(null);
    const [historicalData, setHistoricalData] = useState<ReportTypes.AnalysisReport['chartData']>([]);

    const isParent = user?.role === 'parent';

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            if (isParent) {
                const [s, ps, hist] = await Promise.all([
                    fetchFamilyMonthlySummary(),
                    fetchMonthlySummary(),
                    fetchFamilyHistoricalData(),
                ]);
                setSummary(s);
                setParentSummary(ps);
                setHistoricalData(hist);
            } else {
                const [s, hist] = await Promise.all([
                    fetchMonthlySummary(),
                    fetchHistoricalData()
                ]);
                setSummary(s);
                setParentSummary(s);
                setHistoricalData(hist);
            }
            setError(null);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Gagal memuat data beranda.');
        } finally {
            setLoading(false);
        }
    }, [isParent]);

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

    return (
        <MainLayout 
            onTransactionAdded={loadData} 
            openTransactionModal={() => setShowTransactionModal(true)}
            hideAddButton={true}
        >
            <div className="d-flex align-items-center gap-2 mb-4">
                <img src={IconBerandaBiru} alt="Ikon Beranda" style={{ width: 32, height: 32 }} />
                <h2 className="text-primary fw-bold mb-0" style={{ fontSize: 35 }}>
                    Beranda
                </h2>
            </div>

            {error ? <Alert variant="danger" style={{ borderRadius: 15 }}>{error}</Alert> : null}

            <Row className="g-4 mb-4">
                <Col md={6}>
                    <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 25 }}>
                        <Card.Body className="p-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <div className="fw-bold text-dark" style={{ fontSize: 18 }}>
                                        Tabungan
                                    </div>
                                    <div className="text-muted small">Saldo saat ini</div>
                                    <div className="mt-2" style={{ fontSize: 32, fontWeight: 900, color: '#1389f9' }}>
                                        {showSaldo ? formatRupiah(parentSummary?.saldoAkhir || 0) : 'Rp ••••••'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowSaldo(!showSaldo)}
                                    style={{ border: 0, background: 'transparent', padding: 8, color: '#9aa0a6' }}
                                >
                                    {showSaldo ? <EyeFill size={20} /> : <EyeSlashFill size={20} />}
                                </button>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 25 }}>
                        <Card.Body className="p-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <div className="fw-bold text-dark" style={{ fontSize: 18 }}>
                                        Saldo Total Keluarga
                                    </div>
                                    <div className="text-muted small">Saldo saat ini</div>
                                    <div className="mt-2" style={{ fontSize: 32, fontWeight: 900, color: '#1389f9' }}>
                                        {showSaldo ? formatRupiah(summary?.saldoAkhir || 0) : 'Rp ••••••'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowSaldo(!showSaldo)}
                                    style={{ border: 0, background: 'transparent', padding: 8, color: '#9aa0a6' }}
                                >
                                    {showSaldo ? <EyeFill size={20} /> : <EyeSlashFill size={20} />}
                                </button>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 25 }}>
                <Card.Body className="p-4">
                    <div className="fw-bold mb-4 text-dark" style={{ fontSize: 22 }}>
                        Analisis Keuangan
                    </div>
                    <div style={{ minHeight: 300 }}>
                        <MonthlyBarChart chartData={historicalData} />
                    </div>
                </Card.Body>
            </Card>

            {/* TransactionModal is handled by MainLayout if hideAddButton is false, but we hide it here as per mockup */}
        </MainLayout>
    );
};

export default DashboardPage;
