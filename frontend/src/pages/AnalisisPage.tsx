import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Row, Col, Card, Button, Spinner, Alert, Form, Modal, Dropdown, ProgressBar } from 'react-bootstrap';
import MainLayout from '../components/MainLayout';
import { ArrowLeftShort, ArrowRightShort, Tag, PeopleFill, PersonFill, PersonWorkspace, ThreeDotsVertical, PencilSquare, Trash, Lock, PlusCircleFill, PiggyBankFill, ExclamationTriangleFill, CheckCircleFill } from 'react-bootstrap-icons';
import * as Icons from 'react-bootstrap-icons';
import { fetchAnalysisReport, fetchFamilyAnalysisPdf, fetchFamilyAnalysisReport, fetchFamilyHistoricalData, fetchHistoricalData, fetchTransactionHistory, fetchFamilyTransactionHistory, downloadTransactionsExport, triggerExportDownload } from '../services/report.service';
import { fetchChildrenService } from '../services/user.service';
import { fetchCategories } from '../services/utility.service';
import { fetchTransactionById, deleteTransaction } from '../services/transaction.service';
import { fetchBudgets, fetchBudgetSummary, upsertBudget, deleteBudget } from '../services/budget.service';
import type { Budget, BudgetSummaryItem, BudgetInput } from '../types/budget.types';
import type { Category, TransactionItem } from '../types/transaction.types';
import type * as ReportTypes from '../types/report.types';
import MonthlyBarChart from '../components/MonthlyBarChart';
import SmartSpendingTips from '../components/SmartSpendingTips';
import BudgetCard from '../components/BudgetCard';
import { useAuth } from '../context/AuthContext';
import { useTimeFilter } from '../hooks/useTimeFilter';
import TransactionModal from '../components/TransactionModal';
import Pagination from '../components/Pagination';
import IconAnalisisBiru from '../assets/IconAnalisisBiru.svg';

const formatRupiah = (amount: number) => {
    const formatted = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.floor(amount));
    return formatted.replace('Rp', 'Rp ');
};

type ViewFilter = 'semua' | 'ortu' | 'anak';
type TypeFilter = 'semua' | 'pemasukan' | 'pengeluaran';

// Helper: Agregasi transaksi menjadi chart data
const aggregateToChart = (transactions: ReportTypes.TransactionHistoryItem[], unit: string, viewFilter: ViewFilter, isParent: boolean): ReportTypes.AnalysisReport['chartData'] => {
    const grouped = new Map<string, { pemasukan: number; pengeluaran: number }>();
    const skipInternal = isParent && viewFilter === 'semua';
    
    transactions.forEach(tx => {
        if (skipInternal && tx.is_internal) return;

        const date = new Date(tx.tanggal);
        let key: string;
        
        if (unit === 'mingguan') {
            key = date.toISOString().split('T')[0];
        } else if (unit === 'tahunan') {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        
        if (!grouped.has(key)) {
            grouped.set(key, { pemasukan: 0, pengeluaran: 0 });
        }
        
        const current = grouped.get(key)!;
        if (tx.jenis === 'pemasukan') {
            current.pemasukan += tx.jumlah;
        } else if (tx.jenis === 'pengeluaran') {
            current.pengeluaran += tx.jumlah;
        }
    });
    
    return Array.from(grouped.entries())
        .map(([month, values]) => ({ month, ...values }))
        .sort((a, b) => a.month.localeCompare(b.month));
};

// Helper: Hitung summary dari transaksi
const calculateSummary = (transactions: ReportTypes.TransactionHistoryItem[], viewFilter: ViewFilter, isParent: boolean): ReportTypes.MonthlySummary => {
    const skipInternal = isParent && viewFilter === 'semua';
    const filteredTxs = skipInternal 
        ? transactions.filter(t => !t.is_internal)
        : transactions;

    const totalPemasukan = filteredTxs
        .filter(t => t.jenis === 'pemasukan')
        .reduce((sum, t) => sum + t.jumlah, 0);
    
    const totalPengeluaran = filteredTxs
        .filter(t => t.jenis === 'pengeluaran')
        .reduce((sum, t) => sum + t.jumlah, 0);
    
    return {
        bulan: '',
        totalPemasukan,
        totalPengeluaran,
        neto: totalPemasukan - totalPengeluaran,
        saldoAkhir: 0,
    };
};

const AnalisisPage = () => {
    const { user } = useAuth();
    const { unit, period, navigate, changeUnit, customRange, setCustomRange } = useTimeFilter('bulan');
    const [report, setReport] = useState<any>(null);
    const [historicalData, setHistoricalData] = useState<ReportTypes.AnalysisReport['chartData']>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [transactions, setTransactions] = useState<ReportTypes.TransactionHistoryItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<TransactionItem | null>(null);
    const [editLoading, setEditLoading] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ReportTypes.TransactionHistoryItem | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

    const [viewFilter, setViewFilter] = useState<ViewFilter>('semua');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('semua');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [childrenIds, setChildrenIds] = useState<Set<string>>(new Set());
    const [categories, setCategories] = useState<Category[]>([]);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyTotalPages, setHistoryTotalPages] = useState(0);

    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryItem[]>([]);
    const [budgetLoading, setBudgetLoading] = useState(false);
    const [budgetActionMessage, setBudgetActionMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
    const [budgetForm, setBudgetForm] = useState<BudgetInput>({
        user_id: '',
        category_id: '',
        jumlah: 0,
        periode_bulan: '',
    });
    const [budgetSaving, setBudgetSaving] = useState(false);
    const [budgetDeleteTarget, setBudgetDeleteTarget] = useState<Budget | null>(null);
    const [children, setChildren] = useState<{ id: string; username: string }[]>([]);

    const isParent = user?.role === 'parent';

    const budgetPeriode = useMemo(() => {
        if (unit === 'bulan' && period.apiParam.month) return period.apiParam.month;
        return new Date().toISOString().slice(0, 7);
    }, [unit, period.apiParam.month]);

    const loadBudgets = useCallback(async () => {
        setBudgetLoading(true);
        try {
            const [list, summary] = await Promise.all([
                fetchBudgets(budgetPeriode),
                fetchBudgetSummary(budgetPeriode),
            ]);
            setBudgets(list.data);
            setBudgetSummary(summary.data);
        } catch {
            setBudgetActionMessage({ type: 'danger', text: 'Gagal memuat data anggaran.' });
        } finally {
            setBudgetLoading(false);
        }
    }, [budgetPeriode]);

    useEffect(() => {
        loadBudgets();
    }, [loadBudgets]);

    useEffect(() => {
        if (isParent) {
            fetchChildrenService()
                .then((data) => setChildren(data.map(c => ({ id: c.id, username: c.username }))))
                .catch(() => {});
        }
    }, [isParent]);

    const openAddBudgetModal = () => {
        setEditingBudget(null);
        setBudgetForm({
            user_id: user?.id_user ?? '',
            category_id: '',
            jumlah: 0,
            periode_bulan: budgetPeriode,
        });
        setShowBudgetModal(true);
    };

    const openEditBudgetModal = (b: Budget) => {
        setEditingBudget(b);
        setBudgetForm({
            user_id: b.user_id,
            category_id: b.category_id,
            jumlah: b.jumlah,
            periode_bulan: b.periode_bulan,
        });
        setShowBudgetModal(true);
    };

    const handleSaveBudget = async () => {
        if (!budgetForm.user_id || !budgetForm.category_id || !budgetForm.periode_bulan) {
            setBudgetActionMessage({ type: 'danger', text: 'Lengkapi semua field.' });
            return;
        }
        if (budgetForm.jumlah < 0) {
            setBudgetActionMessage({ type: 'danger', text: 'Anggaran tidak boleh negatif.' });
            return;
        }
        setBudgetSaving(true);
        setBudgetActionMessage(null);
        try {
            const res = await upsertBudget(budgetForm);
            setBudgetActionMessage({ type: 'success', text: res.message });
            setShowBudgetModal(false);
            loadBudgets();
        } catch (err: any) {
            setBudgetActionMessage({
                type: 'danger',
                text: err.response?.data?.message || 'Gagal menyimpan anggaran.',
            });
        } finally {
            setBudgetSaving(false);
        }
    };

    const handleDeleteBudget = async () => {
        if (!budgetDeleteTarget) return;
        setBudgetSaving(true);
        try {
            const res = await deleteBudget(budgetDeleteTarget.id);
            setBudgetActionMessage({ type: 'success', text: res.message });
            setBudgetDeleteTarget(null);
            loadBudgets();
        } catch (err: any) {
            setBudgetActionMessage({
                type: 'danger',
                text: err.response?.data?.message || 'Gagal menghapus anggaran.',
            });
        } finally {
            setBudgetSaving(false);
        }
    };

    const totalBudget = budgets.reduce((s, b) => s + b.jumlah, 0);
    const totalUsed = budgets.reduce((s, b) => s + b.used, 0);
    const totalRemaining = Math.max(0, totalBudget - totalUsed);
    const overallPercent = totalBudget > 0 ? Math.min(999, (totalUsed / totalBudget) * 100) : 0;

    useEffect(() => {
        if (isParent) {
            fetchChildrenService()
                .then(children => {
                    setChildrenIds(new Set(children.map(c => c.id)));
                })
                .catch(() => {});
        }
    }, [isParent]);

    useEffect(() => {
        fetchCategories()
            .then(cats => setCategories(cats))
            .catch(() => {});
    }, []);

    useEffect(() => {
        setSelectedCategory('');
    }, [typeFilter]);

    const filteredTransactions = useMemo(() => {
        let result = transactions;
        
        if (viewFilter !== 'semua' && isParent) {
            result = result.filter(tx => {
                const isAnak = tx.user_id && childrenIds.has(tx.user_id);
                if (viewFilter === 'ortu') return !isAnak;
                if (viewFilter === 'anak') return isAnak;
                return true;
            });
        }
        
        if (typeFilter !== 'semua') {
            result = result.filter(tx => tx.jenis === typeFilter);
        }
        
        if (selectedCategory) {
            result = result.filter(tx => tx.nama_kategori === selectedCategory);
        }
        
        return result;
    }, [transactions, viewFilter, typeFilter, selectedCategory, childrenIds, isParent]);

    const chartData = useMemo(() => {
        const aggregated = aggregateToChart(filteredTransactions, unit, viewFilter, isParent);
        
        if (typeFilter === 'pemasukan') {
            return aggregated.map(d => ({ ...d, pengeluaran: 0 }));
        }
        if (typeFilter === 'pengeluaran') {
            return aggregated.map(d => ({ ...d, pemasukan: 0 }));
        }
        
        return aggregated;
    }, [filteredTransactions, unit, typeFilter, viewFilter]);

    const summary = useMemo(() => {
        return calculateSummary(filteredTransactions, viewFilter, isParent);
    }, [filteredTransactions, viewFilter, isParent]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setHistoryLoading(true);
        try {
            const groupParam = viewFilter !== 'semua' ? { group: viewFilter } : {};

            const [analysisRes, historical] = await Promise.all([
                isParent ? fetchFamilyAnalysisReport({ ...period.apiParam, ...groupParam }) : fetchAnalysisReport(period.apiParam),
                isParent
                    ? fetchFamilyHistoricalData({ unit: unit === 'bulan' ? 'bulan' : unit, ...period.apiParam, ...groupParam })
                    : fetchHistoricalData({ unit: unit === 'bulan' ? 'bulan' : unit, ...period.apiParam })
            ]);
            setReport(analysisRes);
            setHistoricalData(historical);
            setError(null);

            const historyParams = {
                ...period.apiParam,
                ...groupParam,
                page: currentPage,
                per_page: perPage,
            };
            const history = await (isParent ? fetchFamilyTransactionHistory(historyParams) : fetchTransactionHistory(historyParams));
            setTransactions(history.data);
            setHistoryTotal(history.meta?.total ?? 0);
            setHistoryTotalPages(history.meta?.total_pages ?? 0);
        } catch (err: any) {
            setError("Gagal memuat data analisis.");
        } finally {
            setLoading(false);
            setHistoryLoading(false);
        }
    }, [period.apiParam, unit, isParent, viewFilter, currentPage, perPage]);

    const handleDownloadPdf = async () => {
        const month = period.apiParam.month;
        if (!month) return;
        setPdfError(null);
        setPdfLoading(true);
        try {
            const blob = await fetchFamilyAnalysisPdf(month);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Laporan-Keluarga-${month}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error('PDF download failed', err);
            setPdfError('Gagal mengunduh PDF. Silakan coba lagi.');
        } finally {
            setPdfLoading(false);
        }
    };

    const handleDownloadExport = async () => {
        setExportError(null);
        setExportLoading(true);
        try {
            const params = { ...period.apiParam } as Record<string, string | undefined>;
            Object.keys(params).forEach((k) => params[k] === undefined && delete params[k]);
            const blob = await downloadTransactionsExport(params);
            const periodLabel = params.start_date && params.end_date
                ? `${params.start_date}_${params.end_date}`
                : (params.month ?? params.year ?? new Date().toISOString().slice(0, 10));
            const filename = `transaksi_${periodLabel}.csv`;
            triggerExportDownload(blob, filename);
            setShowExportModal(false);
        } catch (err: any) {
            console.error('Export download failed', err);
            setExportError(err.response?.data?.message || 'Gagal mengunduh export. Silakan coba lagi.');
        } finally {
            setExportLoading(false);
        }
    };

    const handleEditTransaction = async (tx: ReportTypes.TransactionHistoryItem) => {
        setEditLoading(true);
        setActionMessage(null);
        try {
            const res = await fetchTransactionById(tx.id_transaksi);
            setEditingTransaction(res.data);
            setShowModal(true);
        } catch (err: any) {
            setActionMessage({
                type: 'danger',
                text: err.response?.data?.message || 'Gagal memuat detail transaksi.',
            });
        } finally {
            setEditLoading(false);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingTransaction(null);
    };

    const handleDeleteTransaction = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        setActionMessage(null);
        try {
            const res = await deleteTransaction(deleteTarget.id_transaksi);
            setActionMessage({ type: 'success', text: res.message });
            setDeleteTarget(null);
            loadData();
        } catch (err: any) {
            setActionMessage({
                type: 'danger',
                text: err.response?.data?.message || 'Gagal menghapus transaksi.',
            });
        } finally {
            setDeleteLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading && transactions.length === 0) {
        return (
            <MainLayout hideAddButton={true}>
                <div className="d-flex justify-content-center mt-5">
                    <Spinner animation="border" variant="primary" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout onTransactionAdded={loadData} openTransactionModal={() => setShowModal(true)} hideAddButton={false}>
            <div className="d-flex align-items-center gap-2 mb-4">
                <img src={IconAnalisisBiru} alt="Ikon Analisis" style={{ width: window.innerWidth > 768 ? 32 : 24, height: window.innerWidth > 768 ? 32 : 24 }} />
                <h2 className="text-primary fw-bold mb-0 responsive-h2" style={{ fontSize: 'calc(1.5rem + 1.5vw)' }}>
                    Analisis
                </h2>
            </div>

            <div className="d-flex mb-4 align-items-center flex-wrap gap-3 justify-content-between">
                <div className="d-flex gap-2 bg-white p-1 rounded-pill shadow-sm border overflow-auto no-scrollbar" style={{ maxWidth: '100%' }}>
                    {(['mingguan', 'bulan', 'tahunan', 'custom'] as const).map((u) => (
                        <Button
                            key={u}
                            variant={unit === u ? 'primary' : 'link'}
                            onClick={() => { changeUnit(u); setCurrentPage(1); }}
                            className={`rounded-pill px-3 px-md-4 fw-bold text-decoration-none ${unit === u ? '' : 'text-muted'}`}
                            style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                        >
                            {u === 'mingguan' ? 'Mingguan' : u === 'bulan' ? 'Bulanan' : u === 'tahunan' ? 'Tahunan' : 'Rentang'}
                        </Button>
                    ))}
                </div>

                <div className="d-flex align-items-center bg-white p-1 rounded-pill shadow-sm border">
                    <Button variant="link" onClick={() => navigate('prev')} className="text-primary p-1" disabled={unit === 'custom'}><ArrowLeftShort size={24} /></Button>
                    <div className="px-2 px-md-3 fw-bold text-dark text-nowrap" style={{ fontSize: 13 }}>{period.display}</div>
                    <Button variant="link" onClick={() => navigate('next')} className="text-primary p-1" disabled={unit === 'custom'}><ArrowRightShort size={24} /></Button>
                </div>

                {user?.role === 'parent' && (
                    <Button
                        variant="outline-primary"
                        onClick={handleDownloadPdf}
                        disabled={pdfLoading || unit === 'custom'}
                        className="ms-2"
                    >
                        {pdfLoading ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                Menyiapkan PDF...
                            </>
                        ) : (
                            'Unduh PDF'
                        )}
                    </Button>
                )}

                <Button
                    variant="outline-success"
                    onClick={() => {
                        setExportError(null);
                        setShowExportModal(true);
                    }}
                    className="ms-2"
                    title="Export daftar transaksi ke CSV"
                >
                    ⬇ Export
                </Button>
                {pdfError && <div className="text-danger small mt-2">{pdfError}</div>}
            </div>

            {unit === 'custom' && (
                <div className="d-flex gap-2 mb-4 align-items-center flex-wrap bg-white p-3 shadow-sm" style={{ borderRadius: 15 }}>
                    <span className="small fw-bold text-muted me-2" style={{ fontSize: 12 }}>RENTANG:</span>
                    <Form.Control
                        type="date"
                        size="sm"
                        value={customRange.start}
                        max={customRange.end}
                        onChange={(e) => { setCustomRange(e.target.value, customRange.end); setCurrentPage(1); }}
                        style={{ fontSize: 13, borderRadius: 8, maxWidth: 180 }}
                    />
                    <span className="text-muted">–</span>
                    <Form.Control
                        type="date"
                        size="sm"
                        value={customRange.end}
                        min={customRange.start}
                        onChange={(e) => { setCustomRange(customRange.start, e.target.value); setCurrentPage(1); }}
                        style={{ fontSize: 13, borderRadius: 8, maxWidth: 180 }}
                    />
                </div>
            )}

            {error ? <Alert variant="danger" style={{ borderRadius: 15 }}>{error}</Alert> : null}
            {actionMessage && (
                <Alert variant={actionMessage.type} style={{ borderRadius: 15 }} dismissible onClose={() => setActionMessage(null)}>
                    {actionMessage.text}
                </Alert>
            )}

            {isParent && (
                <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 15, backgroundColor: '#f8f9fa' }}>
                    <Card.Body className="p-3">
                        <div className="d-flex flex-wrap gap-2 align-items-center">
                            <span className="small fw-bold text-muted me-2" style={{ fontSize: 12 }}>TAMPILKAN:</span>
                            {([
                                { key: 'semua', label: 'Semua Keluarga', icon: PeopleFill },
                                { key: 'ortu', label: 'Orang Tua', icon: PersonWorkspace },
                                { key: 'anak', label: 'Anak-anak', icon: PersonFill }
                            ] as const).map(({ key, label, icon: Icon }) => (
                                <Button
                                    key={key}
                                    variant={viewFilter === key ? 'primary' : 'outline-primary'}
                                    size="sm"
                                    onClick={() => setViewFilter(key)}
                                    className="rounded-pill d-flex align-items-center gap-2"
                                    style={{ fontSize: 12, fontWeight: 600 }}
                                >
                                    <Icon size={14} />
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </Card.Body>
                </Card>
            )}

            <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 15, backgroundColor: '#f8f9fa' }}>
                <Card.Body className="p-3">
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                        <span className="small fw-bold text-muted me-2" style={{ fontSize: 12 }}>JENIS:</span>
                        {([
                            { key: 'semua', label: 'Semua' },
                            { key: 'pemasukan', label: 'Pemasukan' },
                            { key: 'pengeluaran', label: 'Pengeluaran' }
                        ] as const).map(({ key, label }) => (
                            <Button
                                key={key}
                                variant={typeFilter === key ? 'success' : 'outline-success'}
                                size="sm"
                                onClick={() => setTypeFilter(key)}
                                className="rounded-pill"
                                style={{ fontSize: 12, fontWeight: 600 }}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                    
                    {typeFilter !== 'semua' && (
                        <div className="d-flex flex-wrap gap-2 align-items-center mt-3 pt-3 border-top">
                            <span className="small fw-bold text-muted me-2" style={{ fontSize: 12 }}>KATEGORI:</span>
                            <Form.Select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                style={{ 
                                    borderRadius: 10, 
                                    fontSize: 13, 
                                    border: '1px solid #dee2e6',
                                    maxWidth: 250,
                                    padding: '6px 12px'
                                }}
                            >
                                <option value="">Semua kategori</option>
                                {categories
                                    .filter(cat => cat.jenis === typeFilter)
                                    .map(cat => (
                                        <option key={cat.id_kategori} value={cat.nama_kategori}>
                                            {cat.nama_kategori}
                                        </option>
                                    ))}
                            </Form.Select>
                        </div>
                    )}
                </Card.Body>
            </Card>

            <Row className="g-4 mb-5">
                <Col md={4}>
                    <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 25, borderBottom: '5px solid #28a745' }}>
                        <Card.Body className="p-4">
                            <div className="text-success fw-bold small mb-1">TOTAL PEMASUKAN</div>
                            <div className="fw-bold text-dark" style={{ fontSize: 24 }}>{formatRupiah(summary?.totalPemasukan || 0)}</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 25, borderBottom: '5px solid #dc3545' }}>
                        <Card.Body className="p-4">
                            <div className="text-danger fw-bold small mb-1">TOTAL PENGELUARAN</div>
                            <div className="fw-bold text-dark" style={{ fontSize: 24 }}>{formatRupiah(summary?.totalPengeluaran || 0)}</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 25, borderBottom: '5px solid #007bff' }}>
                        <Card.Body className="p-4">
                            <div className="text-primary fw-bold small mb-1">SELISIH</div>
                            <div className="fw-bold text-dark" style={{ fontSize: 24 }}>{formatRupiah(summary?.neto || 0)}</div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Card className="border-0 shadow-sm mb-5" style={{ borderRadius: 25 }}>
                <Card.Body className="p-4">
                    <div className="fw-bold mb-4 text-dark" style={{ fontSize: 22 }}>Grafik Keuangan</div>
                    <div style={{ minHeight: 300 }}>
                        <MonthlyBarChart chartData={chartData} />
                    </div>
                </Card.Body>
            </Card>

            <SmartSpendingTips />

            <Card className="border-0 shadow-sm mb-5" style={{ borderRadius: 25 }}>
                <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                        <div>
                            <div className="fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: 22 }}>
                                <PiggyBankFill className="text-primary" size={24} />
                                Anggaran
                            </div>
                            <small className="text-muted">Periode {budgetPeriode}</small>
                        </div>
                        <Button variant="primary" onClick={openAddBudgetModal} className="d-flex align-items-center gap-2" style={{ borderRadius: 15 }}>
                            <PlusCircleFill size={16} /> Tambah Anggaran
                        </Button>
                    </div>

                    {budgetActionMessage && (
                        <Alert variant={budgetActionMessage.type} dismissible onClose={() => setBudgetActionMessage(null)} style={{ borderRadius: 12 }}>
                            {budgetActionMessage.text}
                        </Alert>
                    )}

                    {budgetLoading ? (
                        <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>
                    ) : budgets.length === 0 ? (
                        <div className="text-center py-4 text-muted">
                            <PiggyBankFill size={32} className="mb-2 opacity-50" />
                            <p className="mb-0">Belum ada anggaran. Klik "Tambah Anggaran" untuk mulai.</p>
                        </div>
                    ) : (
                        <>
                            <Row className="g-3 mb-3">
                                <Col md={4}>
                                    <div className="p-3 rounded-3" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                                        <small className="text-muted fw-semibold">Total Anggaran</small>
                                        <div className="fw-bold text-dark" style={{ fontSize: 20 }}>{formatRupiah(totalBudget)}</div>
                                    </div>
                                </Col>
                                <Col md={4}>
                                    <div className="p-3 rounded-3" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                                        <small className="text-muted fw-semibold">Total Terpakai</small>
                                        <div className="fw-bold text-danger" style={{ fontSize: 20 }}>{formatRupiah(totalUsed)}</div>
                                    </div>
                                </Col>
                                <Col md={4}>
                                    <div className="p-3 rounded-3" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                                        <small className="text-muted fw-semibold">Sisa</small>
                                        <div className="fw-bold text-success" style={{ fontSize: 20 }}>{formatRupiah(totalRemaining)}</div>
                                    </div>
                                </Col>
                            </Row>
                            <ProgressBar
                                now={Math.min(100, overallPercent)}
                                variant={overallPercent >= 100 ? 'danger' : overallPercent >= 80 ? 'warning' : 'success'}
                                style={{ height: 10, borderRadius: 5, marginBottom: 16 }}
                            />
                            <div>
                                {budgets.map(b => (
                                    <BudgetCard
                                        key={b.id}
                                        budget={b}
                                        showUsername={isParent}
                                        onEdit={openEditBudgetModal}
                                        onDelete={setBudgetDeleteTarget}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </Card.Body>
            </Card>

            <Modal show={showBudgetModal} onHide={() => !budgetSaving && setShowBudgetModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{editingBudget ? 'Edit Anggaran' : 'Tambah Anggaran'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold small text-muted">Pengguna</Form.Label>
                            <Form.Select
                                value={budgetForm.user_id}
                                onChange={(e) => setBudgetForm({ ...budgetForm, user_id: e.target.value })}
                                disabled={!!editingBudget}
                                style={{ borderRadius: 10 }}
                            >
                                <option value={user?.id_user ?? ''}>{user?.username ?? 'Saya'} (Saya)</option>
                                {isParent && children.map(c => (
                                    <option key={c.id} value={c.id}>{c.username} (Anak)</option>
                                ))}
                            </Form.Select>
                            {editingBudget && <Form.Text className="text-muted">User tidak dapat diubah.</Form.Text>}
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold small text-muted">Kategori</Form.Label>
                            <Form.Select
                                value={budgetForm.category_id}
                                onChange={(e) => setBudgetForm({ ...budgetForm, category_id: e.target.value })}
                                style={{ borderRadius: 10 }}
                            >
                                <option value="">Pilih kategori</option>
                                {categories
                                    .filter(c => c.jenis === 'pengeluaran')
                                    .map(c => (
                                        <option key={c.id_kategori} value={c.id_kategori}>{c.nama_kategori}</option>
                                    ))}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold small text-muted">Jumlah Anggaran (Rp)</Form.Label>
                            <Form.Control
                                type="number"
                                min={0}
                                value={budgetForm.jumlah || ''}
                                onChange={(e) => setBudgetForm({ ...budgetForm, jumlah: Number(e.target.value) || 0 })}
                                style={{ borderRadius: 10 }}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold small text-muted">Periode</Form.Label>
                            <Form.Control
                                type="month"
                                value={budgetForm.periode_bulan}
                                onChange={(e) => setBudgetForm({ ...budgetForm, periode_bulan: e.target.value })}
                                style={{ borderRadius: 10 }}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setShowBudgetModal(false)} disabled={budgetSaving}>Batal</Button>
                    <Button variant="primary" onClick={handleSaveBudget} disabled={budgetSaving}>
                        {budgetSaving ? <Spinner size="sm" /> : 'Simpan'}
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={Boolean(budgetDeleteTarget)} onHide={() => !budgetSaving && setBudgetDeleteTarget(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title className="text-danger">Hapus Anggaran?</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {budgetDeleteTarget && (
                        <p>Anggaran <strong>{budgetDeleteTarget.nama_kategori}</strong> sebesar <strong>{formatRupiah(budgetDeleteTarget.jumlah)}</strong> akan dihapus.</p>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setBudgetDeleteTarget(null)} disabled={budgetSaving}>Batal</Button>
                    <Button variant="danger" onClick={handleDeleteBudget} disabled={budgetSaving}>
                        {budgetSaving ? <Spinner size="sm" /> : 'Ya, Hapus'}
                    </Button>
                </Modal.Footer>
            </Modal>

            <TransactionModal
                show={showModal}
                handleClose={handleCloseModal}
                onSuccess={() => { handleCloseModal(); loadData(); }}
                editingTransaction={editingTransaction}
            />

            <Modal show={Boolean(deleteTarget)} onHide={() => setDeleteTarget(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title className="text-danger fw-bold">Batalkan Transaksi?</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {deleteTarget && (
                        <div>
                            <p>Transaksi <strong>{deleteTarget.jenis === 'pemasukan' ? 'pemasukan' : 'pengeluaran'}</strong> sebesar <strong>{formatRupiah(deleteTarget.jumlah)}</strong> akan dibatalkan dan saldonya akan dikembalikan.</p>
                            <p className="text-muted small mb-0">Aksi ini tidak dapat diurungkan. Data transaksi tetap tersimpan untuk audit dengan status "dibatalkan".</p>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Batal</Button>
                    <Button variant="danger" onClick={handleDeleteTransaction} disabled={deleteLoading}>
                        {deleteLoading ? <Spinner size="sm" /> : 'Ya, Batalkan'}
                    </Button>
                </Modal.Footer>
            </Modal>

            <Card className="border-0 shadow-sm mb-5" style={{ borderRadius: 25 }}>
                <Card.Body className="p-4">
                    <div className="fw-bold mb-4 text-dark" style={{ fontSize: 22 }}>Riwayat Transaksi</div>
                    {historyLoading ? (
                        <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
                    ) : filteredTransactions.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            {selectedCategory
                                ? `Belum ada transaksi untuk kategori "${selectedCategory}" pada periode ini.`
                                : viewFilter !== 'semua' && typeFilter !== 'semua'
                                ? `Belum ada transaksi ${typeFilter} ${viewFilter === 'ortu' ? 'orang tua' : 'anak'} pada periode ini.`
                                : viewFilter !== 'semua'
                                ? `Belum ada transaksi ${viewFilter === 'ortu' ? 'orang tua' : 'anak'} pada periode ini.`
                                : typeFilter !== 'semua'
                                ? `Belum ada transaksi ${typeFilter} pada periode ini.`
                                : "Belum ada transaksi pada periode ini."
                            }
                        </div>
                    ) : (
                        <div className="px-1">
                            {filteredTransactions.map((tx) => {
                                const isCancelled = tx.status === 'dibatalkan';
                                const canManage = !tx.is_internal && !isCancelled;
                                return (
                                <Card
                                    key={tx.id_transaksi}
                                    className="mb-3 shadow-sm border-0 transition-all"
                                    style={{
                                        borderRadius: '18px',
                                        opacity: isCancelled ? 0.55 : 1,
                                    }}
                                >
                                    <Card.Body className="p-3">
                                        <div className="d-flex align-items-center gap-3">
                                            <div 
                                                className="d-flex align-items-center justify-content-center flex-shrink-0"
                                                style={{ 
                                                    width: '45px', 
                                                    height: '45px', 
                                                    borderRadius: '14px', 
                                                    backgroundColor: tx.jenis === 'pemasukan' ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                                                    color: tx.jenis === 'pemasukan' ? '#28a745' : '#dc3545',
                                                    fontSize: '20px'
                                                }}
                                            >
                                                {React.createElement((Icons as any)[tx.icon_kategori || 'Tag'] || Tag)}
                                            </div>
                                            <div className="flex-grow-1 d-flex flex-column min-width-0">
                                                <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                                                    <div className="fw-bold text-dark text-truncate" style={{ fontSize: '14px' }}>
                                                        {tx.keterangan || 'Tanpa keterangan'}
                                                    </div>
                                                </div>
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <small className="text-muted" style={{ fontSize: '11px' }}>
                                                        {tx.username && <span className="fw-bold text-primary me-1">{tx.username}</span>}
                                                        {tx.username && ' • '}
                                                        {tx.nama_kategori || 'Lainnya'} • {new Date(tx.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                                        {isCancelled && <span className="ms-2 badge bg-secondary" style={{ fontSize: 9 }}>DIBATALKAN</span>}
                                                    </small>
                                                    <div 
                                                        className="fw-bold" 
                                                        style={{ 
                                                            color: tx.jenis === 'pemasukan' ? '#28a745' : '#dc3545', 
                                                            fontSize: '14px'
                                                        }}
                                                    >
                                                        {tx.jenis === 'pengeluaran' ? '- ' : '+ '}
                                                        {formatRupiah(tx.jumlah)}
                                                    </div>
                                                </div>
                                            </div>
                                            {canManage ? (
                                                <Dropdown align="end" onClick={(e) => e.stopPropagation()}>
                                                    <Dropdown.Toggle
                                                        variant="link"
                                                        id={`tx-actions-${tx.id_transaksi}`}
                                                        className="p-1 text-secondary shadow-none border-0"
                                                        style={{ background: 'transparent' }}
                                                        disabled={editLoading}
                                                    >
                                                        <ThreeDotsVertical size={18} />
                                                    </Dropdown.Toggle>
                                                    <Dropdown.Menu
                                                        popperConfig={{ modifiers: [{ name: 'preventOverflow', options: { boundary: 'viewport' } }] }}
                                                        style={{ borderRadius: 12, fontSize: 13 }}
                                                    >
                                                        <Dropdown.Item
                                                            onClick={() => handleEditTransaction(tx)}
                                                            className="d-flex align-items-center gap-2"
                                                        >
                                                            <PencilSquare size={14} /> Edit
                                                        </Dropdown.Item>
                                                        <Dropdown.Item
                                                            onClick={() => setDeleteTarget(tx)}
                                                            className="d-flex align-items-center gap-2 text-danger"
                                                        >
                                                            <Trash size={14} /> Batalkan
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            ) : tx.is_internal ? (
                                                <span className="text-muted flex-shrink-0" title="Transaksi internal tidak dapat diedit/dihapus">
                                                    <Lock size={14} />
                                                </span>
                                            ) : null}
                                        </div>
                                    </Card.Body>
                                </Card>
                                );
                            })}
                        </div>
                    )}
                    {!historyLoading && (historyTotalPages > 0 || historyTotal > 0) && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={historyTotalPages}
                            onPageChange={setCurrentPage}
                            perPage={perPage}
                            onPerPageChange={(n) => { setPerPage(n); setCurrentPage(1); }}
                            total={historyTotal}
                        />
                    )}
                </Card.Body>
            </Card>

            <Modal show={showExportModal} onHide={() => !exportLoading && setShowExportModal(false)} centered>
                <Modal.Header closeButton={!exportLoading} className="border-0 pt-4 px-4">
                    <Modal.Title className="fw-bold">Export Daftar Transaksi</Modal.Title>
                </Modal.Header>
                <Modal.Body className="px-4">
                    {exportError && <div className="alert alert-danger py-2 small mb-3" style={{ borderRadius: 12 }}>{exportError}</div>}
                    <p className="text-muted small mb-3">
                        Periode saat ini: <strong>{period.display}</strong>. Semua transaksi pada periode aktif akan di-export ke file <strong>CSV</strong> (UTF-8 dengan BOM, delimiter titik-koma, dapat dibuka di Excel/Google Sheets).
                    </p>
                </Modal.Body>
                <Modal.Footer className="border-0 px-4 pb-4">
                    <Button variant="light" onClick={() => setShowExportModal(false)} disabled={exportLoading} style={{ borderRadius: 12 }}>
                        Batal
                    </Button>
                    <Button variant="success" onClick={handleDownloadExport} disabled={exportLoading} style={{ borderRadius: 12 }}>
                        {exportLoading ? <><Spinner size="sm" className="me-2" /> Menyiapkan...</> : 'Unduh CSV'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </MainLayout>
    );
};

export default AnalisisPage;
