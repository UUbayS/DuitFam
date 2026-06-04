import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Spinner, Alert, Modal, Badge } from 'react-bootstrap';
import { ArrowRepeat, Plus, PencilSquare, Trash, Lightning, LightningChargeFill, Stopwatch, CheckCircleFill, XCircleFill } from 'react-bootstrap-icons';
import MainLayout from '../components/MainLayout';
import AddRecurringModal from '../components/AddRecurringModal';
import { fetchRecurringTransactions, deleteRecurringTransaction, generateAllRecurringTransactions } from '../services/recurring.service';
import type { RecurringFrequency, RecurringTransaction } from '../types/recurring.types';

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
    if (!tanggal) return '-';
    return new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const frequencyLabel = (f: RecurringFrequency): string => {
    if (f === 'daily') return 'Harian';
    if (f === 'weekly') return 'Mingguan';
    return 'Bulanan';
};

const RecurringTransactionPage: React.FC = () => {
    const [items, setItems] = useState<RecurringTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<RecurringTransaction | null>(null);
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
    const [generatingAll, setGeneratingAll] = useState(false);
    const [resultBanner, setResultBanner] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchRecurringTransactions();
            setItems(res.data ?? []);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Gagal memuat daftar transaksi berulang.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (!resultBanner) return;
        const timer = setTimeout(() => setResultBanner(null), 4000);
        return () => clearTimeout(timer);
    }, [resultBanner]);

    const openAdd = () => {
        setEditingItem(null);
        setShowAddModal(true);
    };

    const openEdit = (r: RecurringTransaction) => {
        setEditingItem(r);
        setShowAddModal(true);
    };

    const submitDelete = async () => {
        if (!deleteTarget) return;
        setActionLoading((p) => ({ ...p, [deleteTarget.id]: true }));
        try {
            await deleteRecurringTransaction(deleteTarget.id);
            setResultBanner({ type: 'success', text: 'Transaksi berulang dihapus.' });
            setDeleteTarget(null);
            loadData();
        } catch (err: any) {
            setResultBanner({ type: 'danger', text: err.response?.data?.message || 'Gagal menghapus.' });
        } finally {
            setActionLoading((p) => ({ ...p, [deleteTarget.id ?? '']: false }));
        }
    };

    const handleGenerateAll = async () => {
        setGeneratingAll(true);
        try {
            const res = await generateAllRecurringTransactions();
            setResultBanner({ type: 'success', text: res.message || 'Generate selesai.' });
            loadData();
        } catch (err: any) {
            setResultBanner({ type: 'danger', text: err.response?.data?.message || 'Gagal generate.' });
        } finally {
            setGeneratingAll(false);
        }
    };

    const frequencyDescription = (r: RecurringTransaction): string => {
        if (r.frequency === 'daily') return 'Setiap hari';
        if (r.frequency === 'weekly') {
            const names = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
            return `Setiap ${names[r.day_of_week ?? 1]}`;
        }
        return `Setiap tanggal ${r.day_of_month ?? 1} per bulan`;
    };

    if (loading) {
        return (
            <MainLayout hideAddButton>
                <div className="d-flex justify-content-center mt-5">
                    <Spinner animation="border" variant="primary" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout hideAddButton>
            <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
                <ArrowRepeat size={28} className="text-primary" />
                <h2 className="text-primary fw-bold mb-0" style={{ fontSize: 'calc(1.4rem + 1.2vw)' }}>
                    Transaksi Berulang
                </h2>
            </div>

            {error ? <Alert variant="danger" style={{ borderRadius: 15 }}>{error}</Alert> : null}
            {resultBanner && (
                <Alert variant={resultBanner.type} style={{ borderRadius: 15 }} onClose={() => setResultBanner(null)} dismissible>
                    <div className="d-flex align-items-center gap-2">
                        {resultBanner.type === 'success' ? <CheckCircleFill /> : <XCircleFill />}
                        <span>{resultBanner.text}</span>
                    </div>
                </Alert>
            )}

            <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 25, backgroundColor: '#eaf3ff' }}>
                <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
                        <div>
                            <div className="fw-bold text-dark mb-1" style={{ fontSize: 16 }}>Total Aktif</div>
                            <div className="fw-bold text-primary" style={{ fontSize: 28 }}>
                                {items.filter((r) => r.is_active).length}
                            </div>
                            <div className="text-muted small mt-1">dari {items.length} transaksi berulang</div>
                        </div>
                        <div className="d-flex gap-2 flex-wrap">
                            <Button
                                variant="outline-primary"
                                onClick={handleGenerateAll}
                                disabled={generatingAll || items.filter((r) => r.is_active).length === 0}
                                className="fw-bold"
                                style={{ borderRadius: 12 }}
                            >
                                {generatingAll ? <Spinner size="sm" /> : <LightningChargeFill className="me-2" />}
                                Generate Semua
                            </Button>
                            <Button
                                variant="primary"
                                onClick={openAdd}
                                className="fw-bold"
                                style={{ borderRadius: 12 }}
                            >
                                <Plus className="me-2" /> Tambah
                            </Button>
                        </div>
                    </div>
                </Card.Body>
            </Card>

            {items.length === 0 ? (
                <Card className="border-0 shadow-sm text-center py-5" style={{ borderRadius: 25, backgroundColor: '#f8fafc', border: '2px dashed #e2e8f0' }}>
                    <Card.Body className="d-flex flex-column align-items-center justify-content-center">
                        <ArrowRepeat size={48} className="text-muted mb-2" />
                        <h5 className="fw-bold text-muted">Belum ada transaksi berulang</h5>
                        <p className="text-muted small mb-3">Buat transaksi otomatis (harian, mingguan, atau bulanan) yang akan dicatat saat tombol Generate ditekan.</p>
                        <Button variant="primary" onClick={openAdd} style={{ borderRadius: 12 }}>
                            <Plus className="me-2" /> Tambah Transaksi Berulang
                        </Button>
                    </Card.Body>
                </Card>
            ) : (
                <div>
                    {items.map((r) => {
                        const isLoading = !!actionLoading[r.id];
                        return (
                            <Card key={r.id} className="mb-3 border-0 shadow-sm" style={{ borderRadius: 18 }}>
                                <Card.Body className="p-3 p-md-4">
                                    <div className="d-flex justify-content-between align-items-start gap-3">
                                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                            <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                                <span
                                                    className={`badge ${r.jenis === 'pemasukan' ? 'bg-success' : 'bg-danger'}`}
                                                    style={{ fontSize: 10 }}
                                                >
                                                    {r.jenis.toUpperCase()}
                                                </span>
                                                {r.is_active ? (
                                                    <Badge bg="primary" style={{ fontSize: 10 }}>Aktif</Badge>
                                                ) : (
                                                    <Badge bg="secondary" style={{ fontSize: 10 }}>Nonaktif</Badge>
                                                )}
                                                <span className="text-muted small">•</span>
                                                <span className="text-muted small">{frequencyLabel(r.frequency)}</span>
                                            </div>
                                            <div className="fw-bold text-dark text-truncate" style={{ fontSize: 16 }}>
                                                {r.nama_kategori}
                                            </div>
                                            <div className="fw-bold text-primary" style={{ fontSize: 20 }}>
                                                {formatRupiah(r.jumlah)}
                                            </div>
                                            {r.keterangan && (
                                                <div className="text-muted small text-truncate">{r.keterangan}</div>
                                            )}
                                            <div className="d-flex flex-column gap-1 mt-2">
                                                <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: 12 }}>
                                                    <Stopwatch size={12} />
                                                    <span>{frequencyDescription(r)}</span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: 12 }}>
                                                    <Lightning size={12} />
                                                    <span>
                                                        Berikutnya: {r.next_due_date ? formatTanggal(r.next_due_date) : '-'}
                                                    </span>
                                                </div>
                                                {r.last_generated_date && (
                                                    <div className="text-muted" style={{ fontSize: 11 }}>
                                                        Terakhir dicatat: {formatTanggal(r.last_generated_date)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="d-flex flex-column gap-2 flex-shrink-0">
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                onClick={() => openEdit(r)}
                                                disabled={isLoading}
                                                style={{ borderRadius: 10 }}
                                                title="Edit"
                                            >
                                                <PencilSquare size={14} />
                                            </Button>
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                onClick={() => setDeleteTarget(r)}
                                                disabled={isLoading}
                                                style={{ borderRadius: 10 }}
                                                title="Hapus"
                                            >
                                                <Trash size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        );
                    })}
                </div>
            )}

            <AddRecurringModal
                show={showAddModal}
                handleClose={() => setShowAddModal(false)}
                onSuccess={() => {
                    setResultBanner({ type: 'success', text: editingItem ? 'Transaksi berulang diperbarui.' : 'Transaksi berulang ditambahkan.' });
                    loadData();
                }}
                editingRecurring={editingItem}
            />

            <Modal show={!!deleteTarget} onHide={() => !actionLoading[deleteTarget?.id ?? ''] && setDeleteTarget(null)} centered>
                <Modal.Header closeButton className="border-0 pt-4 px-4">
                    <Modal.Title className="fw-bold">Hapus Transaksi Berulang?</Modal.Title>
                </Modal.Header>
                <Modal.Body className="px-4">
                    <p>
                        Apakah Anda yakin ingin menghapus transaksi berulang <strong>{deleteTarget?.nama_kategori}</strong> ({formatRupiah(deleteTarget?.jumlah ?? 0)})?
                    </p>
                    <p className="text-muted small mb-0">Transaksi yang sudah dicatat sebelumnya tidak akan terhapus.</p>
                </Modal.Body>
                <Modal.Footer className="border-0 px-4 pb-4">
                    <Button variant="light" onClick={() => setDeleteTarget(null)} disabled={!!actionLoading[deleteTarget?.id ?? '']} style={{ borderRadius: 12 }}>
                        Batal
                    </Button>
                    <Button variant="danger" onClick={submitDelete} disabled={!!actionLoading[deleteTarget?.id ?? '']} style={{ borderRadius: 12 }}>
                        {actionLoading[deleteTarget?.id ?? ''] ? <Spinner size="sm" /> : 'Ya, Hapus'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </MainLayout>
    );
};

export default RecurringTransactionPage;
