import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, InputGroup, Spinner, Alert } from 'react-bootstrap';
import { createNewTarget, updateTarget } from '../services/target.service';
import type { TargetInput, TargetMenabung } from '../types/target.types';
import type { AxiosError } from 'axios';

interface AddSavingGoalModalProps {
    show: boolean;
    handleClose: () => void;
    onSuccess: () => void;
    editingTarget?: TargetMenabung | null;
}

const initialFormState: Omit<TargetInput, 'target_jumlah'> & { target_jumlah: string } = {
    nama_target: '',
    target_jumlah: '',
    tanggal_target: '',
};

const AddSavingGoalModal: React.FC<AddSavingGoalModalProps> = ({ show, handleClose, onSuccess, editingTarget }) => {
    const isEdit = Boolean(editingTarget);
    const [formData, setFormData] = useState(initialFormState);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!show) return;
        setError(null);
        if (editingTarget) {
            setFormData({
                nama_target: editingTarget.nama_target ?? '',
                target_jumlah: Number(editingTarget.target_jumlah).toLocaleString('id-ID'),
                tanggal_target: (editingTarget.tanggal_target ?? '').toString().split('T')[0] ?? '',
            });
        } else {
            setFormData(initialFormState);
        }
    }, [show, editingTarget]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'target_jumlah') {
            const numericValue = value.replace(/\D/g, '');
            setFormData({ ...formData, [name]: numericValue ? parseInt(numericValue).toLocaleString('id-ID') : '' });
        } else {
            setFormData({ ...formData, [name]: value });
        }
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericTarget = parseInt(formData.target_jumlah.replace(/\./g, ''));

        if (!formData.nama_target || !formData.tanggal_target || isNaN(numericTarget) || numericTarget <= 0) {
            setError('Semua field wajib diisi dengan benar.');
            return;
        }

        if (isEdit && editingTarget) {
            const current = Number(editingTarget.jumlah_terkumpul) || 0;
            if (numericTarget < current) {
                setError(`Target tidak boleh lebih kecil dari jumlah terkumpul saat ini (Rp ${current.toLocaleString('id-ID')}).`);
                return;
            }
        }

        setLoading(true);
        try {
            if (isEdit && editingTarget) {
                await updateTarget(editingTarget.id_target, {
                    nama_target: formData.nama_target,
                    target_jumlah: numericTarget,
                    tanggal_target: formData.tanggal_target,
                });
            } else {
                await createNewTarget({
                    nama_target: formData.nama_target,
                    target_jumlah: numericTarget,
                    tanggal_target: formData.tanggal_target
                });
            }
            onSuccess();
            handleClose();
        } catch (err: any) {
            const axiosError = err as AxiosError<{ message: string }>;
            setError(axiosError.response?.data?.message || (isEdit ? 'Gagal memperbarui kantong tabungan.' : 'Gagal membuat kantong tabungan.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered backdrop="static" className="add-saving-modal">
            <div className="bg-white" style={{ borderRadius: '5px', overflow: 'hidden', border: 'none' }}>
                <div className="bg-primary p-4 text-center position-relative">
                    <h4 className="modal-title text-white fw-bold mb-0">
                        {isEdit ? 'Edit Kantong Tabungan' : 'Tambah Kantong Tabungan'}
                    </h4>
                    <Button 
                        variant="link" 
                        className="text-white position-absolute top-50 end-0 translate-middle-y me-3" 
                        onClick={handleClose}
                        style={{ textDecoration: 'none', fontSize: '28px', lineHeight: '1' }}
                    >
                        &times;
                    </Button>
                </div>

                <Modal.Body className="p-4">
                    {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
                    
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-4">
                            <Form.Label className="fw-bold text-dark mb-2">Nama Kantong</Form.Label>
                            <Form.Control 
                                type="text" 
                                name="nama_target" 
                                value={formData.nama_target} 
                                onChange={handleChange}
                                placeholder="Contoh: Beli Laptop Baru"
                                required 
                                className="py-3 px-3 border-secondary border-opacity-25"
                                style={{ borderRadius: '15px', backgroundColor: '#fff' }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-4">
                            <Form.Label className="fw-bold text-dark mb-2">Tanggal Target</Form.Label>
                            <Form.Control 
                                type="date" 
                                name="tanggal_target" 
                                value={formData.tanggal_target} 
                                onChange={handleChange}
                                required 
                                className="py-3 px-3 border-secondary border-opacity-25"
                                style={{ borderRadius: '15px', backgroundColor: '#fff' }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-5">
                            <Form.Label className="fw-bold text-dark mb-2">Target Menabung</Form.Label>
                            <InputGroup>
                                <InputGroup.Text 
                                    className="bg-light border-secondary border-opacity-25 px-4 fw-bold text-secondary" 
                                    style={{ borderRadius: '15px 0 0 15px' }}
                                >
                                    Rp
                                </InputGroup.Text>
                                <Form.Control 
                                    type="text" 
                                    name="target_jumlah" 
                                    value={formData.target_jumlah} 
                                    onChange={handleChange}
                                    placeholder="0"
                                    required 
                                    className="py-3 border-secondary border-opacity-25"
                                    style={{ borderRadius: '0 15px 15px 0' }}
                                />
                            </InputGroup>
                        </Form.Group>

                        <Button 
                            variant="primary" 
                            type="submit" 
                            disabled={loading} 
                            className="w-100 py-3 fw-bold border-0 shadow-sm" 
                            style={{ borderRadius: '25px', backgroundColor: '#007bff', fontSize: '18px' }}
                        >
                            {loading ? <Spinner animation="border" size="sm" /> : (isEdit ? 'Simpan Perubahan' : '+ Tambah Kantong')}
                        </Button>
                    </Form>
                </Modal.Body>
            </div>
        </Modal>
    );
};

export default AddSavingGoalModal;
