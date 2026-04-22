    import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Row, Col, Card, Button, ProgressBar, Spinner, Alert } from 'react-bootstrap';
import MainLayout from '../components/MainLayout';
    import { Bullseye, EyeFill, EyeSlashFill, Plus } from 'react-bootstrap-icons';
import { fetchActiveTargets, contributeToTarget } from '../services/target.service';
import { fetchMonthlySummary } from '../services/report.service';
import type * as TargetTypes from '../types/target.types';
import type * as ReportTypes from '../types/report.types';
import TransactionModal from '../components/TransactionModal';
import IconTargetBiru from '../assets/IconTargetBiru.svg';
import OnlyLogoBiru from '../assets/OnlyLogoBiru.svg';
import { useAuth } from '../context/AuthContext';

const formatRupiah = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.floor(amount));
    return formatted.replace('Rp', 'Rp ');
};

    const TargetMenabungPage = () => {
        const { user } = useAuth();
        const [targets, setTargets] = useState<TargetTypes.TargetMenabung[]>([]);
        const [summary, setSummary] = useState<ReportTypes.MonthlySummary | null>(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [showSaldo, setShowSaldo] = useState(true);
        const [showTransactionModal, setShowTransactionModal] = useState(false);
        const [contributeLoading, setContributeLoading] = useState<Record<string, boolean>>({});

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [targetData, summaryData] = await Promise.all([
                fetchActiveTargets(),
                fetchMonthlySummary(),
            ]);
            setTargets(targetData);
            setSummary(summaryData);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Gagal memuat data target.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleContribute = async (targetId: string) => {
        // Simple fixed contribution for demo/mockup purposes or open a modal
        // For now, let's keep it simple or use a prompt
        const amountStr = window.prompt('Masukkan jumlah yang ingin ditabung:');
        if (!amountStr) return;
        const amount = Number(amountStr.replace(/\D/g, ''));
        if (!amount || amount <= 0) return;

        setContributeLoading(prev => ({ ...prev, [targetId]: true }));
        try {
            await contributeToTarget({ id_target: targetId, jumlah: amount });
            loadData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Gagal menabung.');
        } finally {
            setContributeLoading(prev => ({ ...prev, [targetId]: false }));
        }
    };

    if (loading) {
        return (
            <MainLayout hideAddButton={true}>
                <div className="d-flex justify-content-center mt-5">
                    <Spinner animation="border" variant="primary" />
                </div>
            </MainLayout>
        );
    }

    const activeTarget = targets[0]; // For mockup, show first active target as primary

    return (
        <MainLayout 
            onTransactionAdded={loadData} 
            openTransactionModal={() => setShowTransactionModal(true)}
            hideAddButton={true}
        >
            <div className="d-flex align-items-center gap-2 mb-4">
                <img src={IconTargetBiru} alt="Ikon Target" style={{ width: 32, height: 32 }} />
                <h2 className="text-primary fw-bold mb-0" style={{ fontSize: 35 }}>
                    Target Menabung
                </h2>
            </div>

            {error ? <Alert variant="danger" style={{ borderRadius: 15 }}>{error}</Alert> : null}

            <Row className="g-4">
                <Col lg={4}>
                    <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 25 }}>
                        <Card.Body className="p-4">
                            <div className="d-flex justify-content-between align-items-start mb-3">
                                <div className="fw-bold text-dark" style={{ fontSize: 18 }}>Total Saldo</div>
                                <button
                                    onClick={() => setShowSaldo(!showSaldo)}
                                    style={{ border: 0, background: 'transparent', color: '#9aa0a6' }}
                                >
                                    {showSaldo ? <EyeFill size={18} /> : <EyeSlashFill size={18} />}
                                </button>
                            </div>
                            <div className="fw-bold text-primary" style={{ fontSize: 24 }}>
                                {showSaldo ? formatRupiah(summary?.saldoAkhir || 0) : 'Rp ••••••'}
                            </div>
                            <div className="text-muted small mt-1">Saldo tersedia untuk ditabung</div>
                        </Card.Body>
                    </Card>

                    <Card className="border-0 shadow-sm" style={{ borderRadius: 25 }}>
                        <Card.Body className="p-4">
                            <div className="fw-bold text-dark mb-3" style={{ fontSize: 18 }}>Uang yang Bisa Ditabung</div>
                            <div className="fw-bold text-success" style={{ fontSize: 24 }}>
                                {showSaldo ? formatRupiah((summary?.saldoAkhir || 0) * 0.2) : 'Rp ••••••'}
                            </div>
                            <div className="text-muted small mt-1">Saran alokasi 20% dari saldo</div>
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={8}>
                    {activeTarget ? (
                        <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 25, position: 'relative', overflow: 'hidden' }}>
                            <Card.Body className="p-5 d-flex flex-column align-items-center text-center">
                                <div className="bg-primary bg-opacity-10 p-4 rounded-circle mb-4">
                                    <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: 64, height: 64, fontSize: 32 }}>
                                        🚗
                                    </div>
                                </div>
                                <div className="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3 py-2 fw-bold mb-3" style={{ fontSize: 12 }}>
                                    TARGET SIMPANAN
                                </div>
                                <h3 className="fw-bold text-dark mb-4" style={{ fontSize: 32 }}>{activeTarget.nama_target}</h3>
                                
                                <div className="w-100 mb-4 px-4">
                                    <div className="d-flex justify-content-between mb-2 fw-bold">
                                        <span className="text-muted">Progres</span>
                                        <span className="text-primary">{Math.floor((activeTarget.jumlah_terkumpul / activeTarget.target_jumlah) * 100)}%</span>
                                    </div>
                                    <ProgressBar 
                                        now={(activeTarget.jumlah_terkumpul / activeTarget.target_jumlah) * 100} 
                                        style={{ height: 16, borderRadius: 10, backgroundColor: '#e9ecef' }}
                                    />
                                </div>

                                <div className="mb-4">
                                    <div className="text-muted small fw-bold">TERKUMPUL</div>
                                    <div className="fw-bold text-primary" style={{ fontSize: 36 }}>
                                        {formatRupiah(activeTarget.jumlah_terkumpul)}
                                    </div>
                                    <div className="text-muted small">dari {formatRupiah(activeTarget.target_jumlah)}</div>
                                </div>

                                <Button 
                                    variant="primary" 
                                    onClick={() => handleContribute(activeTarget.id_target)}
                                    className="w-100 py-3 fw-bold shadow-sm"
                                    style={{ borderRadius: 15, fontSize: 18 }}
                                    disabled={contributeLoading[activeTarget.id_target]}
                                >
                                    {contributeLoading[activeTarget.id_target] ? <Spinner size="sm" /> : '+ Tambah Tabungan'}
                                </Button>
                            </Card.Body>
                        </Card>
                    ) : (
                        <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 25 }}>
                            <Card.Body className="p-5 d-flex flex-column align-items-center justify-content-center text-center">
                                <img src={OnlyLogoBiru} alt="SipDana" style={{ width: 120, opacity: 0.2, marginBottom: 20 }} />
                                <h4 className="fw-bold text-muted">Belum ada target aktif</h4>
                                <Button variant="link" onClick={() => setShowTransactionModal(true)}>Buat baru</Button>
                            </Card.Body>
                        </Card>
                    )}
                </Col>
            </Row>

            <div className="mt-4">
                <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 25, backgroundColor: '#fff' }}>
                    <Card.Body className="p-4 d-flex justify-content-between align-items-center">
                        <div>
                            <div className="fw-bold text-dark" style={{ fontSize: 22 }}>Analisis Mingguan</div>
                            <div className="text-muted">Kamu sudah menabung <span className="text-primary fw-bold">Rp 150.000</span> minggu ini!</div>
                        </div>
                        <div className="text-success fw-bold" style={{ fontSize: 24 }}>+12% 📈</div>
                    </Card.Body>
                </Card>

                <Button 
                    variant="primary"
                    className="w-100 py-3 fw-bold shadow"
                    style={{ borderRadius: '50px', fontSize: 20, border: 'none' }}
                    onClick={() => setShowTransactionModal(true)}
                >
                    <Plus size={28} className="me-2" /> Tambah Kantong Tabungan
                </Button>
            </div>

            <TransactionModal show={showTransactionModal} handleClose={() => setShowTransactionModal(false)} onSuccess={loadData} />
        </MainLayout>
    );
};

export default TargetMenabungPage;
