import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Row, Spinner, Form } from 'react-bootstrap';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { createWithdrawalRequest, fetchWithdrawalRequests, processWithdrawalRequest } from '../services/approval.service';
import { fetchChildrenService } from '../services/user.service';
import TransactionModal from '../components/TransactionModal';
import type { WithdrawalRequestItem } from '../types/approval.types';
    import IconPersetujuanBiru from '../assets/IconApprovalBiru.svg'; // Assuming this exists or using generic if not

const formatRupiah = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.floor(amount));
    return formatted.replace('Rp', 'Rp. ');
};

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

    const onProcess = async (id: string, action: 'approved' | 'rejected') => {
        setActionLoading(prev => ({ ...prev, [id]: true }));
        try {
            await processWithdrawalRequest(id, { action });
            loadData();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Gagal memproses permintaan.');
        } finally {
            setActionLoading(prev => ({ ...prev, [id]: false }));
        }
    };

    const onSubmitRequest = async () => {
        const numericAmount = Number(amount);
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

    return (
        <MainLayout 
            onTransactionAdded={loadData} 
            openTransactionModal={() => setShowTransactionModal(true)}
            hideAddButton={false}
        >
            <div className="d-flex align-items-center gap-2 mb-4">
                {/* Fallback to IconAnalisisBiru style icon if IconApprovalBiru is missing */}
                <div style={{ backgroundColor: '#0b84ff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>✓</div>
                <h2 className="text-primary fw-bold mb-0" style={{ fontSize: 35 }}>
                    {user?.role === 'parent' ? 'Persetujuan' : 'Pengajuan'}
                </h2>
            </div>

            {error ? <Alert variant="danger" style={{ borderRadius: 15 }}>{error}</Alert> : null}

            {user?.role === 'child' && (
                <Card className="border-0 shadow-sm mb-5" style={{ borderRadius: 25 }}>
                    <Card.Body className="p-4">
                        <h4 className="fw-bold mb-4">Ajukan Penarikan Saldo</h4>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold small text-muted">Jumlah Penarikan (Rp)</Form.Label>
                            <Form.Control 
                                type="number" 
                                value={amount} 
                                onChange={(e) => setAmount(e.target.value)} 
                                placeholder="0"
                                className="py-3 px-4 rounded-4 border-0"
                                style={{ backgroundColor: '#f6f4ff' }}
                            />
                        </Form.Group>
                        <Form.Group className="mb-4">
                            <Form.Label className="fw-bold small text-muted">Alasan Penarikan</Form.Label>
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
                <Row className="g-4">
                    {data.filter(r => user?.role === 'parent' ? r.status === 'pending' : true).map((row) => (
                        <Col key={row.id} md={6} lg={4}>
                            <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 25, overflow: 'hidden' }}>
                                <Card.Body className="p-4">
                                    <div className="fw-bold mb-1" style={{ fontSize: 20 }}>
                                        {user?.role === 'parent' ? children[row.child_id] || 'Anak' : user?.username}
                                    </div>
                                    <div className="text-muted small mb-3">Penarikan saldo sejumlah:</div>
                                    <div className="fw-bold text-primary mb-3" style={{ fontSize: 24 }}>
                                        {formatRupiah(Number(row.amount))}
                                    </div>
                                    <div className="text-muted small mb-4" style={{ minHeight: 40 }}>
                                        <strong>Alasan:</strong> {row.reason || '-'}
                                    </div>
                                    
                                    {user?.role === 'parent' && row.status === 'pending' && (
                                        <div className="d-flex gap-2">
                                            <Button 
                                                variant="danger" 
                                                className="flex-grow-1 py-2 fw-bold rounded-3" 
                                                onClick={() => onProcess(row.id, 'rejected')}
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
                                                Setujui
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {row.status !== 'pending' && (
                                        <div className={`text-center py-2 fw-bold rounded-3 ${row.status === 'approved' ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'}`}>
                                            {row.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                    {data.length === 0 && (
                        <Col className="text-center p-5">
                            <div className="text-muted">Tidak ada data permintaan persetujuan.</div>
                        </Col>
                    )}
                </Row>
            )}

            <TransactionModal 
                show={showTransactionModal} 
                handleClose={() => setShowTransactionModal(false)} 
                onSuccess={loadData} 
            />
        </MainLayout>
    );
};

export default ApprovalPage;
