import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Row, Col, Card, Form, Button, Alert, Spinner, Modal } from 'react-bootstrap';
import MainLayout from '../components/MainLayout';
import { Plus, EyeFill, EyeSlashFill, Trash, ArrowClockwise } from 'react-bootstrap-icons';
import { useAuth } from '../context/AuthContext';
    import { createChildService, fetchChildrenService, toggleChildService, updateChildService, fetchChildrenBalancesService, deleteChildService, resetChildPasswordService } from '../services/user.service';
import { fetchFamilyMonthlySummary, fetchFamilyHistoricalData } from '../services/report.service';
import { depositToChild } from '../services/transaction.service';
import TransactionModal from '../components/TransactionModal';
import MonthlyBarChart from '../components/MonthlyBarChart';
import AddChildModal from '../components/AddChildModal';
import ResetPasswordModal from '../components/ResetPasswordModal';
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

    const FamilyPage = () => {
        const { user } = useAuth();
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [showSaldo, setShowSaldo] = useState(true);
        const [showTransactionModal, setShowTransactionModal] = useState(false);
    
    const [summary, setSummary] = useState<ReportTypes.MonthlySummary | null>(null);
    const [historicalData, setHistoricalData] = useState<ReportTypes.AnalysisReport['chartData']>([]);
    const [children, setChildren] = useState<Array<{ id: string; username: string; email: string; is_active: boolean; saldo: number; percentage_change: number }>>([]);

    const [createChildModalOpen, setCreateChildModalOpen] = useState(false);

    const [depositModalOpen, setDepositModalOpen] = useState(false);
    const [depositChildId, setDepositChildId] = useState<string>('');
    const [depositAmount, setDepositAmount] = useState<string>('');
    const [depositKeterangan, setDepositKeterangan] = useState<string>('');
    const [depositLoading, setDepositLoading] = useState(false);
    
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [childToDelete, setChildToDelete] = useState<{ id: string; username: string } | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
    const [childToReset, setChildToReset] = useState<{ id: string; username: string } | null>(null);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [s, hist, kids] = await Promise.all([
                fetchFamilyMonthlySummary(),
                fetchFamilyHistoricalData(),
                fetchChildrenBalancesService(),
            ]);
            setSummary(s);
            setHistoricalData(hist);
            setChildren(kids.filter((k) => k.is_active));
            setError(null);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Gagal memuat data anggota keluarga.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const childCount = useMemo(() => children.length, [children.length]);

    const totalChildrenBalance = useMemo(() => 
        children.reduce((sum, c) => sum + (c.saldo || 0), 0)
    , [children]);

    const openDeposit = (childId: string) => {
        setDepositChildId(childId);
        setDepositAmount('');
        setDepositKeterangan('');
        setDepositModalOpen(true);
    };

    const submitDeposit = async () => {
        const amount = Number(depositAmount.replace(/\D/g, ''));
        if (!depositChildId || !amount || amount <= 0) return;
        setDepositLoading(true);
        try {
            await depositToChild({ child_id: depositChildId, amount, keterangan: depositKeterangan || undefined });
            setDepositModalOpen(false);
            loadData();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Gagal deposit.');
        } finally {
            setDepositLoading(false);
        }
    };

    const handleCreateChildSuccess = () => {
        loadData();
    };

    const openDeleteConfirm = (childId: string, username: string) => {
        setChildToDelete({ id: childId, username });
        setDeleteModalOpen(true);
    };

    const openResetPassword = (childId: string, username: string) => {
        setChildToReset({ id: childId, username });
        setResetPasswordModalOpen(true);
    };

    const handleResetPasswordSuccess = () => {
        setResetPasswordModalOpen(false);
        setChildToReset(null);
        setResetError(null);
    };

    const handleResetPassword = async (password: string, confirmPassword: string) => {
        if (!childToReset) return;
        setResetLoading(true);
        setResetError(null);
        try {
            await resetChildPasswordService(childToReset.id, {
                password,
                password_confirmation: confirmPassword,
            });
            handleResetPasswordSuccess();
            loadData();
        } catch (e: any) {
            setResetError(e.response?.data?.message || e.message || 'Gagal reset password.');
        } finally {
            setResetLoading(false);
        }
    };

    const handleDeleteChild = async () => {
        if (!childToDelete) return;
        setDeleteLoading(true);
        try {
            await deleteChildService(childToDelete.id);
            setDeleteModalOpen(false);
            setChildToDelete(null);
            loadData();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Gagal menghapus akun anak.');
        } finally {
            setDeleteLoading(false);
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
                <img src={IconBerandaBiru} alt="Ikon Keluarga" style={{ width: 32, height: 32 }} />
                <h2 className="text-primary fw-bold mb-0" style={{ fontSize: 35 }}>
                    Anggota Keluarga
                </h2>
            </div>

            {error ? <Alert variant="danger" style={{ borderRadius: 15 }}>{error}</Alert> : null}

            <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 25 }}>
                <Card.Body className="p-4 px-5">
                    <div className="d-flex justify-content-between align-items-start">
                        <div>
                            <div className="fw-bold text-dark" style={{ fontSize: 20 }}>
                                Saldo Total Anak
                            </div>
                            <div className="mt-2" style={{ fontSize: 48, fontWeight: 900, color: '#1389f9', letterSpacing: '-1px' }}>
                                {showSaldo ? formatRupiah(totalChildrenBalance) : 'Rp ••••••'}
                            </div>
                            <div className="text-muted fw-semibold" style={{ fontSize: 14 }}>
                                Saldo gabungan {childCount} anak
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowSaldo(!showSaldo)}
                            style={{ border: 0, background: 'transparent', padding: 8, color: '#9aa0a6' }}
                        >
                            {showSaldo ? <EyeFill size={24} /> : <EyeSlashFill size={24} />}
                        </button>
                    </div>
                </Card.Body>
            </Card>

            <Row className="g-4 mb-4">
                {children.map((c) => (
                    <Col key={c.id} md={6}>
                        <Card className="border-0 shadow-sm" style={{ borderRadius: 25, backgroundColor: '#dff0ff' }}>
                            <Card.Body className="p-4">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="bg-primary bg-opacity-10 p-2 rounded-circle text-primary d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                                            <div className="bg-primary rounded-circle" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: '#fff' }}>👤</div>
                                        </div>
                                        <div>
                                            <div className="fw-bold text-dark" style={{ fontSize: 22 }}>
                                                {c.username}
                                            </div>
                                            <div className="text-muted small">Saldo saat ini</div>
                                            <div className="fw-bold mt-1" style={{ fontSize: 26, color: '#1389f9' }}>
                                                {showSaldo ? formatRupiah(c.saldo) : 'Rp ••••••'}
                                            </div>
                                            <div className={`fw-bold small ${c.percentage_change >= 0 ? 'text-success' : 'text-danger'}`}>
                                                {c.percentage_change >= 0 ? '+' : ''}{c.percentage_change}% dari bulan lalu
                                            </div>
                                        </div>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <Button
                                            variant="outline-danger"
                                            onClick={() => openDeleteConfirm(c.id, c.username)}
                                            style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: 'rgba(220, 53, 69, 0.1)', color: '#dc3545' }}
                                        >
                                            <Trash size={20} />
                                        </Button>
                                        <Button
                                            variant="warning"
                                            onClick={() => openResetPassword(c.id, c.username)}
                                            style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 193, 7, 0.1)', color: '#ffc107', border: 'none' }}
                                        >
                                            <ArrowClockwise size={20} />
                                        </Button>
                                        <Button
                                            variant="primary"
                                            onClick={() => openDeposit(c.id)}
                                            style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <Plus size={32} />
                                        </Button>
                                    </div>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
                <Col md={6}>
                    <Card 
                        onClick={() => setCreateChildModalOpen(true)}
                        className="border-0 shadow-sm text-center h-100 d-flex flex-column align-items-center justify-content-center" 
                        style={{ 
                            borderRadius: 25, 
                            backgroundColor: '#dff0ff', 
                            border: '2px dashed #1389f9',
                            cursor: 'pointer',
                            minHeight: 160
                        }}
                    >
                        <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center mb-2" style={{ width: 56, height: 56, color: '#fff' }}>
                            <Plus size={36} />
                        </div>
                        <div className="fw-bold text-muted" style={{ fontSize: 16 }}>Tambahkan Akun Anak</div>
                    </Card>
                </Col>
            </Row>

            <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 25 }}>
                <Card.Body className="p-4">
                    <div className="fw-bold mb-4 text-dark" style={{ fontSize: 22 }}>
                        Analisis Keuangan
                    </div>
                    <div style={{ minHeight: 300 }}>
                        {historicalData.length > 0 ? (
                            <MonthlyBarChart key={JSON.stringify(historicalData)} chartData={historicalData} />
                        ) : (
                            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                                Belum ada data untuk ditampilkan.
                            </div>
                        )}
                    </div>
                </Card.Body>
            </Card>

            <AddChildModal 
                show={createChildModalOpen} 
                handleClose={() => setCreateChildModalOpen(false)} 
                onSuccess={handleCreateChildSuccess} 
            />

            <Modal show={depositModalOpen} onHide={() => setDepositModalOpen(false)} centered>
                <Modal.Header closeButton className="border-0 pt-4 px-4">
                    <Modal.Title className="fw-bold">Deposit ke Anak</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <Form.Group className="mb-4">
                        <Form.Label className="small text-muted fw-bold">Jumlah Deposit (Rp)</Form.Label>
                        <Form.Control 
                            type="text" 
                            value={depositAmount} 
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setDepositAmount(val ? parseInt(val).toLocaleString('id-ID') : '');
                            }} 
                            style={{ borderRadius: 12, padding: '12px', fontSize: 24, fontWeight: 'bold' }}
                        />
                    </Form.Group>
                    <Form.Group className="mb-4">
                        <Form.Label className="small text-muted fw-bold">Catatan (Opsional)</Form.Label>
                        <Form.Control 
                            type="text" 
                            value={depositKeterangan} 
                            onChange={(e) => setDepositKeterangan(e.target.value)}
                            placeholder="Contoh: Tabungan bulanan"
                            style={{ borderRadius: 12, padding: '12px' }}
                        />
                    </Form.Group>
                    <Button 
                        variant="primary" 
                        disabled={depositLoading} 
                        onClick={submitDeposit}
                        className="w-100 py-3 fw-bold"
                        style={{ borderRadius: 15 }}
                    >
                        {depositLoading ? <Spinner size="sm" /> : 'Konfirmasi Deposit'}
                    </Button>
                </Modal.Body>
            </Modal>

            <Modal show={deleteModalOpen} onHide={() => setDeleteModalOpen(false)} centered>
                <Modal.Header closeButton className="border-0 pt-4 px-4">
                    <Modal.Title className="fw-bold">Hapus Akun Anak</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <p className="text-center mb-4">
                        Apakah Anda yakin ingin menghapus akun <strong>{childToDelete?.username}</strong>? <br />
                        Semua data transaksi dan target akan ikut terhapus secara permanen.
                    </p>
                    <div className="d-flex gap-3">
                        <Button 
                            variant="light" 
                            className="w-100 py-2 fw-bold"
                            style={{ borderRadius: 12 }}
                            onClick={() => setDeleteModalOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button 
                            variant="danger" 
                            disabled={deleteLoading} 
                            onClick={handleDeleteChild}
                            className="w-100 py-2 fw-bold"
                            style={{ borderRadius: 12 }}
                        >
                            {deleteLoading ? <Spinner size="sm" /> : 'Ya, Hapus'}
                        </Button>
                    </div>
                </Modal.Body>
            </Modal>

            <TransactionModal show={showTransactionModal} handleClose={() => setShowTransactionModal(false)} onSuccess={loadData} />

            <ResetPasswordModal 
                show={resetPasswordModalOpen}
                handleClose={() => setResetPasswordModalOpen(false)}
                childUsername={childToReset?.username || ''}
                onConfirm={handleResetPassword}
                loading={resetLoading}
                error={resetError}
            />
        </MainLayout>
    );
};

export default FamilyPage;
