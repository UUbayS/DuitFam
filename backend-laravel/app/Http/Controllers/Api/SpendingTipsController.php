<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GroqService;
use App\Models\Mongo\SmartInsight;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\Category;
use Carbon\Carbon;
use App\Models\User;
use App\Models\SavingGoal;
use App\Models\ParentChildRelation;

class SpendingTipsController extends Controller
{
    protected GroqService $groqService;

    public function __construct(GroqService $groqService)
    {
        $this->groqService = $groqService;
    }

    public function index(Request $request)
    {
        try {
            $userId = (string) $request->user()->id;

            // Check for valid cached tips
            $cachedInsight = SmartInsight::getValidInsight($userId);
            if ($cachedInsight) {
                return response()->json([
                    'tips' => $cachedInsight->tips,
                    'financial_snapshot' => $cachedInsight->financial_snapshot,
                    'cached' => true,
                    'generated_at' => $cachedInsight->created_at->toISOString(),
                ]);
            }

            // Generate new tips
            $financialData = $this->getFinancialContext($userId);
            $tips = $this->groqService->generateSpendingTips($financialData);

            // Store in cache
            $snapshot = [
                'income' => $financialData['summary']['totalPemasukan'] ?? 0,
                'expense' => $financialData['summary']['totalPengeluaran'] ?? 0,
                'balance' => $financialData['summary']['saldoAkhir'] ?? 0,
            ];
            SmartInsight::storeTips($userId, $tips, $snapshot);

            return response()->json([
                'tips' => $tips,
                'financial_snapshot' => $snapshot,
                'cached' => false,
                'generated_at' => Carbon::now()->toISOString(),
            ]);

        } catch (\Exception $e) {
            Log::error("Spending tips error", ["error" => $e->getMessage()]);
            return response()->json([
                "tips" => $this->groqService->generateRuleBasedSpendingTips([]),
                "cached" => false,
                "error" => "Gagal memuat tips. Menggunakan saran dasar."
            ], 500);
        }
    }

    protected function getFinancialContext(string $userId): array
    {
        try {
            $currentMonth = Carbon::now()->format("Y-m");

            $transactions = Transaction::where("user_id", $userId)
                ->where("status", config('constants.transaction_status.berhasil'))
                ->where("tanggal", "like", $currentMonth . "%")
                ->get();

            $totalPemasukan = $transactions
                ->where("jenis", config('constants.transaction_types.pemasukan'))
                ->sum("jumlah");
            $totalPengeluaran = $transactions
                ->where("jenis", config('constants.transaction_types.pengeluaran'))
                ->sum("jumlah");
            $neto = $totalPemasukan - $totalPengeluaran;

            $wallet = Wallet::where("user_id", $userId)->first();

            $spendingByCategory = [];
            $categoryTotals = $transactions
                ->where("jenis", config('constants.transaction_types.pengeluaran'))
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
                            ? round(($amount / $totalPengeluaran) * 100, 2)
                            : 0,
                ];
            }

            usort(
                $spendingByCategory,
                fn($a, $b) => $b["persentase"] <=> $a["persentase"],
            );

            // User Context
            $user = User::find($userId);
            $userContext = [
                'role' => $user?->role ?? 'unknown',
                'username' => $user?->username ?? 'User',
            ];

            // Saving Goals
            $savingGoals = SavingGoal::where('user_id', $userId)
                ->where('status', config('constants.goal_status.aktif'))
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

            // Family Context
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
                "user" => $userContext,
                "saving_goals" => $savingGoals,
                "family" => $familyContext,
            ];
        } catch (\Exception $e) {
            Log::error("Error getting financial context for tips", [
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
                "user" => ['role' => 'unknown', 'username' => 'User'],
                "saving_goals" => [],
                "family" => [],
            ];
        }
    }
}
