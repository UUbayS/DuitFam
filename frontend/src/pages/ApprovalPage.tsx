import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Row, Spinner, Form, Modal } from 'react-bootstrap';
import * as Icons from 'react-bootstrap-icons';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { createWithdrawalRequest, fetchWithdrawalRequests, processWithdrawalRequest } from '../services/approval.service';
import { fetchChildrenService } from '../services/user.service';
import TransactionModal from '../components/TransactionModal';
import type { WithdrawalRequestItem } from '../types/approval.types';

const formatRupiah = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.floor(amount));
    return formatted.replace('Rp', 'Rp. ');
};

// RequestCard Component
interface RequestCardProps {
    row: WithdrawalRequestItem;
    childName: string;
    showActions?: boolean;
    onProcess?: (id: string, action: 'approved' | 'rejected') => void;
    onRejectWithReason?: (id: string) => void;
    actionLoading?: Record<string, boolean>;
}

const RequestCard = ({ row, childName, showActions = false, onProcess, onRejectWithReason, actionLoading = {} }: RequestCardProps) => (
    <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 25, overflow: 'hidden' }}>
        <Card.Body className="p-4">
            <div className="fw-bold mb-1" style={{ fontSize: 20 }}>
                {childName}
            </div>
            <div className="text-muted small mb-3">Permintaan saldo sejumlah:</div>
            <div className="fw-bold text-primary mb-3" style={{ fontSize: 24 }}>
                {formatRupiah(Number(row.amount))}
            </div>
            <div className="text-muted small mb-4" style={{ minHeight: 40 }}>
                <strong>Alasan:</strong> {row.reason || '-'}
            </div>

            {showActions && row.status === 'pending' && (
                <div className="d-flex gap-2">
                    <Button
                        variant="danger"
                        className="flex-grow-1 py-2 fw-bold rounded-3"
                        onClick={() => onRejectWithReason ? onRejectWithReason(row.id) : onProcess?.(row.id, 'rejected')}
                        disabled={actionLoading[row.id]}
                    >
                        Tolak
                    </Button>
                    <Button
                        variant="primary"
                        className="flex-grow-1 py-2 fw-bold rounded-3"
                        onClick={() => onProcess?.(row.id, 'approved')}
                        disabled={actionLoading[row.id]}
                    >
                        Setujui
                    </Button>
                </div>
            )}

            {row.status === 'approved' && (
                <div className="text-center py-2 fw-bold rounded-3 bg-success bg-opacity-10 text-success">
                    Disetujui
                </div>
            )}

            {row.status === 'rejected' && (
                <div className="mt-3">
                    <div className="text-center py-2 fw-bold rounded-3 bg-danger bg-opacity-10 text-danger mb-2">
                        Ditolak
                    </div>
                    {row.rejection_reason && (
                        <div className="p-3 bg-light rounded-3">
                            <div className="text-muted small">
                                <strong>Alasan penolakan:</strong>
                                <div className="mt-1">{row.rejection_reason}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card.Body>
    </Card>
);

const ApprovalPage = () => {
    const { user } = useAuth();
    const [data, setData] = useState<WithdrawalRequestItem[]>([]);
    const [children, setChildren] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [amount, setAmount] = useState<string>('');
    const [reason, setReason] = useState('');
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingId, setRejectingId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [requests, kids] = await Promise.all([
                fetchWithdrawalRequests(),
                user?.role === 'parent' ? fetchChildrenService() : Promise.resolve([])
            ]);
            setData(requests);
            if (user?.role === 'parent') {
                const kidMap: Record<string, string> = {};
                kids.forEach(k => kidMap[k.id] = k.username);
                setChildren(kidMap);
            }
            setError(null);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Gagal memuat data persetujuan.');
        } finally {
            setLoading(false);
        }
    }, [user?.role]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onProcess = async (id: string, action: 'approved' | 'rejected', reason?: string) => {
        setActionLoading(prev => ({ ...prev, [id]: true }));
        try {
            await processWithdrawalRequest(id, { action, reason });
            loadData();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Gagal memproses permintaan.');
        } finally {
            setActionLoading(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleShowRejectModal = (id: string) => {
        setRejectingId(id);
        setRejectReason('');
        setShowRejectModal(true);
    };

    const handleRejectSubmit = async () => {
        if (rejectingId) {
            await onProcess(rejectingId, 'rejected', rejectReason);
            setShowRejectModal(false);
        }
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const cleanValue = e.target.value.replace(/\D/g, '');
        const numberValue = parseInt(cleanValue) || 0;
        setAmount(numberValue.toLocaleString('id-ID'));
    };

    const onSubmitRequest = async () => {
        const numericAmount = parseFloat(amount.replace(/\./g, ''));
        if (!numericAmount || numericAmount <= 0) return;
        setLoading(true);
        try {
            await createWithdrawalRequest({ amount: numericAmount, reason });
            setAmount('');
            setReason('');
            loadData();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Gagal membuat pengajuan.');
            setLoading(false);
        }
    };

    const pendingRequests = data.filter(r => r.status === 'pending');
    const historyRequests = data.filter(r => r.status !== 'pending');

    return (
        <MainLayout
            onTransactionAdded={loadData}
            openTransactionModal={() => setShowTransactionModal(true)}
            hideAddButton={false}
        >
            <div className="d-flex align-items-center gap-2 mb-4">
                <div style={{ backgroundColor: '#0b84ff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>✓</div>
                <h2 className="text-primary fw-bold mb-0" style={{ fontSize: 35 }}>
                    {user?.role === 'parent' ? 'Pusat Persetujuan' : 'Pengajuan'}
                </h2>
            </div>

            {error ? <Alert variant="danger" style={{ borderRadius: 15 }}>{error}</Alert> : null}

            {user?.role === 'child' && (
                <Card className="border-0 shadow-sm mb-5" style={{ borderRadius: 25 }}>
                    <Card.Body className="p-4">
                        <h4 className="fw-bold mb-4">Ajukan Permintaan Saldo</h4>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold small text-muted">Jumlah Permintaan (Rp)</Form.Label>
                            <Form.Control
                                 type="text"
                                 value={amount}
                                 onChange={handleAmountChange}
                                 placeholder="0"
                                 className="py-3 px-4 rounded-4 border-0"
                                 style={{ backgroundColor: '#f6f4ff' }}
                             />
                        </Form.Group>
                        <Form.Group className="mb-4">
                            <Form.Label className="fw-bold small text-muted">Alasan Permintaan</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Misal: Beli buku sekolah"
                                className="py-3 px-4 rounded-4 border-0"
                                style={{ backgroundColor: '#f6f4ff' }}
                            />
                        </Form.Group>
                        <Button variant="primary" className="w-100 py-3 fw-bold rounded-4 shadow-sm" onClick={onSubmitRequest} disabled={loading}>
                            {loading ? <Spinner size="sm" /> : 'Kirim Pengajuan'}
                        </Button>
                    </Card.Body>
                </Card>
            )}

            {loading && data.length === 0 ? (
                <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>
            ) : (
                <>
                    {/* Parent View */}
                    {user?.role === 'parent' && (
                        <>
                             {/* Section 1: Permintaan Masuk (Pending) */}
                             <div className="mb-5">
                                 <h4 className="fw-bold mb-4">Permintaan Masuk</h4>
                                 {pendingRequests.length === 0 ? (
                                     <div className="text-center p-5">
                                         <div className="text-muted" style={{ opacity: 0.6 }}>
                                             Tidak ada permintaan
                                         </div>
                                     </div>
                                 ) : (
                                     <div className="px-1">
                                         {pendingRequests.map((row) => (
                                             <Card key={row.id} className="mb-3 shadow-sm border-0" style={{ borderRadius: '18px', overflow: 'hidden' }}>
                                                 <Card.Body className="p-3">
                                                     <div className="d-flex align-items-center gap-3 mb-3">
                                                         <div
                                                             className="d-flex align-items-center justify-content-center flex-shrink-0"
                                                             style={{
                                                                 width: '45px',
                                                                 height: '45px',
                                                                 borderRadius: '14px',
                                                                 backgroundColor: 'rgba(255, 193, 7, 0.1)',
                                                                 color: '#ffc107',
                                                                 fontSize: '20px'
                                                             }}
                                                         >
                                                             <Icons.ClockFill />
                                                         </div>
                                                         <div className="flex-grow-1 d-flex flex-column min-width-0">
                                                             <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>
                                                                 {children[row.child_id] || 'Anak'}
                                                             </div>
                                                             <small className="text-muted" style={{ fontSize: '11px' }}>
                                                                 Pending • {new Date(row.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                                             </small>
                                                         </div>
                                                         <div className="fw-bold text-warning" style={{ fontSize: '14px' }}>
                                                             {formatRupiah(Number(row.amount))}
                                                         </div>
                                                     </div>
                                                     {row.reason && (
                                                         <div className="mb-3 p-2 bg-light rounded-3">
                                                             <small className="text-muted" style={{ fontSize: '11px' }}>
                                                                 <strong>Alasan:</strong> {row.reason}
                                                             </small>
                                                         </div>
                                                     )}
                                                     <div className="d-flex gap-2">
                                                         <Button
                                                             variant="danger"
                                                             className="flex-grow-1 py-2 fw-bold rounded-3"
                                                             onClick={() => handleShowRejectModal(row.id)}
                                                             disabled={actionLoading[row.id]}
                                                         >
                                                             Tolak
                                                         </Button>
                                                         <Button
                                                             variant="primary"
                                                             className="flex-grow-1 py-2 fw-bold rounded-3"
                                                             onClick={() => onProcess(row.id, 'approved')}
                                                             disabled={actionLoading[row.id]}
                                                         >
                                                             {actionLoading[row.id] ? <Spinner size="sm" /> : 'Setujui'}
                                                         </Button>
                                                     </div>
                                                 </Card.Body>
                                             </Card>
                                         ))}
                                     </div>
                                 )}
                             </div>

                            {/* Section 2: Riwayat Persetujuan (Approved/Rejected) */}
                            <div>
                                <h4 className="fw-bold mb-4">Riwayat Persetujuan</h4>
                                {historyRequests.length === 0 ? (
                                    <div className="text-center p-5">
                                        <div className="text-muted">
                                            Tidak ada riwayat persetujuan.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="px-1">
                                        {historyRequests.map((row) => (
                                            <Card key={row.id} className="mb-3 shadow-sm border-0" style={{ borderRadius: '18px', overflow: 'hidden' }}>
                                                <Card.Body className="p-3">
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div
                                                            className="d-flex align-items-center justify-content-center flex-shrink-0"
                                                            style={{
                                                                width: '45px',
                                                                height: '45px',
                                                                borderRadius: '14px',
                                                                backgroundColor: row.status === 'approved' ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                                                                color: row.status === 'approved' ? '#28a745' : '#dc3545',
                                                                fontSize: '20px'
                                                            }}
                                                        >
                                                            {row.status === 'approved' ? <Icons.CheckCircleFill /> : <Icons.XCircleFill />}
                                                        </div>
                                                        <div className="flex-grow-1 d-flex flex-column min-width-0">
                                                            <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                                                                <div className="fw-bold text-dark text-truncate" style={{ fontSize: '14px' }}>
                                                                    {children[row.child_id] || 'Anak'}
                                                                </div>
                                                            </div>
                                                            <div className="d-flex justify-content-between align-items-center">
                                                                <small className="text-muted" style={{ fontSize: '11px' }}>
                                                                    {row.status === 'approved' ? 'Disetujui' : 'Ditolak'} • {new Date(row.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                                                </small>
                                                                <div
                                                                    className="fw-bold"
                                                                    style={{
                                                                        color: row.status === 'approved' ? '#28a745' : '#dc3545',
                                                                        fontSize: '14px'
                                                                    }}
                                                                >
                                                                    {formatRupiah(Number(row.amount))}
                                                                </div>
                                                            </div>
                                                            {row.reason && (
                                                                <small className="text-muted mt-1" style={{ fontSize: '11px' }}>
                                                                    <strong>Alasan:</strong> {row.reason}
                                                                </small>
                                                            )}
                                                            {row.status === 'rejected' && row.rejection_reason && (
                                                                <div className="mt-2 p-2 bg-light rounded-3">
                                                                    <small className="text-muted" style={{ fontSize: '11px' }}>
                                                                        <strong>Alasan penolakan:</strong> {row.rejection_reason}
                                                                    </small>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Child View */}
                    {user?.role === 'child' && (
                        <>
                            <h4 className="fw-bold mb-4">Riwayat Pengajuan</h4>
                            {data.length === 0 ? (
                                <div className="text-center p-5">
                                    <div className="text-muted">Tidak ada data permintaan.</div>
                                </div>
                            ) : (
                                <div className="px-1">
                                    {data.map((row) => (
                                        <Card key={row.id} className="mb-3 shadow-sm border-0" style={{ borderRadius: '18px', overflow: 'hidden' }}>
                                            <Card.Body className="p-3">
                                                <div className="d-flex align-items-center gap-3">
                                                    <div
                                                        className="d-flex align-items-center justify-content-center flex-shrink-0"
                                                        style={{
                                                            width: '45px',
                                                            height: '45px',
                                                            borderRadius: '14px',
                                                            backgroundColor: row.status === 'approved' ? 'rgba(40, 167, 69, 0.1)' : row.status === 'rejected' ? 'rgba(220, 53, 69, 0.1)' : 'rgba(255, 193, 7, 0.1)',
                                                            color: row.status === 'approved' ? '#28a745' : row.status === 'rejected' ? '#dc3545' : '#ffc107',
                                                            fontSize: '20px'
                                                        }}
                                                    >
                                                        {row.status === 'approved' ? <Icons.CheckCircleFill /> : row.status === 'rejected' ? <Icons.XCircleFill /> : <Icons.ClockFill />}
                                                    </div>
                                                    <div className="flex-grow-1 d-flex flex-column min-width-0">
                                                        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                                                            <div className="fw-bold text-dark text-truncate" style={{ fontSize: '14px' }}>
                                                                {user?.username || 'Anak'}
                                                            </div>
                                                        </div>
                                                        <div className="d-flex justify-content-between align-items-center">
                                                            <small className="text-muted" style={{ fontSize: '11px' }}>
                                                                {row.status === 'approved' ? 'Disetujui' : row.status === 'rejected' ? 'Ditolak' : 'Pending'} • {new Date(row.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                                            </small>
                                                            <div
                                                                className="fw-bold"
                                                                style={{
                                                                    color: row.status === 'approved' ? '#28a745' : row.status === 'rejected' ? '#dc3545' : '#ffc107',
                                                                    fontSize: '14px'
                                                                }}
                                                            >
                                                                {formatRupiah(Number(row.amount))}
                                                            </div>
                                                        </div>
                                                        {row.reason && (
                                                            <small className="text-muted mt-1" style={{ fontSize: '11px' }}>
                                                                <strong>Alasan:</strong> {row.reason}
                                                            </small>
                                                        )}
                                                        {row.status === 'rejected' && row.rejection_reason && (
                                                            <div className="mt-2 p-2 bg-light rounded-3">
                                                                <small className="text-muted" style={{ fontSize: '11px' }}>
                                                                    <strong>Alasan penolakan:</strong> {row.rejection_reason}
                                                                </small>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {/* Rejection Reason Modal */}
            <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered backdrop="static">
                <Modal.Header closeButton>
                    <Modal.Title><strong>Alasan Penolakan</strong></Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Masukkan alasan penolakan..."
                            className="py-3 px-4 rounded-4 border-0"
                            style={{ backgroundColor: '#f6f4ff' }}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
                        Batal
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleRejectSubmit}
                        disabled={actionLoading[rejectingId || '']}
                    >
                        {actionLoading[rejectingId || ''] ? <Spinner size="sm" /> : 'Tolak Permintaan'}
                    </Button>
                </Modal.Footer>
            </Modal>

            <TransactionModal
                show={showTransactionModal}
                handleClose={() => setShowTransactionModal(false)}
                onSuccess={loadData}
            />
        </MainLayout>
    );
};

export default ApprovalPage;
