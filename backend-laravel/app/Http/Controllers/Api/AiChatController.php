<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GroqService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\Category;
use Carbon\Carbon;
use App\Models\User;
use App\Models\SavingGoal;          // <-- TAMBAH
use App\Models\ParentChildRelation;

class AiChatController extends Controller
{
    protected GroqService $groqService;

    public function __construct(GroqService $groqService)
    {
        $this->groqService = $groqService;
    }

    public function chat(Request $request)
    {
        try {
            $request->validate([
                "message" => "required|string|max:1000",
                "conversationHistory" => "array",
            ]);

            $userId = (string) $request->user()->id;
            $financialData = $this->getFinancialContext($userId);
            $history = $request->input("conversationHistory", []);

            // Now handled by Triple-Tier Service (Cloud -> Local -> Rule-based)
            // Alerts removed from context - AI uses raw financial data directly
            $response = $this->groqService->generateFinancialAdvice(
                $financialData,
                $request->message,
                $history
            );

            return response()->json([
                "response" => $response,
                "context" => [
                    "summary" => $financialData["summary"] ?? null,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error("AI Chat error", ["error" => $e->getMessage()]);

            return response()->json(
                [
                    "response" =>
                        "Maaf, terjadi kesalahan. Silakan coba lagi nanti.",
                    "alerts" => [],
                ],
                500,
            );
        }
    }

    public function getAlerts(Request $request)
    {
        try {
            $userId = (string) $request->user()->id;
            $financialData = $this->getFinancialContext($userId);
            $alerts = $this->generateAlerts($financialData);

            return response()->json([
                "alerts" => $alerts,
                "financialSummary" => $financialData["summary"] ?? null,
            ]);
        } catch (\Exception $e) {
            Log::error("Get alerts error", ["error" => $e->getMessage()]);
            return response()->json(["alerts" => []], 500);
        }
    }

    protected function generateAlerts(array $financialData): array
    {
        try {
            $alerts = $this->groqService->generateSpendingAlerts(
                $financialData,
            );
            if (!empty($alerts)) {
                return $alerts;
            }
        } catch (\Exception $e) {
            Log::warning("AI alerts failed");
        }

        return $this->ruleBasedAlerts($financialData);
    }

    protected function getFinancialContext(string $userId): array
    {
        try {
            $currentMonth = Carbon::now()->format("Y-m");

            $transactions = Transaction::where("user_id", $userId)
                ->where("status", "berhasil")
                ->where("tanggal", "like", $currentMonth . "%")
                ->get();

            $totalPemasukan = $transactions
                ->where("jenis", "pemasukan")
                ->sum("jumlah");
            $totalPengeluaran = $transactions
                ->where("jenis", "pengeluaran")
                ->sum("jumlah");
            $neto = $totalPemasukan - $totalPengeluaran;

            $wallet = Wallet::where("user_id", $userId)->first();

            $spendingByCategory = [];
            $categoryTotals = $transactions
                ->where("jenis", "pengeluaran")
                ->groupBy("category_id")
                ->map(fn($txs) => $txs->sum("jumlah"));

            foreach ($categoryTotals as $categoryId => $amount) {
                $category = Category::find($categoryId);
                $spendingByCategory[] = [
                    "categoryId" => $categoryId,
                    "namaKategori" => $category?->nama_kategori ?? "Lainnya",
                    "jumlah" => $amount,
                    "persentase" =>
                        $totalPengeluaran > 0
                            ? ($amount / $totalPengeluaran) * 100
                            : 0,
                ];
            }

            usort(
                $spendingByCategory,
                fn($a, $b) => $b["persentase"] <=> $a["persentase"],
            );

            $recentTransactions = Transaction::where("user_id", $userId)
                ->where("status", "berhasil")
                ->orderBy("tanggal", "desc")
                ->limit(20)
                ->get()
                ->map(
                    fn($tx) => [
                        "id_transaksi" => $tx->id_transaksi,
                        "jenis" => $tx->jenis,
                        "jumlah" => $tx->jumlah,
                        "keterangan" => $tx->keterangan,
                        "tanggal" => $tx->tanggal,
                        "nama_kategori" =>
                            $tx->category?->nama_kategori ?? "Lainnya",
                    ],
                )
                ->toArray();

            // 1. User Context
            $user = User::find($userId);
            $userContext = [
                'role' => $user?->role ?? 'unknown',
                'username' => $user?->username ?? 'User',
            ];

            // 2. Saving Goals
            $savingGoals = SavingGoal::where('user_id', $userId)
                ->where('status', 'aktif')
                ->get()
                ->map(function ($goal) {
                    $target = (float) $goal->target_jumlah;
                    $collected = (float) ($goal->jumlah_terkumpul ?? 0);
                    $progress = $target > 0 ? round(($collected / $target) * 100, 2) : 0;
                    $deadline = Carbon::parse($goal->tanggal_target);
                    $daysLeft = Carbon::now()->diffInDays($deadline, false);
                    return [
                        'nama_target' => $goal->nama_target,
                        'target_jumlah' => $target,
                        'jumlah_terkumpul' => $collected,
                        'progress' => $progress,
                        'tanggal_target' => $goal->tanggal_target,
                        'is_overdue' => $daysLeft < 0,
                        'is_near_deadline' => $daysLeft >= 0 && $daysLeft <= 7,
                    ];
                })->toArray();

            // 3. Family Context
            $familyContext = [];
            if ($user && $user->role === 'parent') {
                $childrenIds = ParentChildRelation::where('parent_id', $userId)
                    ->where('is_active', true)
                    ->pluck('child_id')->toArray();
                $familyContext = ['children_count' => count($childrenIds)];
            } elseif ($user && $user->role === 'child') {
                $parentId = ParentChildRelation::where('child_id', $userId)
                    ->where('is_active', true)
                    ->value('parent_id');
                $familyContext = ['parent_id' => $parentId];
            }

            return [
                "summary" => [
                    "bulan" => $currentMonth,
                    "totalPemasukan" => $totalPemasukan,
                    "totalPengeluaran" => $totalPengeluaran,
                    "neto" => $neto,
                    "saldoAkhir" => $wallet?->saldo_sekarang ?? 0,
                ],
                "spendingByCategory" => $spendingByCategory,
                "recentTransactions" => $recentTransactions,
                "wallet" => [
                    "saldo_sekarang" => $wallet?->saldo_sekarang ?? 0,
                ],
                "user" => $userContext,
                "saving_goals" => $savingGoals,
                "family" => $familyContext,
            ];
        } catch (\Exception $e) {
            Log::error("Error getting financial context", [
                "error" => $e->getMessage(),
            ]);
            return [
                "summary" => [
                    "totalPemasukan" => 0,
                    "totalPengeluaran" => 0,
                    "neto" => 0,
                    "saldoAkhir" => 0,
                ],
                "spendingByCategory" => [],
                "recentTransactions" => [],
                "user" => ['role' => 'unknown', 'username' => 'User'],
                "saving_goals" => [],
                "family" => [],
            ];
        }
    }

    /**
     * Smart rule-based response (more accurate than 0.5b LLM)
     */
    protected function generateSmartResponse(
        array $data,
        string $question,
    ): string {
        $summary = $data["summary"] ?? [];
        $income = $summary["totalPemasukan"] ?? 0;
        $expense = $summary["totalPengeluaran"] ?? 0;
        $net = $summary["neto"] ?? 0;
        $balance = $summary["saldoAkhir"] ?? 0;
        $spendingByCategory = $data["spendingByCategory"] ?? [];

        $q = strtolower($question);

        // PENGELUARAN
        if (
            str_contains($q, "pengeluaran") ||
            str_contains($q, "spending") ||
            str_contains($q, "habis")
        ) {
            $response = "📊 **Ringkasan Pengeluaran Bulan Ini:**\n\n";
            $response .=
                "• Total Pengeluaran: Rp " .
                number_format($expense, 0, ",", ".") .
                "\n";
            $response .=
                "• Total Pemasukan: Rp " .
                number_format($income, 0, ",", ".") .
                "\n";
            $response .=
                "• Selisih: Rp " . number_format($net, 0, ",", ".") . "\n";
            $response .=
                "• Saldo: Rp " . number_format($balance, 0, ",", ".") . "\n\n";

            if ($income > 0) {
                $ratio = round(($expense / $income) * 100);
                $response .= "💡 Anda sudah mengeluarkan **{$ratio}%** dari pemasukan.\n\n";

                if ($ratio > 100) {
                    $response .=
                        "🚨 **PERINGATAN**: Pengeluaran melebihi pemasukan Rp " .
                        number_format(abs($net), 0, ",", ".") .
                        "!\n\nSegera:\n• Tunda pembelian tidak penting\n• Cari pemasukan tambahan\n• Evaluasi pengeluaran berulang";
                } elseif ($ratio > 90) {
                    $response .=
                        "⚠️ **Hati-hati!** Budget hampir habis ({$ratio}%).\n\nSisa budget: Rp " .
                        number_format($income - $expense, 0, ",", ".") .
                        "\n\nPrioritaskan:\n• Kebutuhan pokok saja\n• Makan & transport\n• Tunda belanja";
                } elseif ($ratio > 70) {
                    $response .=
                        "✅ Budget masih aman dengan sisa Rp " .
                        number_format($income - $expense, 0, ",", ".") .
                        ".\n\nTapi tetap hemat ya! Sisakan minimal 20% untuk tabungan.";
                } else {
                    $response .=
                        "✅ **Keuangan sangat sehat!** Anda masih bisa menabung Rp " .
                        number_format($net, 0, ",", ".") .
                        " bulan ini.";
                }
            }

            if (!empty($spendingByCategory)) {
                $response .= "\n\n📈 **Top Pengeluaran:**\n";
                foreach (array_slice($spendingByCategory, 0, 5) as $cat) {
                    $response .=
                        "• {$cat["namaKategori"]}: Rp " .
                        number_format($cat["jumlah"], 0, ",", ".") .
                        " ({$cat["persentase"]}%)\n";
                }
            }

            return $response;
        }

        // BUDGET
        if (
            str_contains($q, "budget") ||
            str_contains($q, "bisa belanja") ||
            str_contains($q, "anggaran")
        ) {
            $available = $income - $expense;

            if ($available > 0) {
                $response = "💵 **Budget Tersedia Bulan Ini:**\n\n";
                $response .=
                    "✅ Anda masih punya **Rp " .
                    number_format($available, 0, ",", ".") .
                    "**\n\n";
                $response .= "💡 **Saran Alokasi:**\n";
                $response .=
                    "• Kebutuhan pokok: Rp " .
                    number_format($available * 0.5, 0, ",", ".") .
                    " (50%)\n";
                $response .=
                    "• Keinginan: Rp " .
                    number_format($available * 0.3, 0, ",", ".") .
                    " (30%)\n";
                $response .=
                    "• **Tabungan: Rp " .
                    number_format($available * 0.2, 0, ",", ".") .
                    "** (20%)\n\n";

                if ($available < $income * 0.2) {
                    $response .=
                        "⚠️ Budget tersisa sedikit. Prioritaskan yang penting saja!";
                } else {
                    $response .= "Masih aman, jangan boros ya! 😊";
                }
            } else {
                $response = "🚫 **Budget Sudah Habis!**\n\n";
                $response .=
                    "❌ Pengeluaran sudah melebihi pemasukan **Rp " .
                    number_format(abs($available), 0, ",", ".") .
                    "**.\n\n";
                $response .=
                    "**JANGAN BELANJA DULU!**\n\nFokus:\n• Hemat sebisa mungkin\n• Cari pemasukan tambahan\n• Tunda semua pengeluaran tidak penting";
            }

            return $response;
        }

        // TABUNGAN
        if (str_contains($q, "tabung") || str_contains($q, "save")) {
            $targetSavings = $income * 0.2;

            $response = "🏦 **Saran Menabung Bulan Ini:**\n\n";
            $response .=
                "• Pemasukan: Rp " . number_format($income, 0, ",", ".") . "\n";
            $response .=
                "• Target Tabungan (20%): **Rp " .
                number_format($targetSavings, 0, ",", ".") .
                "**\n";
            $response .=
                "• Saldo Saat Ini: Rp " .
                number_format($balance, 0, ",", ".") .
                "\n";
            $response .=
                "• Sisa Setelah Pengeluaran: Rp " .
                number_format($net, 0, ",", ".") .
                "\n\n";

            if ($net > $targetSavings) {
                $response .=
                    "✅ **Bisa menabung lebih dari target!** Anda masih punya Rp " .
                    number_format($net, 0, ",", ".") .
                    " setelah semua pengeluaran.\n\nCoba deposit ke rekening tabungan supaya tidak kepakai.";
            } elseif ($net > 0) {
                $response .=
                    "✅ Masih bisa menabung Rp " .
                    number_format($net, 0, ",", ".") .
                    ", walau belum mencapai target Rp " .
                    number_format($targetSavings, 0, ",", ".") .
                    ".\n\nKurangi pengeluaran bulan depan biar bisa nabung lebih banyak!";
            } else {
                $response .=
                    "⚠️ **Tidak bisa menabung bulan ini** karena pengeluaran melebihi pemasukan.\n\nFokus kurangi pengeluaran dulu, baru nabung bulan depan.";
            }

            return $response;
        }

        // SALDO
        if (
            str_contains($q, "saldo") ||
            str_contains($q, "uang di tabungan") ||
            str_contains($q, "berapa uang")
        ) {
            $response = "💰 **Saldo Anda Saat Ini:**\n\n";
            $response .=
                "• Saldo: **Rp " .
                number_format($balance, 0, ",", ".") .
                "**\n\n";
            $response .= "📊 **Bulan Ini:**\n";
            $response .=
                "• Pemasukan: Rp " . number_format($income, 0, ",", ".") . "\n";
            $response .=
                "• Pengeluaran: Rp " .
                number_format($expense, 0, ",", ".") .
                "\n";
            $response .=
                "• Net: Rp " . number_format($net, 0, ",", ".") . "\n\n";

            if ($balance > 0) {
                $response .=
                    $balance > $income * 0.5
                        ? "✅ Saldo Anda cukup sehat. Pertahankan!"
                        : "⚠️ Saldo relatif kecil dibanding pemasukan. Coba hemat lebih.";
            } else {
                $response .= "🚨 Saldo kosong! Segera isi ulang.";
            }

            return $response;
        }

        // TIPS
        if (
            str_contains($q, "tips") ||
            str_contains($q, "saran") ||
            str_contains($q, "bagaimana") ||
            str_contains($q, "hemat")
        ) {
            $response = "💡 **Tips Pengelolaan Keuangan:**\n\n";
            $response .= "**1️⃣ Aturan 50/30/20:**\n";
            $response .=
                "   • 50% Kebutuhan: Rp " .
                number_format($income * 0.5, 0, ",", ".") .
                "\n";
            $response .=
                "   • 30% Keinginan: Rp " .
                number_format($income * 0.3, 0, ",", ".") .
                "\n";
            $response .=
                "   • 20% Tabungan: Rp " .
                number_format($income * 0.2, 0, ",", ".") .
                "\n\n";

            $response .= "**2️⃣ Tips Praktis:**\n";
            $response .= "• Catat semua pengeluaran\n";
            $response .= "• Evaluasi langganan tidak terpakai\n";
            $response .= "• Masak sendiri lebih hemat\n";
            $response .= "• Buat target menabung realistis\n\n";

            if ($income > 0) {
                $ratio = round(($expense / $income) * 100);
                $response .= "📊 **Kondisi Anda:** Rasio pengeluaran {$ratio}%\n";
                $response .=
                    $ratio > 90
                        ? "⚠️ Perlu penghematan segera!"
                        : ($ratio < 70
                            ? "✅ Kondisi sehat, lanjutkan!"
                            : "⚠️ Masih bisa lebih hemat");
            }

            return $response;
        }

        // PEMASUKAN
        if (
            str_contains($q, "penghasilan") ||
            str_contains($q, "pemasukan") ||
            str_contains($q, "gaji") ||
            str_contains($q, "income")
        ) {
            $response = "💰 **Pemasukan Bulan Ini:**\n\n";
            $response .=
                "• Total: **Rp " . number_format($income, 0, ",", ".") . "**\n";
            $response .=
                "• Setelah Pengeluaran: Rp " .
                number_format($net, 0, ",", ".") .
                "\n\n";

            $response .=
                $net > 0
                    ? "✅ Anda masih punya Rp " .
                        number_format($net, 0, ",", ".") .
                        " setelah semua pengeluaran."
                    : "🚨 Pengeluaran melebihi pemasukan! Cari pemasukan tambahan.";

            return $response;
        }

        // DEFAULT
        return "👋 **Halo! Saya bisa membantu Anda dengan:**\n\n" .
            "• 📊 \"Bagaimana pengeluaran saya?\" - Lihat ringkasan pengeluaran\n" .
            "• 💵 \"Berapa budget tersedia?\" - Cek sisa budget\n" .
            "• 🏦 \"Saran menabung\" - Tips menabung bulan ini\n" .
            "• 💰 \"Berapa saldo saya?\" - Cek saldo\n" .
            "• 💡 \"Tips hemat\" - Tips pengelolaan keuangan\n" .
            "• 💰 \"Berapa pemasukan saya?\" - Lihat pemasukan\n\n" .
            "**Data Anda Bulan Ini:**\n" .
            "• Pemasukan: Rp " .
            number_format($income, 0, ",", ".") .
            "\n" .
            "• Pengeluaran: Rp " .
            number_format($expense, 0, ",", ".") .
            "\n" .
            "• Saldo: Rp " .
            number_format($balance, 0, ",", ".") .
            "\n\n" .
            "Silakan tanya salah satu di atas!";
    }

    protected function ruleBasedAlerts(array $data): array
    {
        $alerts = [];
        $summary = $data["summary"] ?? [];
        $spendingByCategory = $data["spendingByCategory"] ?? [];

        $income = $summary["totalPemasukan"] ?? 0;
        $expense = $summary["totalPengeluaran"] ?? 0;
        $net = $summary["neto"] ?? 0;

        if ($income > 0) {
            $ratio = $expense / $income;

            if ($ratio > 1) {
                $alerts[] = [
                    "type" => "warning",
                    "title" => "🚨 Pengeluaran Melebihi Pemasukan!",
                    "message" =>
                        "Pengeluaran Anda melebihi pemasukan sebesar Rp " .
                        number_format(abs($net), 0, ",", ".") .
                        ". Segera kurangi pengeluaran!",
                    "severity" => "high",
                    "amount" => abs($net),
                ];
            } elseif ($ratio > 0.9) {
                $alerts[] = [
                    "type" => "warning",
                    "title" => "⚠️ Pengeluaran Hampir Melebihi Pemasukan",
                    "message" =>
                        "Anda sudah mengeluarkan " .
                        round($ratio * 100) .
                        "% dari pemasukan. Sisa budget sangat tipis!",
                    "severity" => "high",
                    "amount" => $expense,
                ];
            } elseif ($ratio < 0.7) {
                $alerts[] = [
                    "type" => "success",
                    "title" => "✅ Keuangan Sehat!",
                    "message" =>
                        "Bagus! Anda hanya mengeluarkan " .
                        round($ratio * 100) .
                        "% dari pemasukan. Bisa menabung lebih banyak.",
                    "severity" => "low",
                ];
            }
        }

        foreach ($spendingByCategory as $category) {
            if (($category["persentase"] ?? 0) > 30) {
                $alerts[] = [
                    "type" => "warning",
                    "title" => "📊 {$category["namaKategori"]} Terlalu Tinggi",
                    "message" =>
                        "{$category["namaKategori"]} menghabiskan Rp " .
                        number_format($category["jumlah"], 0, ",", ".") .
                        " ({$category["persentase"]}% dari total)",
                    "severity" => "medium",
                    "amount" => $category["jumlah"],
                ];
            }
        }

        return $alerts;
    }
}
