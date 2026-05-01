<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Mongo\AnalyticsSnapshot;
use App\Models\Mongo\SmartInsight;
use App\Models\ParentChildRelation;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    private function buildUserSummary(string $userId, string $month): array
    {
        $base = Transaction::query()
            ->where('user_id', $userId)
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', 'like', $month.'%');

        $income = (float) (clone $base)->where('jenis', config('constants.transaction_types.pemasukan'))->sum('jumlah');
        $expense = (float) (clone $base)->where('jenis', config('constants.transaction_types.pengeluaran'))->sum('jumlah');
        $wallet = Wallet::firstOrCreate(['user_id' => $userId], ['saldo_sekarang' => 0]);

        return [
            'bulan' => $month,
            'totalPemasukan' => $income,
            'totalPengeluaran' => $expense,
            'neto' => $income - $expense,
            'saldoAkhir' => (float) $wallet->saldo_sekarang,
        ];
    }

    private function buildFamilySummary(string $parentId, string $month): array
    {
        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parentId)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();

        $txBase = Transaction::query()
            ->whereIn('user_id', $childIds->all())
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', 'like', $month.'%');

        $income = (float) (clone $txBase)->where('jenis', config('constants.transaction_types.pemasukan'))->sum('jumlah');
        $expense = (float) (clone $txBase)->where('jenis', config('constants.transaction_types.pengeluaran'))->sum('jumlah');
        $walletTotal = (float) Wallet::query()->whereIn('user_id', $childIds->all())->sum('saldo_sekarang');

        return [
            'bulan' => $month,
            'totalPemasukan' => $income,
            'totalPengeluaran' => $expense,
            'neto' => $income - $expense,
            'saldoAkhir' => $walletTotal,
            'childCount' => $childIds->count(),
        ];
    }

    public function summary(Request $request)
    {
        $userId = (string) $request->user()->id;
        $month = (string) $request->query('month', now()->format('Y-m'));

        $transactions = Transaction::query()
            ->where('user_id', $userId)
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', 'like', $month.'%')
            ->get(['jenis', 'jumlah']);

        $income = 0;
        $expense = 0;
        foreach ($transactions as $t) {
            if ($t->jenis === config('constants.transaction_types.pemasukan')) {
                $income += (float) $t->jumlah;
            } else if ($t->jenis === config('constants.transaction_types.pengeluaran')) {
                $expense += (float) $t->jumlah;
            }
        }

        $wallet = Wallet::where('user_id', $userId)->first(['saldo_sekarang']);
        $saldo = $wallet ? (float) $wallet->saldo_sekarang : 0;

        $summaryData = [
            'bulan' => $month,
            'totalPemasukan' => $income,
            'totalPengeluaran' => $expense,
            'neto' => $income - $expense,
            'saldoAkhir' => $saldo,
        ];

        if ($request->boolean('snapshot')) {
            AnalyticsSnapshot::updateOrCreate(
                ['user_id' => $userId, 'period' => $month],
                ['summary' => $summaryData, 'chart_data' => [], 'created_at' => now()]
            );
        }

        return response()->json(['message' => 'OK', 'data' => $summaryData]);
    }

    public function history(Request $request)
    {
        $userId = (string) $request->user()->id;
        
        $rows = Transaction::where('user_id', $userId)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get(['_id', 'user_id', 'jenis', 'jumlah', 'keterangan', 'tanggal', 'created_at', 'status', 'category_id', 'source_id', 'jenis as original_jenis']);

        $categoryIds = $rows->pluck('category_id')->filter()->unique()->values();
        $categoryMap = [];
        if ($categoryIds->isNotEmpty()) {
            $categories = Category::query()
                ->whereIn('_id', $categoryIds->all())
                ->get(['_id', 'nama_kategori', 'icon'])
                ->keyBy(fn ($c) => (string) $c->id)
                ->map(fn ($c) => ['nama' => $c->nama_kategori, 'icon' => $c->icon ?? 'Tag'])
                ->all();
            $categoryMap = $categories;
        }

        $data = $rows->map(function ($t) use ($categoryMap) {
            $cat = $t->category_id ? ($categoryMap[(string) $t->category_id] ?? null) : null;
            $categoryName = $cat ? $cat['nama'] : 'Lainnya';
            $categoryIcon = $cat ? $cat['icon'] : 'Tag';

            if ($t->jenis === config('constants.transaction_types.menabung')) {
                $categoryName = 'Menabung';
                $categoryIcon = 'PiggyBank';
            } else if ($t->jenis === config('constants.transaction_types.refund')) {
                $categoryName = 'Refund';
                $categoryIcon = 'ArrowCounterclockwise';
            } else if ($t->source_id) {
                $categoryName = 'Tabungan';
                $categoryIcon = 'Wallet2';
            }

            return [
                'id_transaksi' => (string) $t->id,
                'jenis' => $t->jenis,
                'jumlah' => $t->jumlah,
                'keterangan' => $t->keterangan,
                'tanggal' => $t->tanggal,
                'created_at' => $t->created_at,
                'status' => $t->status ?? 'berhasil',
                'nama_kategori' => $categoryName,
                'icon_kategori' => $categoryIcon,
            ];
        });

        $withdrawals = WithdrawalRequest::query()
            ->where('child_id', $userId)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(function ($w) {
                $status = $w->status === 'pending' ? 'pending' : ($w->status === 'rejected' ? 'ditolak' : 'berhasil');

                return [
                    'id_transaksi' => 'withdrawal:'.(string) $w->id,
                    'jenis' => config('constants.transaction_types.pengeluaran'),
                    'jumlah' => (float) $w->amount,
                    'keterangan' => $w->reason ?: 'Pengajuan penarikan',
                    'tanggal' => $w->created_at ? $w->created_at->toDateString() : now()->toDateString(),
                    'created_at' => $w->created_at,
                    'status' => $status,
                    'nama_kategori' => 'Penarikan',
                ];
            });

        $merged = $data->concat($withdrawals)->sortByDesc('created_at')->values()->take(50)->values();

        return response()->json(['message' => 'OK', 'data' => $merged]);
    }

    public function historical(Request $request)
    {
        $userId = (string) $request->user()->id;
        $result = Transaction::raw(function ($collection) use ($userId) {
            return $collection->aggregate([
                ['$match' => [
                    'user_id' => $userId,
                    'status' => config('constants.transaction_status.berhasil')
                ]],
                ['$group' => [
                    '_id' => ['$substr' => ['$tanggal', 0, 7]],
                    'pemasukan' => ['$sum' => [
                        '$cond' => [
                            ['$eq' => ['$jenis', config('constants.transaction_types.pemasukan')]],
                            '$jumlah',
                            0
                        ]
                    ]],
                    'pengeluaran' => ['$sum' => [
                        '$cond' => [
                            ['$eq' => ['$jenis', config('constants.transaction_types.pengeluaran')]],
                            '$jumlah',
                            0
                        ]
                    ]]
                ]],
                ['$sort' => ['_id' => -1]],
                ['$project' => [
                    'month' => '$_id',
                    'pemasukan' => 1,
                    'pengeluaran' => 1,
                    '_id' => 0
                ]]
            ]);
        });

        $data = array_map(function ($item) {
            return [
                'month' => $item->_id,
                'pemasukan' => (float) ($item->pemasukan ?? 0),
                'pengeluaran' => (float) ($item->pengeluaran ?? 0),
            ];
        }, iterator_to_array($result));

        return response()->json(['message' => 'OK', 'data' => $data]);
    }

    public function analysis(Request $request)
    {
        $userId = (string) $request->user()->id;
        $month = (string) $request->query('month', now()->format('Y-m'));
        
        $txSummary = Transaction::raw(function ($collection) use ($userId, $month) {
            return $collection->aggregate([
                ['$match' => [
                    'user_id' => $userId,
                    'status' => config('constants.transaction_status.berhasil'),
                    'tanggal' => ['$regex' => "^$month"]
                ]],
                ['$group' => [
                    '_id' => '$jenis',
                    'total' => ['$sum' => '$jumlah']
                ]]
            ]);
        });

        $income = 0;
        $expense = 0;
        foreach ($txSummary as $item) {
            if ($item->_id === config('constants.transaction_types.pemasukan')) {
                $income = (float) ($item->total ?? 0);
            } else if ($item->_id === config('constants.transaction_types.pengeluaran')) {
                $expense = (float) ($item->total ?? 0);
            }
        }

        $wallet = Wallet::where('user_id', $userId)->first(['saldo_sekarang']);
        $saldo = $wallet ? (float) $wallet->saldo_sekarang : 0;

        $summary = [
            'bulan' => $month,
            'totalPemasukan' => $income,
            'totalPengeluaran' => $expense,
            'neto' => $income - $expense,
            'saldoAkhir' => $saldo,
        ];

        $expenseByCategory = Transaction::raw(function ($collection) use ($userId, $month) {
            return $collection->aggregate([
                ['$match' => [
                    'user_id' => $userId,
                    'jenis' => config('constants.transaction_types.pengeluaran'),
                    'status' => config('constants.transaction_status.berhasil'),
                    'tanggal' => ['$regex' => "^$month"]
                ]],
                ['$group' => [
                    '_id' => '$category_id',
                    'total' => ['$sum' => '$jumlah']
                ]],
                ['$sort' => ['total' => -1]]
            ]);
        });

        $categoryIds = [];
        $categoryTotals = [];
        foreach ($expenseByCategory as $item) {
            if ($item->_id) {
                $categoryIds[] = $item->_id;
                $categoryTotals[(string)$item->_id] = (float) ($item->total ?? 0);
            }
        }

        $categoryMap = [];
        if (!empty($categoryIds)) {
            $categories = Category::whereIn('_id', $categoryIds)->get(['_id', 'nama_kategori'])->keyBy(fn ($c) => (string) $c->id)->all();
            $categoryMap = array_map(fn ($c) => $c->nama_kategori, $categories);
        }

        $topExpense = null;
        if (!empty($categoryTotals)) {
            arsort($categoryTotals);
            $topCategoryId = array_key_first($categoryTotals);
            $topAmount = $categoryTotals[$topCategoryId];
            $topExpense = [
                'categoryId' => $topCategoryId,
                'namaKategori' => $categoryMap[$topCategoryId] ?? 'Lainnya',
                'jumlah' => $topAmount,
            ];
        }

        $categoryBreakdown = array_map(function ($amount, $categoryId) use ($summary, $categoryMap) {
            return [
                'categoryId' => $categoryId,
                'namaKategori' => $categoryMap[$categoryId] ?? 'Lainnya',
                'jumlah' => $amount,
                'persentase' => $summary['totalPengeluaran'] > 0 ? round(($amount / $summary['totalPengeluaran']) * 100, 2) : 0,
            ];
        }, $categoryTotals, array_keys($categoryTotals));
        $categoryBreakdown = array_values($categoryBreakdown);

        $chart = $this->historical($request)->getData(true)['data'];
        $smartRecommendation = $summary['totalPengeluaran'] > $summary['totalPemasukan']
            ? 'Pengeluaran melebihi pemasukan. Terapkan batas kategori harian.'
            : 'Kondisi arus kas sehat. Alokasikan minimal 20% ke tabungan/investasi.';
        $incomeVal = (float) $summary['totalPemasukan'];
        $need = round($incomeVal * 0.5, 0);
        $want = round($incomeVal * 0.3, 0);
        $save = round($incomeVal * 0.2, 0);
        $recommendation = [
            'namaMetode' => 'Metode 50/30/20',
            'deskripsiMetode' => 'Bagi pemasukan: 50% kebutuhan, 30% keinginan, 20% tabungan/investasi.',
            'detailRekomendasi' => 'Dari pemasukan '.number_format($incomeVal, 0, ',', '.').', rekomendasi alokasi: kebutuhan '.number_format($need, 0, ',', '.').', keinginan '.number_format($want, 0, ',', '.').', tabungan/investasi '.number_format($save, 0, ',', '.').'.',
            'langkah_implementasi' => 'Catat semua pemasukan & pengeluaran|Kelompokkan pengeluaran menjadi kebutuhan vs keinginan|Tetapkan batas pengeluaran per kategori|Sisihkan 20% di awal bulan untuk tabungan/target|Evaluasi akhir periode dan sesuaikan batas',
        ];
        SmartInsight::updateOrCreate([
            'user_id' => $request->user()->id,
            'month' => $month,
        ], [
            'insight' => 'Analisis 50/30/20 otomatis.',
            'recommendation' => $smartRecommendation,
            'score' => $summary['neto'] >= 0 ? 80 : 55,
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'OK', 'data' => [
            'summary' => $summary,
            'topPemasukan' => null,
            'topPengeluaran' => $topExpense ? [
                'namaKategori' => $topExpense['namaKategori'] ?? 'Lainnya',
                'persentase' => $summary['totalPengeluaran'] > 0 ? round(($topExpense['jumlah'] / $summary['totalPengeluaran']) * 100, 2) : 0,
                'jumlah' => $topExpense['jumlah'],
            ] : null,
            'chartData' => $chart,
            'smartRecommendation' => $smartRecommendation,
            'spendingByCategory' => $categoryBreakdown,
            'recommendation' => $recommendation,
        ]]);
    }

    public function familySummary(Request $request)
    {
        $parent = $request->user();
        if ($parent->role !== config('constants.roles.parent')) {
            return response()->json(['message' => 'Hanya akun parent yang dapat melihat laporan keluarga.'], 403);
        }

        $month = (string) $request->query('month', now()->format('Y-m'));
        $data = $this->buildFamilySummary((string) $parent->id, $month);

        return response()->json(['message' => 'OK', 'data' => $data]);
    }

    public function familyHistorical(Request $request)
    {
        $parent = $request->user();
        if ($parent->role !== config('constants.roles.parent')) {
            return response()->json(['message' => 'Hanya akun parent yang dapat melihat laporan keluarga.'], 403);
        }

        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parent->id)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();

        if ($childIds->isEmpty()) {
            return response()->json(['message' => 'OK', 'data' => []]);
        }

        $result = Transaction::raw(function ($collection) use ($childIds) {
            return $collection->aggregate([
                ['$match' => [
                    'user_id' => ['$in' => $childIds->all()],
                    'status' => config('constants.transaction_status.berhasil')
                ]],
                ['$group' => [
                    '_id' => ['$substr' => ['$tanggal', 0, 7]],
                    'pemasukan' => ['$sum' => [
                        '$cond' => [
                            ['$eq' => ['$jenis', config('constants.transaction_types.pemasukan')]],
                            '$jumlah',
                            0
                        ]
                    ]],
                    'pengeluaran' => ['$sum' => [
                        '$cond' => [
                            ['$eq' => ['$jenis', config('constants.transaction_types.pengeluaran')]],
                            '$jumlah',
                            0
                        ]
                    ]]
                ]],
                ['$sort' => ['_id' => -1]],
                ['$project' => [
                    'month' => '$_id',
                    'pemasukan' => 1,
                    'pengeluaran' => 1,
                    '_id' => 0
                ]]
            ]);
        });

        $data = array_map(function ($item) {
            return [
                'month' => $item->_id,
                'pemasukan' => (float) ($item->pemasukan ?? 0),
                'pengeluaran' => (float) ($item->pengeluaran ?? 0),
            ];
        }, iterator_to_array($result));

        return response()->json(['message' => 'OK', 'data' => $data]);
    }

    public function familyHistory(Request $request)
    {
        $parent = $request->user();
        if ($parent->role !== config('constants.roles.parent')) {
            return response()->json(['message' => 'Hanya akun parent yang dapat melihat laporan keluarga.'], 403);
        }

        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parent->id)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();

        $rows = Transaction::query()
            ->whereIn('user_id', $childIds->all())
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        $categoryIds = $rows->pluck('category_id')->filter()->unique()->values();
        $categoryMap = Category::query()
            ->whereIn('_id', $categoryIds->all())
            ->get()
            ->keyBy(fn ($c) => (string) $c->id)
            ->map(fn ($c) => [
                'nama' => $c->nama_kategori,
                'icon' => $c->icon ?? 'Tag'
            ])
            ->all();

        $data = $rows->map(function ($t) use ($categoryMap) {
            $cat = $t->category_id ? ($categoryMap[(string) $t->category_id] ?? null) : null;
            $categoryName = $cat ? $cat['nama'] : 'Lainnya';
            $categoryIcon = $cat ? $cat['icon'] : 'Tag';

            if ($t->jenis === config('constants.transaction_types.menabung')) {
                $categoryName = 'Menabung';
                $categoryIcon = 'PiggyBank';
            } else if ($t->jenis === config('constants.transaction_types.refund')) {
                $categoryName = 'Refund';
                $categoryIcon = 'ArrowCounterclockwise';
            } else if ($t->source_id) {
                $categoryName = 'Tabungan';
                $categoryIcon = 'Wallet2';
            }

            return [
                'id_transaksi' => (string) $t->id,
                'user_id' => (string) $t->user_id,
                'jenis' => $t->jenis,
                'jumlah' => (float) $t->jumlah,
                'keterangan' => $t->keterangan,
                'tanggal' => $t->tanggal,
                'created_at' => $t->created_at,
                'status' => $t->status ?? 'berhasil',
                'nama_kategori' => $categoryName,
                'icon_kategori' => $categoryIcon,
            ];
        });

        $withdrawals = WithdrawalRequest::query()
            ->where('parent_id', (string) $parent->id)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(function ($w) {
                $status = $w->status === 'pending' ? 'pending' : ($w->status === 'rejected' ? 'ditolak' : 'berhasil');

                return [
                    'id_transaksi' => 'withdrawal:'.(string) $w->id,
                    'user_id' => (string) $w->child_id,
                    'jenis' => config('constants.transaction_types.pengeluaran'),
                    'jumlah' => (float) $w->amount,
                    'keterangan' => $w->reason ?: 'Pengajuan penarikan',
                    'tanggal' => $w->created_at ? $w->created_at->toDateString() : now()->toDateString(),
                    'created_at' => $w->created_at,
                    'status' => $status,
                    'nama_kategori' => 'Penarikan',
                ];
            });

        $merged = $data->concat($withdrawals)->sortByDesc('created_at')->values()->take(100)->values();

        return response()->json(['message' => 'OK', 'data' => $merged]);
    }

    public function familyAnalysis(Request $request)
    {
        $parent = $request->user();
        if ($parent->role !== config('constants.roles.parent')) {
            return response()->json(['message' => 'Hanya akun parent yang dapat melihat laporan keluarga.'], 403);
        }

        $month = (string) $request->query('month', now()->format('Y-m'));
        $summary = $this->buildFamilySummary((string) $parent->id, $month);
        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parent->id)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();

        $expenseByCategory = Transaction::query()
            ->whereIn('user_id', $childIds->all())
            ->where('jenis', config('constants.transaction_types.pengeluaran'))
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', 'like', $month.'%')
            ->get()
            ->groupBy('category_id')
            ->map(fn ($items) => (float) $items->sum('jumlah'));

        $allCategoryIds = $expenseByCategory->keys()->filter()->all();
        $categoryMap = Category::whereIn('_id', $allCategoryIds)->get()->keyBy(fn ($c) => (string) $c->id);

        $topExpense = null;
        if ($expenseByCategory->isNotEmpty()) {
            $topCategoryId = $expenseByCategory->sortDesc()->keys()->first();
            $topAmount = (float) $expenseByCategory->max();
            $category = $topCategoryId ? ($categoryMap[(string) $topCategoryId] ?? null) : null;
            $topExpense = (object) [
                'namaKategori' => $category?->nama_kategori ?? 'Lainnya',
                'jumlah' => $topAmount,
            ];
        }

        $chart = $this->familyHistorical($request)->getData(true)['data'];
        $smartRecommendation = $summary['totalPengeluaran'] > $summary['totalPemasukan']
            ? 'Pengeluaran keluarga melebihi pemasukan. Buat batas kategori keluarga dan kurangi pos terbesar.'
            : 'Arus kas keluarga sehat. Terapkan alokasi 50/30/20 dan tingkatkan porsi tabungan.';
        $income = (float) $summary['totalPemasukan'];
        $need = round($income * 0.5, 0);
        $want = round($income * 0.3, 0);
        $save = round($income * 0.2, 0);
        $recommendation = [
            'namaMetode' => 'Metode 50/30/20 Keluarga',
            'deskripsiMetode' => 'Bagi pemasukan keluarga: 50% kebutuhan, 30% keinginan, 20% tabungan/investasi.',
            'detailRekomendasi' => 'Dari pemasukan keluarga '.number_format($income, 0, ',', '.').', rekomendasi alokasi: kebutuhan '.number_format($need, 0, ',', '.').', keinginan '.number_format($want, 0, ',', '.').', tabungan/investasi '.number_format($save, 0, ',', '.').'.',
            'langkah_implementasi' => 'Tetapkan tujuan tabungan keluarga & tiap anak|Buat anggaran kategori keluarga|Pantau pos terbesar setiap bulan|Sisihkan 20% sebelum belanja kebutuhan|Diskusikan target bersama anak',
        ];

        return response()->json(['message' => 'OK', 'data' => [
            'summary' => $summary,
            'topPemasukan' => null,
            'topPengeluaran' => $topExpense ? [
                'namaKategori' => $topExpense->namaKategori ?? 'Lainnya',
                'persentase' => $summary['totalPengeluaran'] > 0 ? round(((float) $topExpense->jumlah / (float) $summary['totalPengeluaran']) * 100, 2) : 0,
                'jumlah' => (float) $topExpense->jumlah,
            ] : null,
            'chartData' => $chart,
            'smartRecommendation' => $smartRecommendation,
            'recommendation' => $recommendation,
        ]]);
    }
}
