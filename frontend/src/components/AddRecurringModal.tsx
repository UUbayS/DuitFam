import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Row, Col, Button, Alert } from 'react-bootstrap';
import { ArrowRepeat } from 'react-bootstrap-icons';
import type { RecurringFrequency, RecurringInput, RecurringJenis, RecurringTransaction } from '../types/recurring.types';
import type { Category } from '../types/transaction.types';
import { fetchCategories } from '../services/utility.service';

interface AddRecurringModalProps {
    show: boolean;
    handleClose: () => void;
    onSuccess: () => void;
    editingRecurring?: RecurringTransaction | null;
}

const formatDateInput = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const AddRecurringModal: React.FC<AddRecurringModalProps> = ({ show, handleClose, onSuccess, editingRecurring }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<RecurringInput>({
        category_id: '',
        jenis: 'pengeluaran',
        jumlah: 0,
        keterangan: '',
        frequency: 'monthly',
        day_of_week: 1,
        day_of_month: 1,
        start_date: formatDateInput(new Date()),
        end_date: '',
    });

    useEffect(() => {
        if (!show) return;
        setError(null);
        fetchCategories()
            .then((res) => setCategories(res ?? []))
            .catch(() => setError('Gagal memuat daftar kategori.'));
    }, [show]);

    useEffect(() => {
        if (!show) return;
        if (editingRecurring) {
            setForm({
                category_id: editingRecurring.category_id,
                jenis: editingRecurring.jenis,
                jumlah: editingRecurring.jumlah,
                keterangan: editingRecurring.keterangan ?? '',
                frequency: editingRecurring.frequency,
                day_of_week: editingRecurring.day_of_week ?? 1,
                day_of_month: editingRecurring.day_of_month ?? 1,
                start_date: editingRecurring.start_date,
                end_date: editingRecurring.end_date ?? '',
            });
        } else {
            setForm({
                category_id: '',
                jenis: 'pengeluaran',
                jumlah: 0,
                keterangan: '',
                frequency: 'monthly',
                day_of_week: 1,
                day_of_month: 1,
                start_date: formatDateInput(new Date()),
                end_date: '',
            });
        }
    }, [show, editingRecurring]);

    const filteredCategories = useMemo(() => {
        return categories.filter((c) => c.jenis === form.jenis);
    }, [categories, form.jenis]);

    const handleChange = (key: keyof RecurringInput, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async () => {
        setError(null);
        if (!form.category_id) {
            setError('Pilih kategori terlebih dahulu.');
            return;
        }
        if (!form.jumlah || form.jumlah <= 0) {
            setError('Jumlah harus lebih dari 0.');
            return;
        }
        if (!form.start_date) {
            setError('Tanggal mulai wajib diisi.');
            return;
        }
        if (form.frequency === 'weekly' && (!form.day_of_week || form.day_of_week < 1 || form.day_of_week > 7)) {
            setError('Hari mingguan harus 1-7 (1=Senin).');
            return;
        }
        if (form.frequency === 'monthly' && (!form.day_of_month || form.day_of_month < 1 || form.day_of_month > 31)) {
            setError('Tanggal bulanan harus 1-31.');
            return;
        }
        if (form.end_date && form.end_date < form.start_date) {
            setError('Tanggal selesai harus setelah tanggal mulai.');
            return;
        }

        setLoading(true);
        try {
            const payload: RecurringInput = {
                category_id: form.category_id,
                jenis: form.jenis as RecurringJenis,
                jumlah: Number(form.jumlah),
                keterangan: form.keterangan?.trim() ? form.keterangan.trim() : null,
                frequency: form.frequency as RecurringFrequency,
                day_of_week: form.frequency === 'weekly' ? Number(form.day_of_week) : null,
                day_of_month: form.frequency === 'monthly' ? Number(form.day_of_month) : null,
                start_date: form.start_date,
                end_date: form.end_date ? form.end_date : null,
            };
            if (editingRecurring) {
                const { updateRecurringTransaction } = await import('../services/recurring.service');
                await updateRecurringTransaction(editingRecurring.id, payload);
            } else {
                const { createRecurringTransaction } = await import('../services/recurring.service');
                await createRecurringTransaction(payload);
            }
            onSuccess();
            handleClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Gagal menyimpan transaksi berulang.');
        } finally {
            setLoading(false);
        }
    };

    const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    return (
        <Modal show={show} onHide={() => !loading && handleClose()} centered>
            <Modal.Header closeButton={!loading} className="border-0 pt-4 px-4">
                <Modal.Title className="fw-bold d-flex align-items-center gap-2">
                    <ArrowRepeat size={20} className="text-primary" />
                    {editingRecurring ? 'Edit Transaksi Berulang' : 'Tambah Transaksi Berulang'}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="px-4 pb-4">
                {error ? <Alert variant="danger" style={{ borderRadius: 12 }}>{error}</Alert> : null}

                <Form.Group className="mb-3">
                    <Form.Label className="small fw-bold text-muted">Jenis</Form.Label>
                    <Form.Select
                        value={form.jenis}
                        onChange={(e) => {
                            handleChange('jenis', e.target.value);
                            handleChange('category_id', '');
                        }}
                        style={{ borderRadius: 12, padding: '10px' }}
                        disabled={loading}
                    >
                        <option value="pemasukan">Pemasukan</option>
                        <option value="pengeluaran">Pengeluaran</option>
                    </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label className="small fw-bold text-muted">Kategori</Form.Label>
                    <Form.Select
                        value={form.category_id}
                        onChange={(e) => handleChange('category_id', e.target.value)}
                        style={{ borderRadius: 12, padding: '10px' }}
                        disabled={loading || filteredCategories.length === 0}
                    >
                        <option value="">— Pilih Kategori —</option>
                        {filteredCategories.map((c) => (
                            <option key={c.id_kategori} value={c.id_kategori}>
                                {c.nama_kategori}
                            </option>
                        ))}
                    </Form.Select>
                    {filteredCategories.length === 0 && (
                        <Form.Text className="text-muted">Tidak ada kategori {form.jenis} yang tersedia.</Form.Text>
                    )}
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label className="small fw-bold text-muted">Jumlah (Rp)</Form.Label>
                    <Form.Control
                        type="number"
                        min={1}
                        value={form.jumlah || ''}
                        onChange={(e) => handleChange('jumlah', e.target.value ? Number(e.target.value) : 0)}
                        style={{ borderRadius: 12, padding: '10px' }}
                        placeholder="0"
                        disabled={loading}
                    />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label className="small fw-bold text-muted">Keterangan (opsional)</Form.Label>
                    <Form.Control
                        type="text"
                        maxLength={255}
                        value={form.keterangan ?? ''}
                        onChange={(e) => handleChange('keterangan', e.target.value)}
                        style={{ borderRadius: 12, padding: '10px' }}
                        placeholder="cth: Listrik bulanan"
                        disabled={loading}
                    />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label className="small fw-bold text-muted">Frekuensi</Form.Label>
                    <Form.Select
                        value={form.frequency}
                        onChange={(e) => handleChange('frequency', e.target.value)}
                        style={{ borderRadius: 12, padding: '10px' }}
                        disabled={loading}
                    >
                        <option value="daily">Harian</option>
                        <option value="weekly">Mingguan</option>
                        <option value="monthly">Bulanan</option>
                    </Form.Select>
                </Form.Group>

                {form.frequency === 'weekly' && (
                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-bold text-muted">Hari</Form.Label>
                        <Form.Select
                            value={form.day_of_week ?? 1}
                            onChange={(e) => handleChange('day_of_week', Number(e.target.value))}
                            style={{ borderRadius: 12, padding: '10px' }}
                            disabled={loading}
                        >
                            {dayNames.slice(1).map((name, idx) => (
                                <option key={idx + 1} value={idx + 1}>{name}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                )}

                {form.frequency === 'monthly' && (
                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-bold text-muted">Tanggal (1-31)</Form.Label>
                        <Form.Control
                            type="number"
                            min={1}
                            max={31}
                            value={form.day_of_month ?? 1}
                            onChange={(e) => handleChange('day_of_month', Number(e.target.value))}
                            style={{ borderRadius: 12, padding: '10px' }}
                            disabled={loading}
                        />
                    </Form.Group>
                )}

                <Row>
                    <Col xs={form.end_date ? 6 : 12}>
                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-bold text-muted">Mulai</Form.Label>
                            <Form.Control
                                type="date"
                                value={form.start_date}
                                onChange={(e) => handleChange('start_date', e.target.value)}
                                style={{ borderRadius: 12, padding: '10px' }}
                                disabled={loading}
                            />
                        </Form.Group>
                    </Col>
                    {form.end_date !== undefined && (
                        <Col xs={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="small fw-bold text-muted">Selesai (opsional)</Form.Label>
                                <Form.Control
                                    type="date"
                                    value={form.end_date ?? ''}
                                    onChange={(e) => handleChange('end_date', e.target.value)}
                                    style={{ borderRadius: 12, padding: '10px' }}
                                    min={form.start_date}
                                    disabled={loading}
                                />
                            </Form.Group>
                        </Col>
                    )}
                </Row>
                {!form.end_date && form.end_date !== undefined && (
                    <Button
                        variant="link"
                        size="sm"
                        className="p-0 mb-3 text-decoration-none"
                        onClick={() => handleChange('end_date', '')}
                        disabled={loading}
                    >
                        + Tambah tanggal selesai
                    </Button>
                )}
                {form.end_date && (
                    <Button
                        variant="link"
                        size="sm"
                        className="p-0 mb-3 text-decoration-none text-muted"
                        onClick={() => handleChange('end_date', undefined as any)}
                        disabled={loading}
                    >
                        Hapus tanggal selesai
                    </Button>
                )}

                <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-100 py-3 fw-bold"
                    style={{ borderRadius: 15 }}
                >
                    {loading ? 'Menyimpan...' : editingRecurring ? 'Simpan Perubahan' : 'Tambah'}
                </Button>
            </Modal.Body>
        </Modal>
    );
};

export default AddRecurringModal;
