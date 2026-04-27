    import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Row, Col, Card, Button, ProgressBar, Spinner, Alert } from 'react-bootstrap';
import MainLayout from '../components/MainLayout';
    import { Bullseye, EyeFill, EyeSlashFill, Plus, Trash, DashCircle } from 'react-bootstrap-icons';
import { fetchActiveTargets, contributeToTarget, withdrawFromTarget, cancelTarget } from '../services/target.service';
import { fetchMonthlySummary } from '../services/report.service';
import type * as TargetTypes from '../types/target.types';
import type * as ReportTypes from '../types/report.types';
import TransactionModal from '../components/TransactionModal';
import AddSavingGoalModal from '../components/AddSavingGoalModal';
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
        const [showAddSavingModal, setShowAddSavingModal] = useState(false);
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

    const handleWithdraw = async (targetId: string) => {
        const amountStr = window.prompt('Masukkan jumlah yang ingin diambil dari kantong:');
        if (!amountStr) return;
        const amount = Number(amountStr.replace(/\D/g, ''));
        if (!amount || amount <= 0) return;

        setContributeLoading(prev => ({ ...prev, [targetId]: true }));
        try {
            await withdrawFromTarget({ id_target: targetId, jumlah: amount });
            loadData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Gagal mengambil uang.');
        } finally {
            setContributeLoading(prev => ({ ...prev, [targetId]: false }));
        }
    };

    const handleDelete = async (targetId: string, name: string) => {
        if (!window.confirm(`Apakah Anda yakin ingin menghapus kantong "${name}"?`)) return;

        setContributeLoading(prev => ({ ...prev, [targetId]: true }));
        try {
            await cancelTarget(targetId);
            loadData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Gagal menghapus kantong.');
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



    return (
        <MainLayout 
            onTransactionAdded={loadData} 
            openTransactionModal={() => setShowTransactionModal(true)}
            hideAddButton={false}
        >
            <div className="d-flex align-items-center gap-2 mb-4">
                <img src={IconTargetBiru} alt="Ikon Target" style={{ width: window.innerWidth > 768 ? 32 : 24, height: window.innerWidth > 768 ? 32 : 24 }} />
                <h2 className="text-primary fw-bold mb-0 responsive-h2" style={{ fontSize: 'calc(1.5rem + 1.5vw)' }}>
                    Target Menabung
                </h2>
            </div>

            {error ? <Alert variant="danger" style={{ borderRadius: 15 }}>{error}</Alert> : null}

            <Row className="g-4 mb-4">
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
                    <Row className="g-4">
                        {targets.map((target) => {
                            const progress = Math.floor((target.jumlah_terkumpul / target.target_jumlah) * 100);
                            return (
                                <Col key={target.id_target} md={6}>
                                    <Card className="border-0 shadow-sm h-100 transition-all hover-shadow" style={{ borderRadius: 25, backgroundColor: '#ffffff' }}>
                                        <Card.Body className="p-4">
                                            <div className="d-flex justify-content-between align-items-start mb-3">
                                                <div className="d-flex align-items-center gap-3">
                                                    <div className="bg-primary bg-opacity-10 p-2 rounded-circle text-primary d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                                                        <div className="bg-primary rounded-circle" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px' }}>
                                                            🎯
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold text-dark text-truncate" style={{ fontSize: 18, maxWidth: '120px' }}>
                                                            {target.nama_target}
                                                        </div>
                                                        <div className="text-muted" style={{ fontSize: 11 }}>Target: {formatRupiah(target.target_jumlah)}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <div className="d-flex justify-content-between mb-1">
                                                    <span className="text-muted small fw-bold">Progres</span>
                                                    <span className="text-primary small fw-bold">{progress}%</span>
                                                </div>
                                                <ProgressBar 
                                                    now={progress} 
                                                    variant={progress >= 100 ? 'success' : 'primary'}
                                                    style={{ height: 10, borderRadius: 10, backgroundColor: '#f1f5f9' }}
                                                />
                                            </div>

                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div>
                                                    <div className="text-muted" style={{ fontSize: 10 }}>TERKUMPUL</div>
                                                    <div className="fw-bold text-dark" style={{ fontSize: 14 }}>{formatRupiah(target.jumlah_terkumpul)}</div>
                                                </div>
                                            </div>

                                            <div className="d-flex gap-2">
                                                <Button 
                                                    variant="primary" 
                                                    onClick={() => handleContribute(target.id_target)}
                                                    className="flex-grow-1 py-2 fw-bold"
                                                    style={{ borderRadius: 12, fontSize: 14 }}
                                                    disabled={contributeLoading[target.id_target]}
                                                >
                                                    {contributeLoading[target.id_target] ? <Spinner size="sm" /> : '+ Nabung'}
                                                </Button>
                                                <Button 
                                                    variant="outline-primary" 
                                                    onClick={() => handleWithdraw(target.id_target)}
                                                    className="py-2 px-3 fw-bold"
                                                    style={{ borderRadius: 12, fontSize: 14 }}
                                                    disabled={contributeLoading[target.id_target]}
                                                    title="Ambil Uang"
                                                >
                                                    <DashCircle size={20} />
                                                </Button>
                                                <Button 
                                                    variant="outline-danger" 
                                                    onClick={() => handleDelete(target.id_target, target.nama_target)}
                                                    className="py-2 px-3 fw-bold"
                                                    style={{ borderRadius: 12, fontSize: 14, border: 'none', backgroundColor: 'rgba(220, 53, 69, 0.1)', color: '#dc3545' }}
                                                    disabled={contributeLoading[target.id_target]}
                                                    title="Hapus Kantong"
                                                >
                                                    <Trash size={18} />
                                                </Button>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            );
                        })}
                        
                        {targets.length === 0 && (
                            <Col xs={12}>
                                <Card 
                                    onClick={() => setShowAddSavingModal(true)}
                                    className="border-0 shadow-sm text-center py-5 h-100" 
                                    style={{ 
                                        borderRadius: 25, 
                                        backgroundColor: '#f8fafc', 
                                        border: '2px dashed #e2e8f0',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Card.Body className="d-flex flex-column align-items-center justify-content-center">
                                        <div className="text-muted mb-2" style={{ fontSize: 48 }}>🎯</div>
                                        <h4 className="fw-bold text-muted">Belum ada target aktif</h4>
                                        <Button variant="link" onClick={() => setShowAddSavingModal(true)}>Buat Target Baru</Button>
                                    </Card.Body>
                                </Card>
                            </Col>
                        )}
                    </Row>
                </Col>
            </Row>



            <div className="mt-4">
                <Button 
                    variant="primary"
                    className="w-100 py-3 fw-bold shadow"
                    style={{ borderRadius: '50px', fontSize: 20, border: 'none' }}
                    onClick={() => setShowAddSavingModal(true)}
                >
                    <Plus size={28} className="me-2" /> Tambah Target Tabungan
                </Button>
            </div>

            <TransactionModal show={showTransactionModal} handleClose={() => setShowTransactionModal(false)} onSuccess={loadData} />
            <AddSavingGoalModal show={showAddSavingModal} handleClose={() => setShowAddSavingModal(false)} onSuccess={loadData} />
        </MainLayout>
    );
};

export default TargetMenabungPage;
