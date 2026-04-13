import React, { useEffect, useState } from "react";
import {
    ExclamationTriangleFill,
    CheckCircleFill,
    InfoCircleFill,
    XCircleFill,
} from "react-bootstrap-icons";
import {
    fetchSpendingAlerts,
    type SpendingAlert,
} from "../services/alert.service";

const DashboardAlertBanner: React.FC = () => {
    const [alerts, setAlerts] = useState<SpendingAlert[]>([]);
    const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
        new Set()
    );
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAlerts = async () => {
            try {
                const response = await fetchSpendingAlerts();
                setAlerts(response.alerts);
            } catch (error) {
                console.error("Failed to load alerts:", error);
            } finally {
                setLoading(false);
            }
        };

        loadAlerts();
    }, []);

    const handleDismiss = (alertIndex: number) => {
        setDismissedAlerts((prev) => new Set([...prev, alertIndex.toString()]));
    };

    const getAlertIcon = (type: string) => {
        switch (type) {
            case "warning":
                return <ExclamationTriangleFill size={20} />;
            case "success":
                return <CheckCircleFill size={20} />;
            case "info":
                return <InfoCircleFill size={20} />;
            default:
                return <InfoCircleFill size={20} />;
        }
    };

    const getAlertStyle = (type: string, severity: string) => {
        const baseStyle: React.CSSProperties = {
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "8px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            position: "relative",
            animation: "slideIn 0.3s ease-out",
        };

        const colorScheme = {
            warning: {
                high: { bg: "#fff3cd", border: "#dc3545", color: "#856404" },
                medium: { bg: "#fff3cd", border: "#ffc107", color: "#856404" },
                low: { bg: "#fff3cd", border: "#ffc107", color: "#856404" },
            },
            success: {
                low: { bg: "#d4edda", border: "#28a745", color: "#155724" },
            },
            info: {
                low: { bg: "#d1ecf1", border: "#17a2b8", color: "#0c5460" },
            },
        };

        const scheme =
            colorScheme[type as keyof typeof colorScheme]?.[
                severity as keyof any
            ] || colorScheme.info.low;

        return {
            ...baseStyle,
            backgroundColor: scheme.bg,
            borderLeft: `4px solid ${scheme.border}`,
            color: scheme.color,
        };
    };

    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    if (loading || alerts.length === 0) {
        return null;
    }

    const visibleAlerts = alerts.filter(
        (_, index) => !dismissedAlerts.has(index.toString())
    );

    if (visibleAlerts.length === 0) {
        return null;
    }

    return (
        <div
            style={{
                marginBottom: "24px",
                animation: "fadeIn 0.5s ease-out",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                }}
            >
                <h3
                    style={{
                        margin: 0,
                        fontSize: "18px",
                        fontWeight: "bold",
                        color: "#333",
                    }}
                >
                    🔔 Financial Alerts ({visibleAlerts.length})
                </h3>
            </div>

            <div>
                {visibleAlerts.map((alert, index) => (
                    <div
                        key={index}
                        style={getAlertStyle(alert.type, alert.severity)}
                    >
                        <div style={{ flex: 1 }}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    marginBottom: "4px",
                                }}
                            >
                                {getAlertIcon(alert.type)}
                                <strong style={{ fontSize: "15px" }}>
                                    {alert.title}
                                </strong>
                            </div>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: "14px",
                                    lineHeight: "1.5",
                                    color: "#666",
                                }}
                            >
                                {alert.message}
                            </p>
                            {alert.amount && (
                                <div
                                    style={{
                                        marginTop: "6px",
                                        fontSize: "14px",
                                        fontWeight: "600",
                                        color: alert.type === "warning" ? "#dc3545" : "#28a745",
                                    }}
                                >
                                    {formatCurrency(alert.amount)}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => handleDismiss(index)}
                            style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                color: "#999",
                                padding: "0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "color 0.2s",
                            }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.color = "#333")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.color = "#999")
                            }
                            title="Tutup alert"
                        >
                            <XCircleFill size={18} />
                        </button>
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
};

export default DashboardAlertBanner;
