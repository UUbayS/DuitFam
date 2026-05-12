import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { PlusCircleFill, X } from 'react-bootstrap-icons';
import { linkChildByCode } from '../services/user.service';
import type { AxiosError } from 'axios';

interface AddChildModalProps {
    show: boolean;
    handleClose: () => void;
    onSuccess: () => void;
}

const AddChildModal: React.FC<AddChildModalProps> = ({ show, handleClose, onSuccess }) => {
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (show) {
            setInviteCode('');
            setError(null);
        }
    }, [show]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteCode.trim()) {
            setError('Silakan masukkan kode tautan.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await linkChildByCode({ invite_code: inviteCode.trim() });
            onSuccess();
            handleClose();
        } catch (err: any) {
            const axiosError = err as AxiosError<{ message: string }>;
            setError(axiosError.response?.data?.message || 'Gagal menautkan anak. Periksa kode tautan Anda.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered backdrop="static" className="add-child-modal">
            <div style={{ borderRadius: '5px', overflow: 'hidden', border: 'none' }}>
                <div className="bg-primary p-4 d-flex justify-content-between align-items-center">
                    <h4 className="modal-title text-white fw-bold mb-0">Tambah Anak</h4>
                    <Button variant="link" className="text-white p-0 shadow-none" onClick={handleClose}>
                        <X size={32} />
                    </Button>
                </div>

                <Modal.Body className="p-4 bg-white">
                    <p className="text-muted small mb-3">
                        Minta kode tautan dari anak Anda, lalu masukkan di sini untuk menautkan akun.
                    </p>

                    {error && (
                        <Alert variant="danger" className="border-0 rounded-3 mb-4">
                            {error}
                        </Alert>
                    )}

                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-4">
                            <Form.Label className="fw-bold text-dark mb-2">Kode Tautan (6 digit)</Form.Label>
                            <Form.Control
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                required
                                placeholder="Contoh: 123456"
                                maxLength={6}
                                style={{ borderRadius: '12px', padding: '12px', border: '1px solid #dee2e6', fontSize: '18px', letterSpacing: '8px', textAlign: 'center', fontFamily: 'monospace' }}
                            />
                        </Form.Group>

                        <Button
                            variant="primary"
                            type="submit"
                            disabled={loading || !inviteCode.trim()}
                            className="w-100 py-3 fw-bold d-flex align-items-center justify-content-center"
                            style={{ borderRadius: '15px', backgroundColor: '#007bff', border: 'none' }}
                        >
                            {loading ? (
                                <Spinner animation="border" size="sm" />
                            ) : (
                                <>
                                    <PlusCircleFill className="me-2" /> Tautkan Anak
                                </>
                            )}
                        </Button>
                    </Form>
                </Modal.Body>
            </div>
        </Modal>
    );
};

export default AddChildModal;