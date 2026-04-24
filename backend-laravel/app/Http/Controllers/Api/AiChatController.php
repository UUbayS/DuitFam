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
use App\Models\SavingGoal;
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

            $allCatIds = $categoryTotals->keys()->filter()->all();
            $catMap = Category::whereIn('_id', $allCatIds)->get()->keyBy(fn($c) => (string) $c->id);

            foreach ($categoryTotals as $categoryId => $amount) {
                $category = $categoryId ? ($catMap[(string) $categoryId] ?? null) : null;
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
                        "id_transaksi" => (string) $tx->id,
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
