import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Row, Col, Card, Button, Spinner, Alert, Form } from 'react-bootstrap';
import MainLayout from '../components/MainLayout';
import { ArrowLeftShort, ArrowRightShort, Tag, PeopleFill, PersonFill, PersonWorkspace } from 'react-bootstrap-icons';
import * as Icons from 'react-bootstrap-icons';
import { fetchAnalysisReport, fetchFamilyAnalysisReport, fetchFamilyHistoricalData, fetchHistoricalData, fetchTransactionHistory, fetchFamilyTransactionHistory } from '../services/report.service';
import { fetchChildrenService } from '../services/user.service';
import { fetchCategories } from '../services/utility.service';
import type { Category } from '../types/transaction.types';
import type * as ReportTypes from '../types/report.types';
import MonthlyBarChart from '../components/MonthlyBarChart';
import SmartSpendingTips from '../components/SmartSpendingTips';
import { useAuth } from '../context/AuthContext';
import { useTimeFilter } from '../hooks/useTimeFilter';
import TransactionModal from '../components/TransactionModal';
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

// Helper: Agregasi transaksi menjadi chart data
const aggregateToChart = (transactions: ReportTypes.TransactionHistoryItem[], unit: string): ReportTypes.AnalysisReport['chartData'] => {
    const grouped = new Map<string, { pemasukan: number; pengeluaran: number }>();
    
    transactions.forEach(tx => {
        if (tx.is_internal) return;

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
const calculateSummary = (transactions: ReportTypes.TransactionHistoryItem[]): ReportTypes.MonthlySummary => {
    const totalPemasukan = transactions
        .filter(t => !t.is_internal && t.jenis === 'pemasukan')
        .reduce((sum, t) => sum + t.jumlah, 0);
    
    const totalPengeluaran = transactions
        .filter(t => !t.is_internal && t.jenis === 'pengeluaran')
        .reduce((sum, t) => sum + t.jumlah, 0);
    
    return {
        bulan: '',
        totalPemasukan,
        totalPengeluaran,
        neto: totalPemasukan - totalPengeluaran,
        saldoAkhir: 0,
    };
};

type ViewFilter = 'semua' | 'ortu' | 'anak';
type TypeFilter = 'semua' | 'pemasukan' | 'pengeluaran';

const AnalisisPage = () => {
    const { user } = useAuth();
    const { unit, period, navigate, changeUnit } = useTimeFilter('bulan');
    const [report, setReport] = useState<any>(null);
    const [historicalData, setHistoricalData] = useState<ReportTypes.AnalysisReport['chartData']>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [transactions, setTransactions] = useState<ReportTypes.TransactionHistoryItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    
    // Filter view state
    const [viewFilter, setViewFilter] = useState<ViewFilter>('semua');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('semua');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [childrenIds, setChildrenIds] = useState<Set<string>>(new Set());
    const [categories, setCategories] = useState<Category[]>([]);
    
    const isParent = user?.role === 'parent';

    // Fetch children list untuk identifikasi transaksi anak
    useEffect(() => {
        if (isParent) {
            fetchChildrenService()
                .then(children => {
                    setChildrenIds(new Set(children.map(c => c.id)));
                })
                .catch(() => {});
        }
    }, [isParent]);

    // Fetch categories untuk filter dropdown
    useEffect(() => {
        fetchCategories()
            .then(cats => setCategories(cats))
            .catch(() => {});
    }, []);

    // Reset selected category saat type filter berubah
    useEffect(() => {
        setSelectedCategory('');
    }, [typeFilter]);

    // Apply view filter + type filter + category filter ke transaksi
    const filteredTransactions = useMemo(() => {
        let result = transactions;
        
        // Apply view filter (semua/ortu/anak)
        if (viewFilter !== 'semua' && isParent) {
            result = result.filter(tx => {
                const isAnak = tx.user_id && childrenIds.has(tx.user_id);
                if (viewFilter === 'ortu') return !isAnak;
                if (viewFilter === 'anak') return isAnak;
                return true;
            });
        }
        
        // Apply type filter (semua/pemasukan/pengeluaran)
        if (typeFilter !== 'semua') {
            result = result.filter(tx => tx.jenis === typeFilter);
        }
        
        // Apply category filter (by nama_kategori - Opsi B)
        if (selectedCategory) {
            result = result.filter(tx => tx.nama_kategori === selectedCategory);
        }
        
        return result;
    }, [transactions, viewFilter, typeFilter, selectedCategory, childrenIds, isParent]);

    // Hitung chart data dan summary dari filtered transactions
    const chartData = useMemo(() => {
        const aggregated = aggregateToChart(filteredTransactions, unit);
        
        // Opsi A: Set bar yang tidak dipilih ke 0
        if (typeFilter === 'pemasukan') {
            return aggregated.map(d => ({ ...d, pengeluaran: 0 }));
        }
        if (typeFilter === 'pengeluaran') {
            return aggregated.map(d => ({ ...d, pemasukan: 0 }));
        }
        
        return aggregated;
    }, [filteredTransactions, unit, typeFilter]);

    const summary = useMemo(() => {
        return calculateSummary(filteredTransactions);
    }, [filteredTransactions]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setHistoryLoading(true);
        try {
            const [analysisRes, historical] = await Promise.all([
                isParent ? fetchFamilyAnalysisReport(period.apiParam) : fetchAnalysisReport(period.apiParam),
                isParent 
                    ? fetchFamilyHistoricalData({ unit: unit === 'bulan' ? 'bulan' : unit, ...period.apiParam }) 
                    : fetchHistoricalData({ unit: unit === 'bulan' ? 'bulan' : unit, ...period.apiParam })
            ]);
            setReport(analysisRes);
            setHistoricalData(historical);
            setError(null);
            
            const history = await (isParent ? fetchFamilyTransactionHistory() : fetchTransactionHistory(period.apiParam));
            setTransactions(history);
        } catch (err: any) {
            setError("Gagal memuat data analisis.");
        } finally {
            setLoading(false);
            setHistoryLoading(false);
        }
    }, [period.apiParam, unit, isParent]);

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
                    {['mingguan', 'bulan', 'tahunan'].map((u) => (
                        <Button 
                            key={u}
                            variant={unit === u ? 'primary' : 'link'} 
                            onClick={() => changeUnit(u as any)} 
                            className={`rounded-pill px-3 px-md-4 fw-bold text-decoration-none ${unit === u ? '' : 'text-muted'}`}
                            style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                        >
                            {u === 'mingguan' ? 'Mingguan' : u === 'bulan' ? 'Bulanan' : 'Tahunan'}
                        </Button>
                    ))}
                </div>

                <div className="d-flex align-items-center bg-white p-1 rounded-pill shadow-sm border">
                    <Button variant="link" onClick={() => navigate('prev')} className="text-primary p-1"><ArrowLeftShort size={24} /></Button>
                    <div className="px-2 px-md-3 fw-bold text-dark text-nowrap" style={{ fontSize: 13 }}>{period.display}</div>
                    <Button variant="link" onClick={() => navigate('next')} className="text-primary p-1"><ArrowRightShort size={24} /></Button>
                </div>
            </div>

            {error ? <Alert variant="danger" style={{ borderRadius: 15 }}>{error}</Alert> : null}

            {/* Filter View Toggle - Hanya untuk Orang Tua */}
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

            {/* Filter Jenis Transaksi - Untuk Semua */}
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
                    
                    {/* Dropdown Kategori - Muncul saat jenis dipilih (Pemasukan/Pengeluaran) */}
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

            <TransactionModal show={showModal} handleClose={() => setShowModal(false)} onSuccess={loadData} />

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
                            {filteredTransactions.map((tx) => (
                                <Card key={tx.id_transaksi} className="mb-3 shadow-sm border-0 transition-all" style={{ borderRadius: '18px', overflow: 'hidden' }}>
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
                                        </div>
                                    </Card.Body>
                                </Card>
                            ))}
                        </div>
                    )}
                </Card.Body>
            </Card>
        </MainLayout>
    );
};

export default AnalisisPage;
