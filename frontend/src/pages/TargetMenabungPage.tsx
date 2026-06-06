    import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Row, Col, Card, Button, ProgressBar, Spinner, Alert, Modal, Form, Dropdown } from 'react-bootstrap';
import MainLayout from '../components/MainLayout';
    import { Bullseye, EyeFill, EyeSlashFill, Plus, Trash, DashCircle, ChevronLeft, ChevronRight, ThreeDotsVertical, PencilSquare } from 'react-bootstrap-icons';
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

    const formatTanggal = (tanggal: string) => {
        const date = new Date(tanggal);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
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

        const [contributeModalOpen, setContributeModalOpen] = useState(false);
        const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
        const [deleteModalOpen, setDeleteModalOpen] = useState(false);
        const [selectedTarget, setSelectedTarget] = useState<{ id: string; name: string } | null>(null);
        const [amountInput, setAmountInput] = useState<string>('');
        const [editingTarget, setEditingTarget] = useState<TargetTypes.TargetMenabung | null>(null);
        const scrollContainerRef = useRef<HTMLDivElement>(null);

        const scroll = (direction: 'left' | 'right') => {
            if (scrollContainerRef.current) {
                const scrollAmount = 340;
                scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
            }
        };

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

    const openContribute = (targetId: string, name: string) => {
        setSelectedTarget({ id: targetId, name });
        setAmountInput('');
        setContributeModalOpen(true);
    };

    const submitContribute = async () => {
        if (!selectedTarget) return;
        const amount = Number(amountInput.replace(/\D/g, ''));
        if (!amount || amount <= 0) return;

        setContributeLoading(prev => ({ ...prev, [selectedTarget.id]: true }));
        try {
            await contributeToTarget({ id_target: selectedTarget.id, jumlah: amount });
            setContributeModalOpen(false);
            loadData();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Gagal menabung.');
        } finally {
            setContributeLoading(prev => ({ ...prev, [selectedTarget.id]: false }));
        }
    };

    const openWithdraw = (targetId: string, name: string) => {
        setSelectedTarget({ id: targetId, name });
        setAmountInput('');
        setWithdrawModalOpen(true);
    };

    const submitWithdraw = async () => {
        if (!selectedTarget) return;
        const amount = Number(amountInput.replace(/\D/g, ''));
        if (!amount || amount <= 0) return;

        setContributeLoading(prev => ({ ...prev, [selectedTarget.id]: true }));
        try {
            await withdrawFromTarget({ id_target: selectedTarget.id, jumlah: amount });
            setWithdrawModalOpen(false);
            loadData();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Gagal mengambil uang.');
        } finally {
            setContributeLoading(prev => ({ ...prev, [selectedTarget.id]: false }));
        }
    };

    const openDelete = (targetId: string, name: string) => {
        setSelectedTarget({ id: targetId, name });
        setDeleteModalOpen(true);
    };

    const openEdit = (target: TargetTypes.TargetMenabung) => {
        setEditingTarget(target);
        setShowAddSavingModal(true);
    };

    const closeAddSavingModal = () => {
        setShowAddSavingModal(false);
        setEditingTarget(null);
    };

    const submitDelete = async () => {
        if (!selectedTarget) return;
        setContributeLoading(prev => ({ ...prev, [selectedTarget.id]: true }));
        try {
            await cancelTarget(selectedTarget.id);
            setDeleteModalOpen(false);
            loadData();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Gagal menghapus kantong.');
        } finally {
            setContributeLoading(prev => ({ ...prev, [selectedTarget.id]: false }));
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
                    <div 
                        ref={scrollContainerRef}
                        className="d-flex gap-4 pb-2 target-scroll-container" 
                        style={{ 
                            overflowX: 'auto', 
                            scrollSnapType: 'x mandatory',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            scrollBehavior: 'smooth'
                        }}
                    >
                        {targets.map((target) => {
                            const progress = Math.floor((target.jumlah_terkumpul / target.target_jumlah) * 100);
                            return (
                                <div key={target.id_target} style={{ minWidth: '300px', maxWidth: '320px', flex: '0 0 auto', scrollSnapAlign: 'start' }}>
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
                                                          <div className="text-muted" style={{ fontSize: 11 }}>Deadline: {formatTanggal(target.tanggal_target)}</div>
                                                      </div>
                                                 </div>
                                                 <div className="d-flex align-items-center gap-1">
                                                     <div>
                                                         {target.status === 'tercapai' && (
                                                             <span className="badge bg-success" style={{ fontSize: 10 }}>Tercapai</span>
                                                         )}
                                                         {target.status === 'aktif' && (
                                                             <span className="badge bg-primary" style={{ fontSize: 10 }}>Aktif</span>
                                                         )}
                                                         {target.status === 'batal' && (
                                                             <span className="badge bg-danger" style={{ fontSize: 10 }}>Batal</span>
                                                         )}
                                                     </div>
                                                     {target.status !== 'batal' && (
                                                         <Dropdown align="end" onClick={(e) => e.stopPropagation()}>
                                                             <Dropdown.Toggle
                                                                 variant="link"
                                                                 id={`target-actions-${target.id_target}`}
                                                                 className="p-0 text-secondary shadow-none border-0"
                                                                 style={{ background: 'transparent', lineHeight: 1 }}
                                                             >
                                                                 <ThreeDotsVertical size={16} />
                                                             </Dropdown.Toggle>
                                                              <Dropdown.Menu
                                                                  popperConfig={{ modifiers: [{ name: 'preventOverflow', options: { boundary: 'viewport' } }] }}
                                                                  style={{ borderRadius: 12, fontSize: 13 }}
                                                              >
                                                                 <Dropdown.Item
                                                                     onClick={() => openEdit(target)}
                                                                     className="d-flex align-items-center gap-2"
                                                                 >
                                                                     <PencilSquare size={14} /> Edit Kantong
                                                                 </Dropdown.Item>
                                                             </Dropdown.Menu>
                                                         </Dropdown>
                                                     )}
                                                 </div>
                                             </div>

                                            <div className="mb-4">
                                                <div className="d-flex justify-content-between mb-1">
                                                    <span className="text-muted small fw-bold">Progress</span>
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
                                                    onClick={() => openContribute(target.id_target, target.nama_target)}
                                                    className="flex-grow-1 py-2 fw-bold"
                                                    style={{ borderRadius: 12, fontSize: 14 }}
                                                    disabled={contributeLoading[target.id_target]}
                                                >
                                                    {contributeLoading[target.id_target] ? <Spinner size="sm" /> : '+ Nabung'}
                                                </Button>
                                                <Button 
                                                    variant="outline-primary" 
                                                    onClick={() => openWithdraw(target.id_target, target.nama_target)}
                                                    className="py-2 px-3 fw-bold"
                                                    style={{ borderRadius: 12, fontSize: 14 }}
                                                    disabled={contributeLoading[target.id_target]}
                                                    title="Ambil Uang"
                                                >
                                                    <DashCircle size={20} />
                                                </Button>
                                                <Button 
                                                    variant="outline-danger" 
                                                    onClick={() => openDelete(target.id_target, target.nama_target)}
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
                                </div>
                            );
                        })}
                        
                        {targets.length === 0 && (
                            <div style={{ minWidth: '300px', width: '100%', flex: '0 0 auto', scrollSnapAlign: 'start' }}>
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
                            </div>
                        )}
                    </div>
                    <div className="d-flex justify-content-center mb-2 gap-2">
                        <Button variant="light" className="rounded-circle shadow-sm d-flex align-items-center justify-content-center border-0" style={{ width: '40px', height: '40px', backgroundColor: '#ffffff', color: '#1389f9' }} onClick={() => scroll('left')}>
                            <ChevronLeft size={20} />
                        </Button>
                        <Button variant="light" className="rounded-circle shadow-sm d-flex align-items-center justify-content-center border-0" style={{ width: '40px', height: '40px', backgroundColor: '#ffffff', color: '#1389f9' }} onClick={() => scroll('right')}>
                            <ChevronRight size={20} />
                        </Button>
                    </div>
                    <style>{`
                        .target-scroll-container::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>
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

            <Modal show={contributeModalOpen} onHide={() => setContributeModalOpen(false)} centered>
                <Modal.Header closeButton className="border-0 pt-4 px-4">
                    <Modal.Title className="fw-bold">Nabung ke Kantong</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <p className="text-muted mb-4">
                        Masukkan jumlah uang yang ingin ditabung ke kantong <strong>{selectedTarget?.name}</strong>.
                    </p>
                    <Form.Group className="mb-4">
                        <Form.Label className="small text-muted fw-bold">Jumlah Tabungan (Rp)</Form.Label>
                        <Form.Control 
                            type="text" 
                            value={amountInput} 
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setAmountInput(val ? parseInt(val).toLocaleString('id-ID') : '');
                            }} 
                            style={{ borderRadius: 12, padding: '12px', fontSize: 24, fontWeight: 'bold' }}
                            placeholder="0"
                        />
                    </Form.Group>
                    <Button 
                        variant="primary" 
                        disabled={!selectedTarget || contributeLoading[selectedTarget.id]} 
                        onClick={submitContribute}
                        className="w-100 py-3 fw-bold"
                        style={{ borderRadius: 15 }}
                    >
                        {selectedTarget && contributeLoading[selectedTarget.id] ? <Spinner size="sm" /> : 'Konfirmasi Tabungan'}
                    </Button>
                </Modal.Body>
            </Modal>

            <Modal show={withdrawModalOpen} onHide={() => setWithdrawModalOpen(false)} centered>
                <Modal.Header closeButton className="border-0 pt-4 px-4">
                    <Modal.Title className="fw-bold">Ambil dari Kantong</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <p className="text-muted mb-4">
                        Masukkan jumlah uang yang ingin diambil dari kantong <strong>{selectedTarget?.name}</strong>.
                    </p>
                    <Form.Group className="mb-4">
                        <Form.Label className="small text-muted fw-bold">Jumlah Ambil (Rp)</Form.Label>
                        <Form.Control 
                            type="text" 
                            value={amountInput} 
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setAmountInput(val ? parseInt(val).toLocaleString('id-ID') : '');
                            }} 
                            style={{ borderRadius: 12, padding: '12px', fontSize: 24, fontWeight: 'bold' }}
                            placeholder="0"
                        />
                    </Form.Group>
                    <Button 
                        variant="primary" 
                        disabled={!selectedTarget || contributeLoading[selectedTarget.id]} 
                        onClick={submitWithdraw}
                        className="w-100 py-3 fw-bold"
                        style={{ borderRadius: 15 }}
                    >
                        {selectedTarget && contributeLoading[selectedTarget.id] ? <Spinner size="sm" /> : 'Konfirmasi Ambil'}
                    </Button>
                </Modal.Body>
            </Modal>

            <Modal show={deleteModalOpen} onHide={() => setDeleteModalOpen(false)} centered>
                <Modal.Header closeButton className="border-0 pt-4 px-4">
                    <Modal.Title className="fw-bold">Hapus Kantong</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <p className="text-center mb-4">
                        Apakah Anda yakin ingin menghapus kantong <strong>{selectedTarget?.name}</strong>? <br />
                        Uang yang terkumpul akan dikembalikan ke saldo total anak.
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
                            disabled={!selectedTarget || contributeLoading[selectedTarget.id]} 
                            onClick={submitDelete}
                            className="w-100 py-2 fw-bold"
                            style={{ borderRadius: 12 }}
                        >
                            {selectedTarget && contributeLoading[selectedTarget.id] ? <Spinner size="sm" /> : 'Ya, Hapus'}
                        </Button>
                    </div>
                </Modal.Body>
            </Modal>

            <TransactionModal show={showTransactionModal} handleClose={() => setShowTransactionModal(false)} onSuccess={loadData} />
            <AddSavingGoalModal show={showAddSavingModal} handleClose={closeAddSavingModal} onSuccess={() => { closeAddSavingModal(); loadData(); }} editingTarget={editingTarget} />
        </MainLayout>
    );
};

export default TargetMenabungPage;
