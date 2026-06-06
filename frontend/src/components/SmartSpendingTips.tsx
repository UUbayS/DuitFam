import React, { useState, useEffect, useCallback } from "react";
import { ArrowClockwise, ExclamationTriangle, PiggyBank, Wallet, BarChart, ExclamationCircle, Robot, ChevronDown, ChevronUp } from "react-bootstrap-icons";
import { getSpendingTips } from "../services/report.service";
import type { SpendingTipsResponse, SpendingTip } from "../types/spending-tips.types";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import Card from "react-bootstrap/Card";
import Badge from "react-bootstrap/Badge";
import Collapse from "react-bootstrap/Collapse";
import Alert from "react-bootstrap/Alert";

const SmartSpendingTips: React.FC = () => {
    const [tipsData, setTipsData] = useState<SpendingTipsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
        budget_tips: true,
        category_tips: true,
        saving_tips: true,
        warnings: true,
    });
    const [isOpen, setIsOpen] = useState(false);

    const fetchTips = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getSpendingTips();
            setTipsData(data);
        } catch (err: any) {
            setError("Gagal memuat tips. Silakan coba lagi.");
            console.error("Error fetching spending tips:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTips();
    }, [fetchTips]);

    const toggleCategory = (category: string) => {
        setOpenCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'high':
                return <Badge bg="danger" className="ms-2">Tinggi</Badge>;
            case 'medium':
                return <Badge bg="warning" text="dark" className="ms-2">Sedang</Badge>;
            case 'low':
                return <Badge bg="success" className="ms-2">Rendah</Badge>;
            default:
                return null;
        }
    };

    const renderTipCard = (tip: SpendingTip) => (
        <Card key={tip.id} className="mb-2 border-0 shadow-sm">
            <Card.Body className="py-2 px-3">
                <div className="d-flex align-items-start">
                    <div className="flex-grow-1">
                        <h6 className="mb-1 fw-semibold">{tip.title}</h6>
                        <p className="mb-0 text-muted small">{tip.message}</p>
                    </div>
                    {getPriorityBadge(tip.priority)}
                </div>
            </Card.Body>
        </Card>
    );

    const renderCategory = (
        title: string,
        icon: React.ReactNode,
        tips: SpendingTip[],
        categoryKey: string,
        variant: string
    ) => (
        <Card className="mb-3 border-0 shadow">
            <Card.Header 
                className={`bg-${variant} bg-opacity-10 border-${variant} border-opacity-25 d-flex align-items-center justify-content-between py-2 px-3`}
                onClick={() => toggleCategory(categoryKey)}
                style={{ cursor: 'pointer' }}
            >
                <div className="d-flex align-items-center">
                    <span className="me-2">{icon}</span>
                    <span className="fw-semibold">{title}</span>
                    <Badge bg={variant} className="ms-2">{tips.length}</Badge>
                </div>
                <span className="small">
                    {openCategories[categoryKey] ? 'Sembunyikan' : 'Tampilkan'}
                </span>
            </Card.Header>
            <Collapse in={openCategories[categoryKey]}>
                <div className="p-3">
                    {tips.length > 0 ? (
                        tips.map(renderTipCard)
                    ) : (
                        <p className="text-muted small mb-0">Tidak ada tips untuk kategori ini.</p>
                    )}
                </div>
            </Collapse>
        </Card>
    );

    if (loading) {
        return (
            <Card className="border-0 shadow mb-4">
                <Card.Body className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3 text-muted">Memuat smart spending tips...</p>
                </Card.Body>
            </Card>
        );
    }

    return (
        <Card className="border-0 shadow mb-4">
            <Card.Header 
                className="bg-primary bg-opacity-10 border-primary border-opacity-25 d-flex align-items-center justify-content-between"
                style={{ cursor: 'pointer' }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="d-flex align-items-center">
                    <Robot className="me-2 text-primary" size={20} />
                    <h5 className="mb-0 fw-semibold">Smart Spending Tips</h5>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            fetchTips();
                        }}
                        disabled={loading}
                    >
                        <ArrowClockwise size={14} />
                        <span className="desktop-only m-1">Refresh</span>
                    </Button>
                    {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </Card.Header>
            <Collapse in={isOpen}>
                <div>
                    <Card.Body>
                        {error && (
                            <Alert variant="danger" className="small">
                                {error}
                            </Alert>
                        )}
                        
                        {tipsData?.error && (
                            <Alert variant="warning" className="small">
                                {tipsData.error}
                            </Alert>
                        )}

                        {tipsData?.tips && (
                            <>
                            {renderCategory(
                                "Anggaran",
                                <Wallet className="text-primary" size={18} />,
                                tipsData.tips.budget_tips,
                                "budget_tips",
                                "primary"
                            )}
                            
                            {renderCategory(
                                "Kategori Pengeluaran",
                                <BarChart className="text-info" size={18} />,
                                tipsData.tips.category_tips,
                                "category_tips",
                                "info"
                            )}
                            
                            {renderCategory(
                                "Menabung",
                                <PiggyBank className="text-success" size={18} />,
                                tipsData.tips.saving_tips,
                                "saving_tips",
                                "success"
                            )}
                            
                            {renderCategory(
                                "Peringatan",
                                <ExclamationTriangle className="text-danger" size={18} />,
                                tipsData.tips.warnings,
                                "warnings",
                                "danger"
                            )}
                            </>
                        )}

                        {tipsData?.cached && (
                            <p className="text-muted small text-center mt-3 mb-0">
                                Tips terakhir diperbarui: {new Date(tipsData.generated_at).toLocaleString('id-ID')}
                            </p>
                        )}
                    </Card.Body>
                </div>
            </Collapse>
        </Card>
    );
};

export default SmartSpendingTips;
