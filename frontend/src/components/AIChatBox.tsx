import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, Chat, Robot, Person } from "react-bootstrap-icons";
import api from "../services/api";
import {
    fetchAnalysisReport,
    fetchMonthlySummary,
    fetchTransactionHistory,
} from "../services/report.service";
import type {
    AnalysisReport,
    MonthlySummary,
    TransactionHistoryItem,
} from "../types/report.types";
import type { SpendingAlert } from "../services/alert.service";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    suggestions?: SpendingSuggestion[];
}

interface SpendingSuggestion {
    icon: string;
    title: string;
    description: string;
    amount?: number;
    color: string;
}

interface FinancialData {
    summary?: MonthlySummary;
    analysis?: AnalysisReport;
    recentTransactions?: TransactionHistoryItem[];
    isLoading: boolean;
}

const AIChatBox: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [financialData, setFinancialData] = useState<FinancialData>({
        isLoading: false,
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const fetchFinancialData = useCallback(async () => {
        if (financialData.summary) return; // Already loaded

        setFinancialData((prev) => ({ ...prev, isLoading: true }));
        try {
            const [summary, analysis, recentTransactions] = await Promise.all([
                fetchMonthlySummary(),
                fetchAnalysisReport(),
                fetchTransactionHistory(),
            ]);

            setFinancialData({
                summary,
                analysis,
                recentTransactions: recentTransactions.slice(0, 10),
                isLoading: false,
            });

            // Generate initial greeting with spending insights
            const greetingMessage = generateInitialGreeting(summary, analysis);
            setMessages([greetingMessage]);
        } catch (error) {
            console.error("Error fetching financial data:", error);
            setFinancialData((prev) => ({ ...prev, isLoading: false }));
            setMessages([
                {
                    id: "1",
                    role: "assistant",
                    content:
                        "Halo! Saya tidak bisa memuat data keuangan Anda saat ini. Silakan coba lagi nanti atau periksa koneksi internet Anda.",
                    timestamp: new Date(),
                },
            ]);
        }
    }, [financialData.summary]);

    useEffect(() => {
        if (isOpen) {
            fetchFinancialData();
        }
    }, [isOpen, fetchFinancialData]);

    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const generateInitialGreeting = (
        summary: MonthlySummary,
        analysis?: AnalysisReport,
    ): Message => {
        const suggestions: SpendingSuggestion[] = [];

        // Analyze spending patterns and generate suggestions
        if (summary) {
            const spendingRatio =
                summary.totalPengeluaran / summary.totalPemasukan;

            if (spendingRatio > 0.9) {
                suggestions.push({
                    icon: "⚠️",
                    title: "Pengeluaran Hampir Melebihi Pemasukan",
                    description: `Pengeluaran Anda ${formatCurrency(summary.totalPengeluaran)} hampir menyamai pemasukan ${formatCurrency(summary.totalPemasukan)}. Pertimbangkan untuk menunda pembelian yang tidak penting.`,
                    amount: summary.totalPengeluaran,
                    color: "#dc3545",
                });
            } else if (spendingRatio < 0.5) {
                suggestions.push({
                    icon: "✅",
                    title: "Keuangan Sangat Sehat!",
                    description: `Anda hanya mengeluarkan ${Math.round(spendingRatio * 100)}% dari pemasukan. Bagus! Anda bisa menabung lebih banyak atau berinvestasi.`,
                    amount: summary.neto,
                    color: "#28a745",
                });
            }
        }

        if (
            analysis?.spendingByCategory &&
            analysis.spendingByCategory.length > 0
        ) {
            const topCategory = analysis.spendingByCategory[0];
            if (topCategory.persentase > 30) {
                suggestions.push({
                    icon: "📊",
                    title: `Dominasi: ${topCategory.namaKategori}`,
                    description: `${topCategory.namaKategori} menghabiskan ${formatCurrency(topCategory.jumlah)} (${topCategory.persentase.toFixed(1)}% dari total). Coba cari alternatif yang lebih hemat.`,
                    amount: topCategory.jumlah,
                    color: "#ffc107",
                });
            }
        }

        // 50/30/20 Rule Analysis
        if (summary && summary.totalPemasukan > 0) {
            const fiftyPercent = summary.totalPemasukan * 0.5;
            if (summary.totalPengeluaran > fiftyPercent) {
                suggestions.push({
                    icon: "💡",
                    title: "Terapkan Aturan 50/30/20",
                    description: `Dari pemasukan ${formatCurrency(summary.totalPemasukan)}, alokasikan: Needs ${formatCurrency(fiftyPercent)} (50%), Wants ${formatCurrency(summary.totalPemasukan * 0.3)} (30%), Save ${formatCurrency(summary.totalPemasukan * 0.2)} (20%).`,
                    color: "#17a2b8",
                });
            }
        }

        // Recent transaction patterns
        if (
            financialData.recentTransactions &&
            financialData.recentTransactions.length > 0
        ) {
            const last7Days = financialData.recentTransactions.filter((t) => {
                const daysAgo =
                    (Date.now() - new Date(t.tanggal).getTime()) /
                    (1000 * 60 * 60 * 24);
                return daysAgo <= 7 && t.jenis === "pengeluaran";
            });

            const weeklySpending = last7Days.reduce(
                (sum, t) => sum + t.jumlah,
                0,
            );
            if (summary && weeklySpending > summary.totalPemasukan * 0.25) {
                suggestions.push({
                    icon: "🛑",
                    title: "Pengeluaran Mingguan Tinggi",
                    description: `7 hari terakhir Anda mengeluarkan ${formatCurrency(weeklySpending)}. Coba kurangi jajan atau tunda pembelian besar.`,
                    amount: weeklySpending,
                    color: "#fd7e14",
                });
            }
        }

        return {
            id: "1",
            role: "assistant",
            content: generateGreetingText(summary, suggestions),
            timestamp: new Date(),
            suggestions,
        };
    };

    const generateGreetingText = (
        summary?: MonthlySummary,
        suggestions?: SpendingSuggestion[],
    ): string => {
        if (!summary) {
            return "Halo! Saya AI Financial Assistant DuitFam. Saya bisa membantu Anda menganalisis pola pengeluaran dan memberikan saran pengelolaan keuangan. Apa yang ingin Anda ketahui?";
        }

        let greeting = `Halo! 👋 Saya AI Financial Assistant DuitFam.\n\n`;
        greeting += `📊 **Ringkasan Bulan Ini:**\n`;
        greeting += `• Pemasukan: ${formatCurrency(summary.totalPemasukan)}\n`;
        greeting += `• Pengeluaran: ${formatCurrency(summary.totalPengeluaran)}\n`;
        greeting += `• Selisih: ${formatCurrency(summary.neto)}\n\n`;

        if (suggestions && suggestions.length > 0) {
            greeting += `💡 Saya menemukan ${suggestions.length} saran untuk Anda:\n`;
            suggestions.forEach((s, i) => {
                greeting += `${s.icon} ${s.title}\n`;
            });
            greeting += `\nKlik saran di bawah atau tanya saya apa saja!`;
        } else {
            greeting += `Keuangan Anda terlihat stabil. Ada yang ingin Anda tanyakan tentang pengelolaan uang?`;
        }

        return greeting;
    };

    const processUserQuestion = async (
        question: string,
    ): Promise<{ content: string; suggestions?: SpendingSuggestion[] }> => {
        const lowerQuestion = question.toLowerCase();
        const suggestions: SpendingSuggestion[] = [];

        // Question pattern matching
        if (
            lowerQuestion.includes("pengeluaran") ||
            lowerQuestion.includes("spending") ||
            lowerQuestion.includes("habis")
        ) {
            if (financialData.analysis?.spendingByCategory) {
                const byCategory = financialData.analysis.spendingByCategory;
                let response = `📊 **Breakdown Pengeluaran per Kategori:**\n\n`;

                byCategory.forEach((cat) => {
                    response += `• ${cat.namaKategori}: ${formatCurrency(cat.jumlah)} (${cat.persentase.toFixed(1)}%)\n`;

                    if (cat.persentase > 25) {
                        suggestions.push({
                            icon: "⚠️",
                            title: `${cat.namaKategori} Terlalu Tinggi`,
                            description: `Kurangi pengeluaran ${cat.namaKategori} maksimal ${formatCurrency(financialData.summary!.totalPemasukan * 0.25)} (25% dari pemasukan).`,
                            amount: cat.jumlah,
                            color: "#dc3545",
                        });
                    }
                });

                if (financialData.analysis.topPengeluaran) {
                    const top = financialData.analysis.topPengeluaran;
                    response += `\n🔝 Pengeluaran terbesar: ${top.namaKategori} (${formatCurrency(top.jumlah)})`;
                }

                return { content: response, suggestions };
            }
        }

        if (
            lowerQuestion.includes("pemasukan") ||
            lowerQuestion.includes("income") ||
            lowerQuestion.includes("gaji")
        ) {
            if (financialData.summary) {
                let response = `💰 **Pemasukan Bulan Ini:**\n\n`;
                response += `• Total: ${formatCurrency(financialData.summary.totalPemasukan)}\n`;
                response += `• Setelah pengeluaran: ${formatCurrency(financialData.summary.neto)}\n\n`;

                if (financialData.analysis?.topPemasukan) {
                    response += `📈 Sumber pemasukan terbesar: ${financialData.analysis.topPemasukan.namaKategori}`;
                }

                return { content: response };
            }
        }

        if (
            lowerQuestion.includes("tabung") ||
            lowerQuestion.includes("save") ||
            lowerQuestion.includes("saving")
        ) {
            const savingsSuggestion: SpendingSuggestion = {
                icon: "🏦",
                title: "Saran Menabung",
                description: `Dari pemasukan ${formatCurrency(financialData.summary?.totalPemasukan || 0)}, idealnya tabung 20% = ${formatCurrency((financialData.summary?.totalPemasukan || 0) * 0.2)}. Saldo Anda saat ini: ${formatCurrency(financialData.summary?.saldoAkhir || 0)}.`,
                color: "#28a745",
            };

            return {
                content: `🏦 **Saran Menabung:**\n\nAturan 50/30/20 merekomendasikan 20% dari pemasukan untuk ditabung.\n\n• Pemasukan: ${formatCurrency(financialData.summary?.totalPemasukan || 0)}\n• Target Tabungan (20%): ${formatCurrency((financialData.summary?.totalPemasukan || 0) * 0.2)}\n• Saldo Saat Ini: ${formatCurrency(financialData.summary?.saldoAkhir || 0)}\n\n${(financialData.summary?.neto || 0) > 0 ? "✅ Anda masih bisa menabung bulan ini!" : "⚠️ Pengeluaran melebihi pemasukan, fokus kurangi pengeluaran dulu."}`,
                suggestions: [savingsSuggestion],
            };
        }

        if (
            lowerQuestion.includes("bisa belanja") ||
            lowerQuestion.includes("budget") ||
            lowerQuestion.includes("anggaran") ||
            lowerQuestion.includes("sarankan")
        ) {
            const available = financialData.summary
                ? financialData.summary.totalPemasukan -
                  financialData.summary.totalPengeluaran
                : 0;

            if (available > 0) {
                suggestions.push({
                    icon: "💵",
                    title: "Budget Tersedia",
                    description: `Anda masih punya ${formatCurrency(available)} untuk dialokasikan. Prioritaskan kebutuhan penting atau tabung semua!`,
                    amount: available,
                    color: "#28a745",
                });
            } else {
                suggestions.push({
                    icon: "🚫",
                    title: "Budget Habis",
                    description: `Pengeluaran sudah melebihi pemasukan ${formatCurrency(Math.abs(available))}. Jangan belanja dulu, fokus hemat!`,
                    amount: Math.abs(available),
                    color: "#dc3545",
                });
            }

            return {
                content: `💡 **Budget yang Tersisa:**\n\n${available > 0 ? `✅ Anda masih punya ${formatCurrency(available)} untuk sisa bulan ini.` : `⚠️ Budget sudah habis. Sisa: ${formatCurrency(available)}`}\n\nSaran saya:\n• Prioritaskan kebutuhan pokok (makanan, transportasi)\n• Tunda keinginan yang bisa ditunda\n• Sisakan minimal 10-20% untuk tabungan`,
                suggestions,
            };
        }

        if (
            lowerQuestion.includes("tips") ||
            lowerQuestion.includes("saran") ||
            lowerQuestion.includes("bagaimana")
        ) {
            return {
                content: `💡 **Tips Pengelolaan Keuangan:**\n\n1️⃣ Gunakan Aturan 50/30/20:\n   • 50% Kebutuhan (needs)\n   • 30% Keinginan (wants)\n   • 20% Tabungan (savings)\n\n2️⃣ Catat semua pengeluaran, sekecil apapun\n\n3️⃣ Evaluasi langganan yang tidak terpakai\n\n4️⃣ Masak sendiri lebih sering dari makan di luar\n\n5️⃣ Buat target menabung yang realistis\n\n${financialData.summary ? `\n📊 **Kondisi Anda:**\n• Rasio pengeluaran: ${((financialData.summary.totalPengeluaran / financialData.summary.totalPemasukan) * 100).toFixed(1)}%\n• ${financialData.summary.neto > 0 ? "✅ Kondisi sehat, lanjutkan!" : "⚠️ Perlu penghematan segera"}` : ""}`,
            };
        }

        // Default: provide general analysis
        return {
            content: `Maaf, saya belum bisa menjawab pertanyaan spesifik itu. Tapi saya bisa membantu Anda dengan:\n\n• 📊 Analisis pengeluaran per kategori\n• 💰 Informasi pemasukan & saldo\n• 🏦 Saran menabung\n• 💡 Budget yang tersedia\n• 💡 Tips pengelolaan keuangan\n\nCoba tanya: "Bagaimana pengeluaran saya?" atau "Berapa budget saya?"`,
        };
    };

    const handleSendMessage = async () => {
        if (!input.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            // Call Groq AI backend
            const response = await api.post("/ai/chat", {
                message: input.trim(),
                conversationHistory: messages.map((msg) => ({
                    role: msg.role,
                    content: msg.content,
                })),
            });

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: response.data.response,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // Show alerts if any
            if (response.data.alerts && response.data.alerts.length > 0) {
                // You could trigger alert banner here if needed
                console.log("New alerts:", response.data.alerts);
            }
        } catch (error: any) {
            console.error("Error processing message:", error);
            console.error("Error response:", error.response?.data);
            console.error("Error status:", error.response?.status);

            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content:
                    error.response?.data?.response ||
                    "Maaf, terjadi kesalahan pada server. Silakan coba lagi nanti.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleSuggestionClick = async (suggestion: SpendingSuggestion) => {
        setInput(suggestion.title);
        // Auto-send the suggestion
        setTimeout(() => {
            handleSendMessage();
        }, 100);
    };

    const renderMessageContent = (content: string) => {
        // Simple markdown-like formatting
        const lines = content.split("\n");
        return lines.map((line, index) => {
            // Bold text
            const formatted = line.replace(
                /\*\*(.*?)\*\*/g,
                '<strong style="font-weight: 600;">$1</strong>',
            );

            if (line.trim() === "") {
                return <div key={index} style={{ height: "8px" }} />;
            }

            return (
                <div
                    key={index}
                    dangerouslySetInnerHTML={{ __html: formatted }}
                    style={{ marginBottom: "2px" }}
                />
            );
        });
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: "fixed",
                    bottom: "24px",
                    right: "24px",
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0, 123, 255, 0.4)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                    transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.1)";
                    e.currentTarget.style.boxShadow =
                        "0 6px 16px rgba(0, 123, 255, 0.6)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(0, 123, 255, 0.4)";
                }}
                title="AI Financial Advisor"
            >
                <Chat size={28} />
            </button>
        );
    }

    return (
        <div
            style={{
                position: "fixed",
                bottom: "24px",
                right: "24px",
                width: "420px",
                height: "650px",
                backgroundColor: "white",
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
                display: "flex",
                flexDirection: "column",
                zIndex: 1000,
                overflow: "hidden",
            }}
        >
            {/* Header */}
            <div
                style={{
                    backgroundColor: "#007bff",
                    color: "white",
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                    }}
                >
                    <div
                        style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            backgroundColor: "white",
                            color: "#007bff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Robot size={24} />
                    </div>
                    <div>
                        <div style={{ fontWeight: "bold", fontSize: "16px" }}>
                            AI Financial Advisor
                        </div>
                        <div style={{ fontSize: "12px", opacity: 0.9 }}>
                            DuitFam Smart Spending Assistant
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "white",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    title="Tutup chat"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Messages */}
            <div
                style={{
                    flexGrow: 1,
                    overflowY: "auto",
                    padding: "20px",
                    backgroundColor: "#f8f9fa",
                }}
            >
                {messages.map((message) => (
                    <div key={message.id} style={{ marginBottom: "20px" }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent:
                                    message.role === "user"
                                        ? "flex-end"
                                        : "flex-start",
                                marginBottom: "12px",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    gap: "8px",
                                    maxWidth: "85%",
                                    flexDirection:
                                        message.role === "user"
                                            ? "row-reverse"
                                            : "row",
                                    alignItems: "flex-end",
                                }}
                            >
                                <div
                                    style={{
                                        width: "32px",
                                        height: "32px",
                                        borderRadius: "50%",
                                        backgroundColor:
                                            message.role === "user"
                                                ? "#007bff"
                                                : "#6c757d",
                                        color: "white",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    {message.role === "user" ? (
                                        <Person size={16} />
                                    ) : (
                                        <Robot size={16} />
                                    )}
                                </div>
                                <div
                                    style={{
                                        padding: "12px 16px",
                                        borderRadius: "16px",
                                        backgroundColor:
                                            message.role === "user"
                                                ? "#007bff"
                                                : "white",
                                        color:
                                            message.role === "user"
                                                ? "white"
                                                : "#333",
                                        fontSize: "14px",
                                        lineHeight: "1.6",
                                        boxShadow:
                                            "0 2px 4px rgba(0, 0, 0, 0.05)",
                                        borderBottomRightRadius:
                                            message.role === "user"
                                                ? "4px"
                                                : "16px",
                                        borderBottomLeftRadius:
                                            message.role === "assistant"
                                                ? "4px"
                                                : "16px",
                                    }}
                                >
                                    {renderMessageContent(message.content)}
                                </div>
                            </div>
                        </div>

                        {/* Spending Suggestions Cards */}
                        {message.suggestions &&
                            message.suggestions.length > 0 && (
                                <div
                                    style={{
                                        marginTop: "8px",
                                        paddingLeft: "40px",
                                    }}
                                >
                                    {message.suggestions.map(
                                        (suggestion, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() =>
                                                    handleSuggestionClick(
                                                        suggestion,
                                                    )
                                                }
                                                style={{
                                                    backgroundColor: "white",
                                                    border: `2px solid ${suggestion.color}`,
                                                    borderLeft: `4px solid ${suggestion.color}`,
                                                    borderRadius: "8px",
                                                    padding: "12px",
                                                    marginBottom: "8px",
                                                    cursor: "pointer",
                                                    transition: "all 0.2s ease",
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform =
                                                        "translateX(4px)";
                                                    e.currentTarget.style.boxShadow =
                                                        "0 2px 8px rgba(0,0,0,0.1)";
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform =
                                                        "translateX(0)";
                                                    e.currentTarget.style.boxShadow =
                                                        "none";
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontWeight: "bold",
                                                        fontSize: "14px",
                                                        marginBottom: "4px",
                                                        color: "#333",
                                                    }}
                                                >
                                                    {suggestion.icon}{" "}
                                                    {suggestion.title}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "#666",
                                                        lineHeight: "1.4",
                                                    }}
                                                >
                                                    {suggestion.description}
                                                </div>
                                                {suggestion.amount && (
                                                    <div
                                                        style={{
                                                            marginTop: "6px",
                                                            fontSize: "13px",
                                                            fontWeight: "600",
                                                            color: suggestion.color,
                                                        }}
                                                    >
                                                        {formatCurrency(
                                                            suggestion.amount,
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ),
                                    )}
                                </div>
                            )}
                    </div>
                ))}

                {isLoading && (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "flex-start",
                            marginBottom: "16px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                gap: "8px",
                                maxWidth: "80%",
                                alignItems: "flex-end",
                            }}
                        >
                            <div
                                style={{
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "50%",
                                    backgroundColor: "#6c757d",
                                    color: "white",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <Robot size={16} />
                            </div>
                            <div
                                style={{
                                    padding: "12px 16px",
                                    borderRadius: "16px",
                                    backgroundColor: "white",
                                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        gap: "4px",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "8px",
                                            height: "8px",
                                            borderRadius: "50%",
                                            backgroundColor: "#999",
                                            animation: "typing 1.4s infinite",
                                        }}
                                    />
                                    <div
                                        style={{
                                            width: "8px",
                                            height: "8px",
                                            borderRadius: "50%",
                                            backgroundColor: "#999",
                                            animation:
                                                "typing 1.4s infinite 0.2s",
                                        }}
                                    />
                                    <div
                                        style={{
                                            width: "8px",
                                            height: "8px",
                                            borderRadius: "50%",
                                            backgroundColor: "#999",
                                            animation:
                                                "typing 1.4s infinite 0.4s",
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <div
                style={{
                    padding: "8px 16px",
                    backgroundColor: "white",
                    borderTop: "1px solid #e0e0e0",
                    borderBottom: "1px solid #e0e0e0",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap: "6px",
                        overflowX: "auto",
                        paddingBottom: "4px",
                    }}
                >
                    {[
                        "💰 Pengeluaran saya",
                        "💵 Budget tersedia",
                        "🏦 Saran menabung",
                        "💡 Tips hemat",
                    ].map((quickAction) => (
                        <button
                            key={quickAction}
                            onClick={() => {
                                setInput(quickAction);
                                setTimeout(() => handleSendMessage(), 100);
                            }}
                            style={{
                                padding: "6px 12px",
                                backgroundColor: "#f8f9fa",
                                border: "1px solid #dee2e6",
                                borderRadius: "16px",
                                fontSize: "12px",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                    "#e9ecef";
                                e.currentTarget.style.borderColor = "#007bff";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                    "#f8f9fa";
                                e.currentTarget.style.borderColor = "#dee2e6";
                            }}
                        >
                            {quickAction}
                        </button>
                    ))}
                </div>
            </div>

            {/* Input */}
            <div
                style={{
                    padding: "16px",
                    backgroundColor: "white",
                    display: "flex",
                    gap: "8px",
                }}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Tanya tentang keuangan Anda..."
                    disabled={isLoading}
                    style={{
                        flexGrow: 1,
                        padding: "12px 16px",
                        border: "1px solid #ddd",
                        borderRadius: "24px",
                        fontSize: "14px",
                        outline: "none",
                    }}
                />
                <button
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isLoading}
                    style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "50%",
                        backgroundColor:
                            input.trim() && !isLoading ? "#007bff" : "#ccc",
                        color: "white",
                        border: "none",
                        cursor:
                            input.trim() && !isLoading
                                ? "pointer"
                                : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease",
                    }}
                >
                    <Send size={18} />
                </button>
            </div>

            {/* Typing animation CSS */}
            <style>{`
                @keyframes typing {
                    0%, 60%, 100% {
                        transform: translateY(0);
                        opacity: 0.7;
                    }
                    30% {
                        transform: translateY(-10px);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
};

export default AIChatBox;
