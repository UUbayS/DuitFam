import { useCallback, useEffect, useState } from "react";
import { Alert, Card, Col, Row, Spinner } from "react-bootstrap";
import { EyeFill, EyeSlashFill, GridFill, Coin, ArrowUpRight, ArrowDownRight } from "react-bootstrap-icons";
import MainLayout from "../components/MainLayout";
import DashboardAlertBanner from "../components/DashboardAlertBanner";
import { useAuth } from "../context/AuthContext";
import {
    fetchFamilyMonthlySummary,
    fetchFamilyHistoricalData,
    fetchMonthlySummary,
    fetchHistoricalData,
} from "../services/report.service";
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
    const neto = data.neto || 0;
    const previousSaldo = currentSaldo - neto;

    let percentage = 0;
    if (previousSaldo === 0) {
        if (neto > 0) percentage = 100;
        else if (neto < 0) percentage = -100;
        else percentage = 0;
    } else {
        percentage = (neto / previousSaldo) * 100;
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

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            if (isParent) {
                const [s, ps, hist] = await Promise.all([
                    fetchFamilyMonthlySummary(),
                    fetchMonthlySummary(),
                    fetchFamilyHistoricalData({ unit: 'tahunan', year: new Date().getFullYear().toString() }),
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
    }, [isParent]);

    useEffect(() => {
        loadData();
    }, [loadData]);

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
        >
            <div className="d-flex align-items-center gap-2 mb-4">
                <GridFill className="text-primary" size={window.innerWidth > 768 ? 32 : 24} />
                <h2
                    className="text-primary fw-bold mb-0 responsive-h2"
                    style={{ fontSize: 'calc(1.5rem + 1.5vw)' }}
                >
                    Beranda
                </h2>
            </div>

            {error ? (
                <Alert variant="danger" style={{ borderRadius: 15 }}>
                    {error}
                </Alert>
            ) : null}

            <DashboardAlertBanner />

            <Row className="g-4 mb-4">
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
                <Col md={6}>
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
        </MainLayout>
    );
};

export default DashboardPage;
