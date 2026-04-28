import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import * as Icons from 'react-bootstrap-icons';
import { 
    Calendar, 
    Tag, 
    Cash,
    ChatDots,
    CheckCircleFill,
    ArrowUp,
    ArrowDown
} from 'react-bootstrap-icons';
import { fetchCategories } from '../services/utility.service';
import { createTransaction } from '../services/transaction.service';
import { fetchActiveTargets } from '../services/target.service';
import type { TransactionInput, Category, TransactionType } from '../types/transaction.types'; 
import type { TargetMenabung } from '../types/target.types';
import type { AxiosError } from 'axios'; 


interface BackendErrorResponse {
    message: string;
}

interface TransactionModalProps {
    show: boolean;
    handleClose: () => void;
    onSuccess: () => void;
}

const initialFormState: Omit<TransactionInput, 'jumlah'> & { jumlah: string } = {
    jenis: 'pemasukan', 
    jumlah: '',
    tanggal: new Date().toISOString().split('T')[0], 
    keterangan: '',
    id_kategori: '',
    source_id: '',
};

const getErrorMessage = (err: unknown): string => {
    const axiosError = err as AxiosError<BackendErrorResponse>;
    if (axiosError.response && axiosError.response.data && axiosError.response.data.message) {
         return axiosError.response.data.message;
    }
    return 'Terjadi kesalahan jaringan atau server.';
};


const TransactionModal: React.FC<TransactionModalProps> = ({ show, handleClose, onSuccess }) => {
    const [formData, setFormData] = useState(initialFormState);
    const [categories, setCategories] = useState<Category[]>([]);
    const [targets, setTargets] = useState<TargetMenabung[]>([]);
    const [loading, setLoading] = useState(false);
    const [catLoading, setCatLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

    const inputStyle = {
        borderRadius: '12px',
        padding: '0.75rem 1rem',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
    };

    const loadCategoriesAndTargets = useCallback(async () => {
        setCatLoading(true);
        try {
            const [cats, activeTargets] = await Promise.all([
                fetchCategories(),
                fetchActiveTargets()
            ]);
            setCategories(cats);
            setTargets(activeTargets);
            if (cats.length > 0) {
                setFormData(prev => ({ 
                    ...prev, 
                    id_kategori: prev.id_kategori === '' ? cats[0].id_kategori : prev.id_kategori
                }));
            }
        } catch (err: unknown) {
            setMessage({ type: 'danger', text: getErrorMessage(err) });
        } finally {
            setCatLoading(false);
        }
    }, []); 

    useEffect(() => {
        if (show) {
             loadCategoriesAndTargets();
             setFormData(initialFormState);
             setMessage(null);
        }
    }, [show, loadCategoriesAndTargets]); 

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setMessage(null);
        
        if (name === 'jumlah') {
            const cleanValue = value.replace(/\D/g, ''); 
            const numberValue = parseInt(cleanValue) || 0;
            setFormData({ ...formData, [name]: numberValue.toLocaleString('id-ID') }); 
        } else if (name === 'id_kategori') {
            setFormData({ ...formData, [name]: value });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleTypeChange = (type: TransactionType) => {
        setFormData(prev => ({ ...prev, jenis: type, id_kategori: '' }));
        setMessage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericJumlah = parseFloat(formData.jumlah.replace(/\./g, ''));

        if (numericJumlah <= 0) {
            setMessage({ type: 'danger', text: 'Jumlah harus lebih dari 0.' });
            return;
        }
        if (formData.id_kategori === '') {
            setMessage({ type: 'danger', text: 'Pilih kategori.' });
            return;
        }

        setLoading(true);
        try {
            const dataToSend: TransactionInput = { ...formData, jumlah: numericJumlah };
            const res = await createTransaction(dataToSend);
            setMessage({ type: 'success', text: res.message });
            setTimeout(() => {
                handleClose();
                onSuccess();
            }, 1000);
        } catch (err: unknown) {
            setMessage({ type: 'danger', text: getErrorMessage(err) });
        } finally {
            setLoading(false);
        }
    };

    const filteredCategories = categories.filter(cat => cat.jenis === formData.jenis);

    return (
        <Modal show={show} onHide={handleClose} centered backdrop="static" className="transaction-modal">
            <div className="bg-white" style={{ borderRadius: '15px', overflow: 'hidden', border: 'none' }}>
                <div className="bg-primary p-3 d-flex justify-content-between align-items-center">
                    <h5 className="modal-title text-white fw-bold mb-0">Catat Transaksi Baru</h5>
                    <Button variant="link" className="text-white p-0" onClick={handleClose}>
                        <ArrowUp className="d-none" /> {/* placeholder */}
                        <span style={{ fontSize: '24px', lineHeight: '1' }}>&times;</span>
                    </Button>
                </div>

                <Modal.Body className="p-4">
                    {message && (
                        <Alert variant={message.type} className="border-0 rounded-3 mb-4 py-2">
                            <small className="fw-medium">{message.text}</small>
                        </Alert>
                    )}

                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold text-dark mb-2">
                                <Calendar className="text-primary me-2" /> Tanggal Transaksi
                            </Form.Label>
                            <Form.Control 
                                type="date" 
                                name="tanggal" 
                                value={formData.tanggal} 
                                onChange={handleChange} 
                                required 
                                className="py-2 px-3 border-secondary border-opacity-25"
                                style={{ borderRadius: '10px' }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold text-dark mb-2">
                                <Tag className="text-primary me-2" /> Jenis Transaksi
                            </Form.Label>
                            <div className="d-flex gap-4">
                                <Form.Check
                                    type="radio"
                                    id="type-pemasukan"
                                    label={<span><ArrowUp className="text-success" /> Pemasukan</span>}
                                    name="jenis"
                                    checked={formData.jenis === 'pemasukan'}
                                    onChange={() => handleTypeChange('pemasukan')}
                                    className="fw-medium"
                                />
                                <Form.Check
                                    type="radio"
                                    id="type-pengeluaran"
                                    label={<span><ArrowDown className="text-danger" /> Pengeluaran</span>}
                                    name="jenis"
                                    checked={formData.jenis === 'pengeluaran'}
                                    onChange={() => handleTypeChange('pengeluaran')}
                                    className="fw-medium"
                                />
                            </div>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold text-dark mb-2">
                                <Cash className="text-primary me-2" /> Jumlah
                            </Form.Label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-secondary border-opacity-25 px-3" style={{ borderRadius: '10px 0 0 10px' }}>Rp</span>
                                <Form.Control 
                                    type="text" 
                                    name="jumlah" 
                                    placeholder="0" 
                                    value={formData.jumlah} 
                                    onChange={handleChange} 
                                    required 
                                    className="py-2 border-secondary border-opacity-25"
                                    style={{ borderRadius: '0 10px 10px 0' }}
                                />
                            </div>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold text-dark mb-2">
                                <Icons.Wallet2 className="text-primary me-2" /> Sumber Dana
                            </Form.Label>
                            <Form.Select 
                                name="source_id" 
                                value={formData.source_id} 
                                onChange={handleChange}
                                className="py-2 px-3 border-secondary border-opacity-25"
                                style={{ borderRadius: '10px' }}
                            >
                                <option value="">Saldo Utama</option>
                                {targets.map(t => (
                                    <option key={t.id_target} value={t.id_target}>
                                        Kantong: {t.nama_target} ({t.jumlah_terkumpul.toLocaleString('id-ID')})
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>


                        <Form.Group className="mb-4">
                            <Form.Label className="fw-bold text-dark mb-3">
                                <Tag className="text-primary me-2" /> Pilih Kategori
                            </Form.Label>
                            
                            {catLoading ? (
                                <div className="text-center py-4">
                                    <Spinner animation="border" size="sm" variant="primary" />
                                    <p className="text-muted small mt-2">Memuat kategori...</p>
                                </div>
                            ) : (
                                <div className="category-grid" style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(4, 1fr)', 
                                    gap: '12px',
                                    maxHeight: '280px',
                                    overflowY: 'auto',
                                    padding: '4px'
                                }}>
                                    {filteredCategories.map(cat => {
                                        const IconComponent = (Icons as any)[cat.icon] || Icons.Tag;
                                        const isSelected = formData.id_kategori === cat.id_kategori;
                                        
                                        return (
                                            <div 
                                                key={cat.id_kategori}
                                                onClick={() => setFormData({ ...formData, id_kategori: cat.id_kategori })}
                                                className={`category-item d-flex flex-column align-items-center justify-content-center p-2 text-center cursor-pointer transition-all ${isSelected ? 'selected' : ''}`}
                                                style={{
                                                    borderRadius: '16px',
                                                    border: isSelected ? '2px solid var(--bs-primary)' : '1px solid #f1f5f9',
                                                    backgroundColor: isSelected ? 'rgba(13, 110, 253, 0.05)' : '#f8fafc',
                                                    cursor: 'pointer',
                                                    transition: '0.2s all ease-in-out',
                                                    minHeight: '80px'
                                                }}
                                            >
                                                <div 
                                                    className={`icon-wrapper mb-2 d-flex align-items-center justify-content-center ${isSelected ? 'text-primary' : 'text-secondary'}`}
                                                    style={{ 
                                                        fontSize: '24px',
                                                        width: '40px',
                                                        height: '40px',
                                                        borderRadius: '12px',
                                                        backgroundColor: isSelected ? 'rgba(13, 110, 253, 0.1)' : 'transparent'
                                                    }}
                                                >
                                                    <IconComponent />
                                                </div>
                                                <span 
                                                    className="cat-name fw-medium" 
                                                    style={{ 
                                                        fontSize: '10px', 
                                                        lineHeight: '1.2',
                                                        color: isSelected ? 'var(--bs-primary)' : '#64748b'
                                                    }}
                                                >
                                                    {cat.nama_kategori}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Form.Group>

                        <Form.Group className="mb-4">
                            <Form.Label className="fw-bold text-dark mb-2">
                                <ChatDots className="text-primary me-2" /> Keterangan (Opsional)
                            </Form.Label>
                            <Form.Control 
                                as="textarea" 
                                name="keterangan" 
                                placeholder="Contoh: Beli kopi..." 
                                value={formData.keterangan} 
                                onChange={handleChange} 
                                rows={3} 
                                className="py-2 px-3 border-secondary border-opacity-25"
                                style={{ borderRadius: '10px', resize: 'none' }} 
                            />
                        </Form.Group>

                        <Button 
                            variant="primary" 
                            type="submit" 
                            disabled={loading} 
                            className="w-100 py-2 border-0 fw-bold d-flex align-items-center justify-content-center" 
                            style={{ borderRadius: '10px' }}
                        >
                            {loading ? (
                                <Spinner animation="border" size="sm" />
                            ) : (
                                <>
                                    <CheckCircleFill className="me-2" /> Simpan Transaksi
                                </>
                            )}
                        </Button>
                    </Form>
                </Modal.Body>
            </div>
        </Modal>
    );
};

export default TransactionModal;
