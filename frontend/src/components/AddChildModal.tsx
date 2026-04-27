import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { PlusCircleFill, X } from 'react-bootstrap-icons';
import { createChildService } from '../services/user.service';
import type { AxiosError } from 'axios';

interface AddChildModalProps {
    show: boolean;
    handleClose: () => void;
    onSuccess: () => void;
}

const initialFormState = {
    username: '',
    email: '',
    password: '',
    saldo_awal: '',
};

const AddChildModal: React.FC<AddChildModalProps> = ({ show, handleClose, onSuccess }) => {
    const [formData, setFormData] = useState(initialFormState);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (show) {
            setFormData(initialFormState);
            setError(null);
        }
    }, [show]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'saldo_awal') {
            const numericValue = value.replace(/\D/g, '');
            setFormData({ ...formData, [name]: numericValue ? parseInt(numericValue).toLocaleString('id-ID') : '' });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const dataToSubmit = {
                ...formData,
                saldo_awal: formData.saldo_awal ? parseInt(formData.saldo_awal.replace(/\./g, '')) : 0,
            };

            await createChildService(dataToSubmit);
            onSuccess();
            handleClose();
        } catch (err: any) {
            const axiosError = err as AxiosError<{ message: string }>;
            setError(axiosError.response?.data?.message || 'Terjadi kesalahan saat membuat akun anak.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered backdrop="static" className="add-child-modal">
            <div style={{ borderRadius: '25px', overflow: 'hidden', border: 'none' }}>
                <div className="bg-primary p-4 d-flex justify-content-between align-items-center">
                    <h4 className="modal-title text-white fw-bold mb-0">Tambah Akun Anak</h4>
                    <Button variant="link" className="text-white p-0 shadow-none" onClick={handleClose}>
                        <X size={32} />
                    </Button>
                </div>

                <Modal.Body className="p-4 bg-white">
                    {error && (
                        <Alert variant="danger" className="border-0 rounded-3 mb-4">
                            {error}
                        </Alert>
                    )}

                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold text-dark mb-2">Email</Form.Label>
                            <Form.Control
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                placeholder="Masukkan email anak"
                                style={{ borderRadius: '12px', padding: '12px', border: '1px solid #dee2e6' }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold text-dark mb-2">Username</Form.Label>
                            <Form.Control
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                placeholder="Masukkan username"
                                style={{ borderRadius: '12px', padding: '12px', border: '1px solid #dee2e6' }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold text-dark mb-2">Password</Form.Label>
                            <Form.Control
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                placeholder="Masukkan password"
                                style={{ borderRadius: '12px', padding: '12px', border: '1px solid #dee2e6' }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-4">
                            <Form.Label className="fw-bold text-dark mb-2">Saldo Awal</Form.Label>
                            <InputGroup>
                                <InputGroup.Text 
                                    className="bg-light border-end-0 px-3" 
                                    style={{ borderRadius: '12px 0 0 12px', fontWeight: 'bold', color: '#6c757d' }}
                                >
                                    Rp
                                </InputGroup.Text>
                                <Form.Control
                                    type="text"
                                    name="saldo_awal"
                                    value={formData.saldo_awal}
                                    onChange={handleChange}
                                    placeholder="0"
                                    className="border-start-0"
                                    style={{ borderRadius: '0 12px 12px 0', padding: '12px', border: '1px solid #dee2e6' }}
                                />
                            </InputGroup>
                        </Form.Group>

                        <Button
                            variant="primary"
                            type="submit"
                            disabled={loading}
                            className="w-100 py-3 fw-bold d-flex align-items-center justify-content-center"
                            style={{ borderRadius: '15px', backgroundColor: '#007bff', border: 'none' }}
                        >
                            {loading ? (
                                <Spinner animation="border" size="sm" />
                            ) : (
                                <>
                                    <PlusCircleFill className="me-2" /> Tambah Akun Anak
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
