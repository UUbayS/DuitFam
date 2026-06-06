import { useCallback, useEffect, useState } from "react";
import { Alert, Card, Col, Row, Spinner, Modal, Button } from "react-bootstrap";
import { EyeFill, EyeSlashFill, GridFill, Coin, ArrowUpRight, ArrowDownRight, PersonPlusFill, Check2Circle, PeopleFill, PersonFill, PersonWorkspace } from "react-bootstrap-icons";
import MainLayout from "../components/MainLayout";
import DashboardAlertBanner from "../components/DashboardAlertBanner";
import NotificationBell from "../components/NotificationBell";
import { useAuth } from "../context/AuthContext";
import {
    fetchFamilyMonthlySummary,
    fetchFamilyHistoricalData,
    fetchMonthlySummary,
    fetchHistoricalData,
} from "../services/report.service";
import { generateInviteCode, checkParentStatus } from "../services/auth.service";
import MonthlyBarChart from "../components/MonthlyBarChart";
import TransactionModal from "../components/TransactionModal";
import IconBerandaBiru from "../assets/IconBerandaBiru.svg";
import type * as ReportTypes from "../types/report.types";

const formatRupiah = (amount: number) => {
    const formatted = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.floor(amount));

    return formatted.replace("Rp", "Rp ");
};

const renderPercentageBadge = (data: ReportTypes.MonthlySummary | null) => {
    if (!data) return null;
    
    const currentSaldo = data.saldoAkhir || 0;
    const prevSaldo = data.saldoBulanLalu ?? 0;
    
    let percentage = 0;
    
    if (prevSaldo === 0) {
        if (currentSaldo > 0) {
            percentage = 100;
        } else if (currentSaldo < 0) {
            percentage = -100;
        } else {
            percentage = 0;
        }
    } else {
        percentage = ((currentSaldo - prevSaldo) / Math.abs(prevSaldo)) * 100;
    }

    const isPositive = percentage > 0;
    const isNegative = percentage < 0;
    const absPercentage = Math.abs(percentage).toFixed(2);

    let badgeClass = "bg-secondary bg-opacity-10 text-secondary";
    let Icon = null;
    let prefix = "";

    if (isPositive) {
        badgeClass = "bg-success bg-opacity-10 text-success";
        Icon = ArrowUpRight;
        prefix = "+";
    } else if (isNegative) {
        badgeClass = "bg-danger bg-opacity-10 text-danger";
        Icon = ArrowDownRight;
        prefix = "-";
    }

    return (
        <div className="d-flex align-items-center gap-2 mt-2">
            <div className={`px-2 py-1 rounded d-inline-flex align-items-center gap-1 fw-bold small ${badgeClass}`}>
                {Icon && <Icon size={14} />}
                {prefix}{absPercentage}%
            </div>
            <span className="text-muted small">dari bulan lalu</span>
        </div>
    );
};

    const DashboardPage = () => {
        const { user } = useAuth();
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [showSaldo, setShowSaldo] = useState(true);
        const [showTransactionModal, setShowTransactionModal] = useState(false);
    
    const [summary, setSummary] = useState<ReportTypes.MonthlySummary | null>(
        null,
    );
    const [parentSummary, setParentSummary] =
        useState<ReportTypes.MonthlySummary | null>(null);
    const [historicalData, setHistoricalData] = useState<
        ReportTypes.AnalysisReport["chartData"]
    >([]);

    const isParent = user?.role === "parent";

    const [chartViewFilter, setChartViewFilter] = useState<'semua' | 'ortu' | 'anak'>('semua');

    // Invite code state
    const [parentLinked, setParentLinked] = useState(true);
    const [parentStatusLoading, setParentStatusLoading] = useState(true);
    const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
    const [generatingCode, setGeneratingCode] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            if (isParent) {
                const groupParam = chartViewFilter !== 'semua' ? { group: chartViewFilter } : {};
                const [s, ps, hist] = await Promise.all([
                    fetchFamilyMonthlySummary({ ...groupParam, month: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') }),
                    chartViewFilter === 'ortu' ? fetchMonthlySummary() : fetchFamilyMonthlySummary(groupParam),
                    fetchFamilyHistoricalData({ unit: 'tahunan', year: new Date().getFullYear().toString(), ...groupParam }),
                ]);
                setSummary(s);
                setParentSummary(ps);
                setHistoricalData(hist);
            } else {
                const [s, hist] = await Promise.all([
                    fetchMonthlySummary(),
                    fetchHistoricalData({ unit: 'tahunan', year: new Date().getFullYear().toString() }),
                ]);
                setSummary(s);
                setParentSummary(s);
                setHistoricalData(hist);
            }
            setError(null);
        } catch (e: any) {
            setError(e.response?.data?.message || "Gagal memuat data beranda.");
        } finally {
            setLoading(false);
        }
    }, [isParent, chartViewFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Cek status tautan orang tua (untuk child)
    useEffect(() => {
        if (!isParent) {
            setParentStatusLoading(true);
            checkParentStatus()
                .then((res) => setParentLinked(res.linked))
                .catch(() => setParentLinked(true))
                .finally(() => setParentStatusLoading(false));
        }
    }, [isParent]);

    const handleGenerateInvite = async () => {
        setGeneratingCode(true);
        setError(null);
        try {
            const res = await generateInviteCode();
            setGeneratedInviteCode(res.invite_code);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Gagal menghasilkan kode tautan.');
        } finally {
            setGeneratingCode(false);
        }
    };

    if (loading) {
        return (
            <MainLayout hideAddButton={true}>
                <div className="d-flex justify-content-center mt-5">
                    <Spinner animation="border" variant="primary" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout
            onTransactionAdded={loadData}
            openTransactionModal={() => setShowTransactionModal(true)}
            hideAddButton={false}
            style={{ overflow: 'hidden' }}
        >
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div className="d-flex align-items-center gap-2">
                    <GridFill className="text-primary" size={window.innerWidth > 768 ? 32 : 24} />
                    <h2
                        className="text-primary fw-bold mb-0 responsive-h2"
                        style={{ fontSize: 'calc(1.5rem + 1.5vw)' }}
                    >
                        Beranda
                    </h2>
                </div>
                <div className="desktop-only">
                    <NotificationBell />
                </div> 
            </div>

            {error ? (
                <Alert variant="danger" style={{ borderRadius: 15 }}>
                    {error}
                </Alert>
            ) : null}

            <DashboardAlertBanner />

            <Row className="g-4 mb-4">
                {isParent && (
                <Col md={6}>
                    <Card
                        className="border-0 shadow-sm h-100"
                        style={{ borderRadius: 25 }}
                    >
                        <Card.Body className="p-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <div className="d-flex align-items-center justify-content-between mb-3">
                                        <div className="fw-bold text-dark" style={{ fontSize: 18 }}>Tabungan Utama</div>
                                        <button
                                            type="button"
                                            onClick={() => setShowSaldo(!showSaldo)}
                                            style={{ border: 0, background: "transparent", color: "#9aa0a6" }}
                                        >
                                            {showSaldo ? <EyeFill size={20} /> : <EyeSlashFill size={20} />}
                                        </button>
                                    </div>
                                    <div className="text-muted small">Saldo saat ini</div>
                                <div className="mt-1 text-primary fw-bolder" style={{ fontSize: 'calc(1.4rem + 1vw)', color: '#1389f9' }}>
                                    {showSaldo ? formatRupiah(parentSummary?.saldoAkhir || 0) : "Rp ••••••"}
                                </div>
                                {renderPercentageBadge(parentSummary)}
                            </div>
                                <div className="bg-primary bg-opacity-10 p-3 rounded-circle text-primary d-flex align-items-center justify-content-center" style={{ width: 64, height: 64 }}>
                                    <Coin size={32} />
                                </div>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                )}
                <Col md={isParent ? 6 : 12}>
                    <Card
                        className="border-0 shadow-sm h-100"
                        style={{ borderRadius: 25 }}
                    >
                        <Card.Body className="p-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <div className="d-flex align-items-center justify-content-between mb-3">
                                        <div className="fw-bold text-dark" style={{ fontSize: 18 }}>Saldo Total Keluarga</div>
                                        <button
                                            type="button"
                                            onClick={() => setShowSaldo(!showSaldo)}
                                            style={{ border: 0, background: "transparent", color: "#9aa0a6" }}
                                        >
                                            {showSaldo ? <EyeFill size={20} /> : <EyeSlashFill size={20} />}
                                        </button>
                                    </div>
                                    <div className="text-muted small">Saldo saat ini</div>
                                <div className="mt-1 text-primary fw-bolder" style={{ fontSize: 'calc(1.4rem + 1vw)', color: '#1389f9' }}>
                                    {showSaldo ? formatRupiah(summary?.saldoAkhir || 0) : "Rp ••••••"}
                                </div>
                                {renderPercentageBadge(summary)}
                            </div>
                                <div className="bg-primary bg-opacity-10 p-3 rounded-circle text-primary d-flex align-items-center justify-content-center" style={{ width: 64, height: 64 }}>
                                    <Coin size={32} />
                                </div>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {!isParent && !parentLinked && !parentStatusLoading && (
                <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 25, background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)' }}>
                    <Card.Body className="p-4">
                        <div className="d-flex align-items-center gap-3">
                            <div className="bg-warning bg-opacity-10 p-3 rounded-circle d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
                                <PersonPlusFill size={28} color="#ea580c" />
                            </div>
                            <div className="flex-grow-1">
                                <div className="fw-bold text-dark" style={{ fontSize: 18 }}>Tautkan ke Orang Tua</div>
                                <div className="text-muted small mt-1">
                                    Akun kamu belum terhubung ke orang tua. Minta orang tua untuk memasukkan kode tautan yang akan kamu dapatkan.
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleGenerateInvite}
                                disabled={generatingCode}
                                className="btn btn-warning fw-bold px-4 py-2"
                                style={{ borderRadius: 12, whiteSpace: 'nowrap' }}
                            >
                                {generatingCode ? 'Memproses...' : 'Dapatkan Kode'}
                            </button>
                        </div>
                    </Card.Body>
                </Card>
            )}

            {/* View Filter Toggle untuk Chart - Hanya untuk Parent */}
            {isParent && (
                <Card className="border-0 shadow-sm mb-3" style={{ borderRadius: 15, backgroundColor: '#f8f9fa' }}>
                    <Card.Body className="p-2">
                        <div className="d-flex gap-2">
                            {([
                                { key: 'semua', label: 'Semua Keluarga', icon: PeopleFill },
                                { key: 'ortu', label: 'Orang Tua', icon: PersonWorkspace },
                                { key: 'anak', label: 'Anak-anak', icon: PersonFill }
                            ] as const).map(({ key, label, icon: Icon }) => (
                                <Button
                                    key={key}
                                    variant={chartViewFilter === key ? 'primary' : 'outline-secondary'}
                                    size="sm"
                                    onClick={() => setChartViewFilter(key)}
                                    className="rounded-pill d-flex align-items-center gap-1 px-3"
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

            <Card
                className="border-0 shadow-sm mb-4"
                style={{ borderRadius: 25 }}
            >
                <Card.Body className="p-4">
                    <div
                        className="fw-bold mb-4 text-dark"
                        style={{ fontSize: 22 }}
                    >
                        Analisis Keuangan
                    </div>
                    <div style={{ minHeight: 300 }}>
                        {historicalData.length > 0 ? (
                            <MonthlyBarChart key={JSON.stringify(historicalData)} chartData={historicalData} />
                        ) : (
                            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                                Belum ada data untuk ditampilkan.
                            </div>
                        )}
                    </div>
                </Card.Body>
            </Card>

            <TransactionModal 
                show={showTransactionModal} 
                handleClose={() => setShowTransactionModal(false)} 
                onSuccess={loadData} 
            />

            <Modal show={!!generatedInviteCode} onHide={() => setGeneratedInviteCode(null)} centered backdrop="static">
                <Modal.Header closeButton className="border-0 pt-4 px-4">
                    <Modal.Title className="fw-bold text-warning">🔑 Kode Tautan Kamu</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4 text-center">
                    <div className="text-muted small mb-3">
                        Berikan kode ini ke orang tua kamu. Kode berlaku <strong>5 menit</strong>.
                    </div>
                    <div style={{
                        fontSize: 42,
                        fontWeight: 900,
                        color: '#ea580c',
                        letterSpacing: 8,
                        backgroundColor: '#fff7ed',
                        padding: '16px 24px',
                        borderRadius: 16,
                        display: 'inline-block',
                        fontFamily: 'monospace',
                    }}>
                        {generatedInviteCode}
                    </div>
                </Modal.Body>
                <Modal.Footer className="border-0 justify-content-center pb-4">
                    <Button variant="warning" onClick={() => setGeneratedInviteCode(null)} style={{ borderRadius: 12, padding: '10px 32px' }}>
                        Tutup
                    </Button>
                </Modal.Footer>
            </Modal>
        </MainLayout>
    );
};

export default DashboardPage;
