import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { 
    CheckCircle, 
    XCircle, 
    Calendar, 
    Tag, 
    FileText, 
    Wallet2, 
    ArrowUpCircle, 
    ArrowDownCircle 
} from 'react-bootstrap-icons';
import { fetchCategories } from '../services/utility.service';
import { createTransaction } from '../services/transaction.service';
import type { TransactionInput, Category, TransactionType } from '../types/transaction.types'; 
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
    const [loading, setLoading] = useState(false);
    const [catLoading, setCatLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

    const inputStyle = {
        borderRadius: '12px',
        padding: '0.75rem 1rem',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
    };

    const loadCategories = useCallback(async () => {
        setCatLoading(true);
        try {
            const cats = await fetchCategories();
            setCategories(cats);
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
             loadCategories();
             setFormData(initialFormState);
             setMessage(null);
        }
    }, [show, loadCategories]); 

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
        setFormData(prev => ({ ...prev, jenis: type }));
        setMessage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numericJumlah = parseFloat(formData.jumlah.replace(/\./g, ''));

        if (numericJumlah <= 0 || !formData.keterangan || formData.id_kategori === '') {
            setMessage({ type: 'danger', text: 'Semua field wajib diisi dengan benar.' });
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

    const filteredCategories = categories.filter(cat => {
        const name = cat.nama_kategori.toLowerCase();
        const isIncomeCat = name.includes('gaji') || name.includes('bonus') || name.includes('investasi');
        return formData.jenis === 'pemasukan' ? isIncomeCat : !isIncomeCat;
    });

    return (
        <Modal show={show} onHide={handleClose} centered backdrop="static">
            <div className="bg-white shadow-lg" style={{ borderRadius: '20px', overflow: 'hidden', border: 'none' }}>
                <Modal.Header closeButton className="border-0 pt-4 px-4 pb-0">
                    <Modal.Title className="fw-bold d-flex align-items-center">
                        <div className="bg-primary bg-opacity-10 p-2 rounded-3 me-3 text-primary">
                            <Wallet2 size={24} />
                        </div>
                        Catat Transaksi
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body className="px-4 pb-4 pt-3">
                    {message && (
                        <Alert variant={message.type} className="border-0 rounded-4 mb-4">
                            {message.type === 'success' ? <CheckCircle className="me-2" /> : <XCircle className="me-2" />}
                            <small className="fw-medium">{message.text}</small>
                        </Alert>
                    )}

                    <Form onSubmit={handleSubmit}>
                        
                        <div className="d-flex p-1 bg-light rounded-4 mb-4" style={{ borderRadius: '15px' }}>
                            <button
                                type="button"
                                onClick={() => handleTypeChange('pemasukan')}
                                className={`flex-fill border-0 py-2 rounded-4 ${formData.jenis === 'pemasukan' ? 'bg-white shadow-sm fw-bold text-success' : 'bg-transparent text-muted'}`}
                                style={{ borderRadius: '12px', fontSize: '14px', transition: '0.3s' }}
                            >
                                <ArrowUpCircle className="me-2" /> Pemasukan
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTypeChange('pengeluaran')}
                                className={`flex-fill border-0 py-2 rounded-4 ${formData.jenis === 'pengeluaran' ? 'bg-white shadow-sm fw-bold text-danger' : 'bg-transparent text-muted'}`}
                                style={{ borderRadius: '12px', fontSize: '14px', transition: '0.3s' }}
                            >
                                <ArrowDownCircle className="me-2" /> Pengeluaran
                            </button>
                        </div>

                        <div className="row g-3">
                            <div className="col-6">
                                <Form.Group>
                                    <Form.Label className="fw-semibold small text-muted mb-2"><Calendar size={14} className="me-1"/> Tanggal</Form.Label>
                                    <Form.Control type="date" name="tanggal" value={formData.tanggal} onChange={handleChange} required style={inputStyle} />
                                </Form.Group>
                            </div>
                            <div className="col-6">
                                <Form.Group>
                                    <Form.Label className="fw-semibold small text-muted mb-2"><Tag size={14} className="me-1"/> Kategori</Form.Label>
                                    <Form.Select name="id_kategori" value={formData.id_kategori} onChange={handleChange} disabled={catLoading} required style={inputStyle}>
                                        <option value="" disabled>Pilih...</option>
                                        {filteredCategories.map(cat => <option key={cat.id_kategori} value={cat.id_kategori}>{cat.nama_kategori}</option>)}
                                    </Form.Select>
                                </Form.Group>
                            </div>
                        </div>

                        <Form.Group className="mt-3 mb-3">
                            <Form.Label className="fw-semibold small text-muted mb-2"><Wallet2 size={14} className="me-1"/> Nominal (Rp)</Form.Label>
                            <Form.Control type="text" name="jumlah" placeholder="0" value={formData.jumlah} onChange={handleChange} required style={inputStyle} className="fw-bold fs-5 text-primary" />
                        </Form.Group>

                        <Form.Group className="mb-4">
                            <Form.Label className="fw-semibold small text-muted mb-2"><FileText size={14} className="me-1"/> Keterangan</Form.Label>
                            <Form.Control as="textarea" name="keterangan" placeholder="Catatan transaksi..." value={formData.keterangan} onChange={handleChange} rows={2} style={{ ...inputStyle, resize: 'none' }} />
                        </Form.Group>

                        <Button variant="primary" type="submit" disabled={loading} className="w-100 py-3 border-0 shadow-sm fw-bold" style={{ borderRadius: '15px' }}>
                            {loading ? <Spinner animation="border" size="sm" /> : 'Simpan Transaksi'}
                        </Button>
                    </Form>
                </Modal.Body>
            </div>
        </Modal>
    );
};

export default TransactionModal;
