<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReportPeriodRequest;
use App\Models\Category;
use App\Models\Mongo\AnalyticsSnapshot;
use App\Models\Mongo\SmartInsight;
use App\Models\ParentChildRelation;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use App\Services\GroqService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ReportController extends Controller
{
    private function resolveTargetUserIds(Request $request, string $parentId): array
    {
        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parentId)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();

        $childId = $request->query('child_id');

        if ($childId) {
            $childId = (string) $childId;
            $owned = $childIds->contains($childId);
            if (!$owned) {
                abort(403, 'Anak tidak ditemukan dalam keluarga Anda.');
            }
            return [$childId];
        }

        $group = $request->query('group', 'semua');
        if ($group === 'ortu') {
            return [$parentId];
        }
        if ($group === 'anak') {
            return $childIds->all();
        }
        return collect([$parentId])->merge($childIds)->unique()->values()->all();
    }

    private function applyTimeFilter($query, Request $request)
    {
        if ($request->has('start_date') && $request->has('end_date')) {
            return $query->whereBetween('tanggal', [$request->start_date, $request->end_date]);
        }

        if ($request->has('year')) {
            return $query->where('tanggal', 'like', $request->year . '%');
        }

        $month = $request->query('month', now()->format('Y-m'));
        return $query->where('tanggal', 'like', $month . '%');
    }

    private function buildUserSummary(string $userId, Request $request): array
    {
        $base = Transaction::query()
            ->where('user_id', $userId)
            ->where('status', config('constants.transaction_status.berhasil'));
        
        $base = $this->applyTimeFilter($base, $request);

        $income = (float) (clone $base)->where('jenis', config('constants.transaction_types.pemasukan'))->sum('jumlah');
        $expense = (float) (clone $base)->where('jenis', config('constants.transaction_types.pengeluaran'))->sum('jumlah');
        $wallet = Wallet::firstOrCreate(['user_id' => $userId], ['saldo_sekarang' => 0]);

        $selectedMonth = $request->query('month', now()->format('Y-m'));
        $endOfSelectedMonth = now()->createFromFormat('Y-m', $selectedMonth)->endOfMonth()->toDateString();
        $endOfPrevMonth = now()->createFromFormat('Y-m', $selectedMonth)->subMonth()->endOfMonth()->toDateString();
        
        $currentSaldo = (float) $wallet->saldo_sekarang;
        
        // Calculate saldoAkhir (closing balance of selected month)
        // = current balance - transactions after selected month
        $transactionsAfterSelected = Transaction::query()
            ->where('user_id', $userId)
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', '>', $endOfSelectedMonth)
            ->get(['jenis', 'jumlah']);
        
        $netAfterSelected = 0;
        foreach ($transactionsAfterSelected as $t) {
            if ($t->jenis === config('constants.transaction_types.pemasukan')) {
                $netAfterSelected -= (float) $t->jumlah;
            } else {
                $netAfterSelected += (float) $t->jumlah;
            }
        }
        $saldoAkhir = $currentSaldo + $netAfterSelected;
        
        // Calculate saldoBulanLalu (closing balance of previous month)
        $transactionsAfterPrev = Transaction::query()
            ->where('user_id', $userId)
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', '>', $endOfPrevMonth)
            ->get(['jenis', 'jumlah']);
        
        $netAfterPrev = 0;
        foreach ($transactionsAfterPrev as $t) {
            if ($t->jenis === config('constants.transaction_types.pemasukan')) {
                $netAfterPrev -= (float) $t->jumlah;
            } else {
                $netAfterPrev += (float) $t->jumlah;
            }
        }
        $saldoBulanLalu = $currentSaldo + $netAfterPrev;

        return [
            'bulan' => $selectedMonth,
            'totalPemasukan' => $income,
            'totalPengeluaran' => $expense,
            'neto' => $income - $expense,
            'saldoAkhir' => $saldoAkhir,
            'saldoBulanLalu' => $saldoBulanLalu,
        ];
    }

    private function buildFamilySummary(string $parentId, Request $request): array
    {
        $allUserIds = collect($this->resolveTargetUserIds($request, $parentId));
        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parentId)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();

        $childId = $request->query('child_id');
        $effectiveGroup = $childId ? 'anak' : $request->query('group', 'semua');

        $txBase = Transaction::query()
            ->whereIn('user_id', $allUserIds->all())
            ->where('status', config('constants.transaction_status.berhasil'));

        $txBase = $this->applyTimeFilter($txBase, $request);

        $incomeQuery = (clone $txBase)->where('jenis', config('constants.transaction_types.pemasukan'));
        $expenseQuery = (clone $txBase)->where('jenis', config('constants.transaction_types.pengeluaran'));

        if ($effectiveGroup === 'semua') {
            $income = (float) $incomeQuery->where('is_internal', '!=', true)->sum('jumlah');
            $expense = (float) $expenseQuery->where('is_internal', '!=', true)->sum('jumlah');
        } else {
            $income = (float) $incomeQuery->sum('jumlah');
            $expense = (float) $expenseQuery->sum('jumlah');
        }

        $childWalletTotal = 0;
        if ($effectiveGroup !== 'ortu' && $childIds->isNotEmpty()) {
            $groupChildIds = ($effectiveGroup === 'anak') ? $allUserIds : $childIds;
            $childWalletTotal = (float) Wallet::query()->whereIn('user_id', $groupChildIds->all())->sum('saldo_sekarang');
        }

        $parentWallet = ($effectiveGroup !== 'anak') ? Wallet::firstOrCreate(['user_id' => $parentId], ['saldo_sekarang' => 0]) : null;
        $currentSaldoTotal = $childWalletTotal + (($parentWallet) ? (float) $parentWallet->saldo_sekarang : 0);

        $selectedMonth = $request->query('month', now()->format('Y-m'));
        $endOfSelectedMonth = now()->createFromFormat('Y-m', $selectedMonth)->endOfMonth()->toDateString();
        $endOfPrevMonth = now()->createFromFormat('Y-m', $selectedMonth)->subMonth()->endOfMonth()->toDateString();

        $afterQuery = Transaction::query()
            ->whereIn('user_id', $allUserIds->all())
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', '>', $endOfSelectedMonth);

        if ($effectiveGroup === 'semua') {
            $afterQuery->where('is_internal', '!=', true);
        }

        $transactionsAfterSelected = $afterQuery->get(['jenis', 'jumlah']);

        $netAfterSelected = 0;
        foreach ($transactionsAfterSelected as $t) {
            if ($t->jenis === config('constants.transaction_types.pemasukan')) {
                $netAfterSelected -= (float) $t->jumlah;
            } else {
                $netAfterSelected += (float) $t->jumlah;
            }
        }
        $saldoAkhir = $currentSaldoTotal + $netAfterSelected;

        $prevQuery = Transaction::query()
            ->whereIn('user_id', $allUserIds->all())
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', '>', $endOfPrevMonth);

        if ($effectiveGroup === 'semua') {
            $prevQuery->where('is_internal', '!=', true);
        }

        $transactionsAfterPrev = $prevQuery->get(['jenis', 'jumlah']);

        $netAfterPrev = 0;
        foreach ($transactionsAfterPrev as $t) {
            if ($t->jenis === config('constants.transaction_types.pemasukan')) {
                $netAfterPrev -= (float) $t->jumlah;
            } else {
                $netAfterPrev += (float) $t->jumlah;
            }
        }
        $saldoBulanLalu = $currentSaldoTotal + $netAfterPrev;

        $result = [
            'bulan' => $selectedMonth,
            'totalPemasukan' => $income,
            'totalPengeluaran' => $expense,
            'neto' => $income - $expense,
            'saldoAkhir' => $saldoAkhir,
            'saldoBulanLalu' => $saldoBulanLalu,
            'childCount' => $childIds->count(),
        ];

        if ($childId) {
            $childUser = User::find($childId);
            $result['username'] = $childUser?->username;
        }

        return $result;
    }

    public function summary(Request $request)
    {
        $userId = (string) $request->user()->id;

        $query = Transaction::query()
            ->where('user_id', $userId)
            ->where('status', config('constants.transaction_status.berhasil'));
        
        $query = $this->applyTimeFilter($query, $request);
        $transactions = $query->get(['jenis', 'jumlah']);

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
        $currentSaldo = $wallet ? (float) $wallet->saldo_sekarang : 0;

        $selectedMonth = $request->query('month', now()->format('Y-m'));
        $endOfSelectedMonth = now()->createFromFormat('Y-m', $selectedMonth)->endOfMonth()->toDateString();
        $endOfPrevMonth = now()->createFromFormat('Y-m', $selectedMonth)->subMonth()->endOfMonth()->toDateString();

        // Calculate saldoAkhir (closing balance of selected month)
        $transactionsAfterSelected = Transaction::query()
            ->where('user_id', $userId)
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', '>', $endOfSelectedMonth)
            ->get(['jenis', 'jumlah']);
        
        $netAfterSelected = 0;
        foreach ($transactionsAfterSelected as $t) {
            if ($t->jenis === config('constants.transaction_types.pemasukan')) {
                $netAfterSelected -= (float) $t->jumlah;
            } else {
                $netAfterSelected += (float) $t->jumlah;
            }
        }
        $saldoAkhir = $currentSaldo + $netAfterSelected;

        // Calculate saldoBulanLalu (closing balance of previous month)
        $transactionsAfterPrev = Transaction::query()
            ->where('user_id', $userId)
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', '>', $endOfPrevMonth)
            ->get(['jenis', 'jumlah']);
        
        $netAfterPrev = 0;
        foreach ($transactionsAfterPrev as $t) {
            if ($t->jenis === config('constants.transaction_types.pemasukan')) {
                $netAfterPrev -= (float) $t->jumlah;
            } else {
                $netAfterPrev += (float) $t->jumlah;
            }
        }
        $saldoBulanLalu = $currentSaldo + $netAfterPrev;

        $summaryData = [
            'bulan' => $selectedMonth,
            'totalPemasukan' => $income,
            'totalPengeluaran' => $expense,
            'neto' => $income - $expense,
            'saldoAkhir' => $saldoAkhir,
            'saldoBulanLalu' => $saldoBulanLalu,
        ];

        return response()->json(['message' => 'OK', 'data' => $summaryData]);
    }

    public function history(Request $request)
    {
        $userId = (string) $request->user()->id;
        
        $query = Transaction::where('user_id', $userId);
        $query = $this->applyTimeFilter($query, $request);

        $rows = $query->orderByDesc('created_at')
            ->limit(50)
            ->get(['_id', 'user_id', 'jenis', 'jumlah', 'keterangan', 'tanggal', 'created_at', 'status', 'category_id', 'source_id', 'is_internal', 'jenis as original_jenis']);

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

        $username = $request->user()->username;

        $data = $rows->map(function ($t) use ($categoryMap, $username) {
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
                'username' => $username,
                'jenis' => $t->jenis,
                'jumlah' => $t->jumlah,
                'keterangan' => $t->keterangan,
                'tanggal' => $t->tanggal,
                'created_at' => $t->created_at,
                'status' => $t->status ?? 'berhasil',
                'nama_kategori' => $categoryName,
                'icon_kategori' => $categoryIcon,
                'is_internal' => (bool) ($t->is_internal ?? false),
            ];
        });

        return response()->json(['message' => 'OK', 'data' => $data->values()->take(50)->values()]);
    }

    public function historical(Request $request)
    {
        $userId = (string) $request->user()->id;
        $unit = $request->query('unit', 'tahunan'); // Default tahunan for dashboard
        
        $result = Transaction::raw(function ($collection) use ($userId, $unit, $request) {
            $match = [
                'user_id' => $userId,
                'status' => config('constants.transaction_status.berhasil'),
            ];

            // Apply specific period filtering if provided
            if ($unit === 'mingguan' && $request->has('start_date') && $request->has('end_date')) {
                $match['tanggal'] = ['$gte' => $request->start_date, '$lte' => $request->end_date];
                $groupBy = ['$substr' => ['$tanggal', 0, 10]]; // YYYY-MM-DD
            } else if ($unit === 'bulan' && $request->has('month')) {
                $match['tanggal'] = ['$regex' => '^' . $request->month];
                $groupBy = ['$substr' => ['$tanggal', 0, 10]]; // YYYY-MM-DD
            } else if ($unit === 'tahunan' && $request->has('year')) {
                $match['tanggal'] = ['$regex' => '^' . $request->year];
                $groupBy = ['$substr' => ['$tanggal', 0, 7]]; // YYYY-MM
            } else {
                // Default fallback (usually for dashboard)
                $groupBy = ['$substr' => ['$tanggal', 0, 7]]; // YYYY-MM
            }

            return $collection->aggregate([
                ['$match' => $match],
                ['$group' => [
                    '_id' => $groupBy,
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
                ['$sort' => ['_id' => 1]]
            ]);
        });

        $data = array_map(function ($item) {
            return [
                'month' => (string) ($item->_id ?? ''),
                'pemasukan' => (float) ($item->pemasukan ?? 0),
                'pengeluaran' => (float) ($item->pengeluaran ?? 0),
            ];
        }, iterator_to_array($result));

        return response()->json(['message' => 'OK', 'data' => $data]);
    }

    public function analysis(Request $request)
    {
        $userId = (string) $request->user()->id;
        $summary = $this->buildUserSummary($userId, $request);
        $month = $request->query('month', now()->format('Y-m'));

        $expenseQuery = Transaction::query()
            ->where('user_id', $userId)
            ->where('jenis', config('constants.transaction_types.pengeluaran'))
            ->where('status', config('constants.transaction_status.berhasil'));
        
        $expenseQuery = $this->applyTimeFilter($expenseQuery, $request);
        
        $expenseByCategory = $expenseQuery->get()
            ->groupBy('category_id')
            ->map(fn ($items) => (float) $items->sum('jumlah'));

        $categoryIds = $expenseByCategory->keys()->filter()->all();
        $categoryMap = [];
        if (!empty($categoryIds)) {
            $categories = Category::whereIn('_id', $categoryIds)->get(['_id', 'nama_kategori'])->keyBy(fn ($c) => (string) $c->id)->all();
            $categoryMap = array_map(fn ($c) => $c->nama_kategori, $categories);
        }

        $topExpense = null;
        if ($expenseByCategory->isNotEmpty()) {
            $topCategoryId = $expenseByCategory->sortDesc()->keys()->first();
            $topAmount = (float) $expenseByCategory->max();
            $topExpense = [
                'categoryId' => $topCategoryId,
                'namaKategori' => $categoryMap[$topCategoryId] ?? 'Lainnya',
                'jumlah' => $topAmount,
            ];
        }

        $categoryBreakdown = [];
        foreach ($expenseByCategory as $categoryId => $amount) {
            $categoryBreakdown[] = [
                'categoryId' => $categoryId,
                'namaKategori' => $categoryMap[$categoryId] ?? 'Lainnya',
                'jumlah' => $amount,
                'persentase' => $summary['totalPengeluaran'] > 0 ? round(($amount / $summary['totalPengeluaran']) * 100, 2) : 0,
            ];
        }

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

        $data = $this->buildFamilySummary((string) $parent->id, $request);

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

        $group = $request->query('group', 'semua');
        if ($group === 'ortu') {
            $allUserIds = collect([(string) $parent->id]);
        } elseif ($group === 'anak') {
            $allUserIds = $childIds;
        } else {
            $allUserIds = collect([(string) $parent->id])->merge($childIds)->unique()->values();
        }

        $unit = $request->query('unit', 'tahunan');

        $result = Transaction::raw(function ($collection) use ($allUserIds, $unit, $request, $group) {
            $match = [
                'user_id' => ['$in' => $allUserIds->all()],
                'status' => config('constants.transaction_status.berhasil'),
            ];

            if ($group === 'semua') {
                $match['is_internal'] = ['$ne' => true];
            }

            if ($unit === 'mingguan' && $request->has('start_date') && $request->has('end_date')) {
                $match['tanggal'] = ['$gte' => $request->start_date, '$lte' => $request->end_date];
                $groupBy = ['$substr' => ['$tanggal', 0, 10]];
            } else if ($unit === 'bulan' && $request->has('month')) {
                $match['tanggal'] = ['$regex' => '^' . $request->month];
                $groupBy = ['$substr' => ['$tanggal', 0, 10]];
            } else if ($unit === 'tahunan' && $request->has('year')) {
                $match['tanggal'] = ['$regex' => '^' . $request->year];
                $groupBy = ['$substr' => ['$tanggal', 0, 7]];
            } else {
                $groupBy = ['$substr' => ['$tanggal', 0, 7]];
            }

            return $collection->aggregate([
                ['$match' => $match],
                ['$group' => [
                    '_id' => $groupBy,
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
                ['$sort' => ['_id' => 1]]
            ]);
        });

        $data = array_map(function ($item) {
            return [
                'month' => (string) ($item->_id ?? ''),
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

        $group = $request->query('group', 'semua');
        if ($group === 'ortu') {
            $allUserIds = collect([(string) $parent->id]);
        } elseif ($group === 'anak') {
            $allUserIds = $childIds;
        } else {
            $allUserIds = collect([(string) $parent->id])->merge($childIds)->unique()->values();
        }

        $query = Transaction::query()->whereIn('user_id', $allUserIds->all());
        $query = $this->applyTimeFilter($query, $request);

        $rows = $query->orderByDesc('created_at')
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

        $familyMemberMap = \App\Models\User::whereIn('_id', $allUserIds->all())->get(['_id', 'username'])->keyBy(fn($u) => (string) $u->id);

        $data = $rows->filter(function ($t) use ($group) {
            if ($group === 'semua') {
                return !($t->is_internal && $t->jenis === config('constants.transaction_types.pengeluaran'));
            }
            return true;
        })->map(function ($t) use ($categoryMap, $familyMemberMap) {
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
                'username' => $familyMemberMap[(string) $t->user_id]->username ?? 'Unknown',
                'jenis' => $t->jenis,
                'jumlah' => (float) $t->jumlah,
                'keterangan' => $t->keterangan,
                'tanggal' => $t->tanggal,
                'created_at' => $t->created_at,
                'status' => $t->status ?? 'berhasil',
                'nama_kategori' => $categoryName,
                'icon_kategori' => $categoryIcon,
                'is_internal' => (bool) ($t->is_internal ?? false),
            ];
        });

        return response()->json(['message' => 'OK', 'data' => $data->values()->take(100)->values()]);
    }

    public function familyAnalysis(Request $request)
    {
        $parent = $request->user();
        if ($parent->role !== config('constants.roles.parent')) {
            return response()->json(['message' => 'Hanya akun parent yang dapat melihat laporan keluarga.'], 403);
        }

        $summary = $this->buildFamilySummary((string) $parent->id, $request);
        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parent->id)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();

        $group = $request->query('group', 'semua');
        if ($group === 'ortu') {
            $allUserIds = collect([(string) $parent->id]);
        } elseif ($group === 'anak') {
            $allUserIds = $childIds;
        } else {
            $allUserIds = collect([(string) $parent->id])->merge($childIds)->unique()->values();
        }

        $expenseQuery = Transaction::query()
            ->whereIn('user_id', $allUserIds->all())
            ->where('jenis', config('constants.transaction_types.pengeluaran'))
            ->where('status', config('constants.transaction_status.berhasil'));

        if ($group === 'semua') {
            $expenseQuery->where('is_internal', '!=', true);
        }
        
        $expenseQuery = $this->applyTimeFilter($expenseQuery, $request);
        
        $expenseByCategory = $expenseQuery->get()
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

    public function familyAnalysisPdf(ReportPeriodRequest $request, GroqService $groqService)
    {
        $parent = $request->user();
        if ($parent->role !== config('constants.roles.parent')) {
            return response()->json(['message' => 'Hanya akun parent yang dapat mengunduh laporan keluarga.'], 403);
        }

        $month = $request->input('month', Carbon::now()->format('Y-m'));

        $monthStart = $month . '-01';
        $monthEnd = Carbon::createFromFormat('Y-m', $month)->endOfMonth()->toDateString();
        $request->merge([
            'start_date' => $monthStart,
            'end_date' => $monthEnd,
        ]);

        // TODO: This block (childIds + group + expenseByCategory + topExpense) duplicates
        // the equivalent block in familyAnalysis(). If a third caller appears (e.g. CSV export,
        // scheduled email), extract into a private buildFamilyAnalysisContext() helper.
        $summary = $this->buildFamilySummary((string) $parent->id, $request);
        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parent->id)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();
        $group = $request->query('group', 'semua');
        if ($group === 'ortu') {
            $allUserIds = collect([(string) $parent->id]);
        } elseif ($group === 'anak') {
            $allUserIds = $childIds;
        } else {
            $allUserIds = collect([(string) $parent->id])->merge($childIds)->unique()->values();
        }

        $expenseQuery = Transaction::query()
            ->whereIn('user_id', $allUserIds->all())
            ->where('jenis', config('constants.transaction_types.pengeluaran'))
            ->where('status', config('constants.transaction_status.berhasil'));

        if ($group === 'semua') {
            $expenseQuery->where('is_internal', '!=', true);
        }

        $expenseQuery = $this->applyTimeFilter($expenseQuery, $request);

        $expenseByCategory = $expenseQuery->get()
            ->groupBy('category_id')
            ->map(fn ($items) => (float) $items->sum('jumlah'));

        $categoryIds = $expenseByCategory->keys()->filter()->all();
        $categoryMap = Category::whereIn('_id', $categoryIds)->get()->keyBy(fn ($c) => (string) $c->id);

        $topExpense = null;
        if ($expenseByCategory->isNotEmpty()) {
            $topCategoryId = $expenseByCategory->sortDesc()->keys()->first();
            $topAmount = (float) $expenseByCategory->max();
            $topName = $topCategoryId ? ($categoryMap[(string) $topCategoryId]?->nama_kategori ?? 'Lainnya') : 'Lainnya';
            $topExpense = [
                'categoryId' => $topCategoryId,
                'namaKategori' => $topName,
                'jumlah' => $topAmount,
                'persentase' => $summary['totalPengeluaran'] > 0
                    ? round(($topAmount / $summary['totalPengeluaran']) * 100, 2)
                    : 0,
            ];
        }

        $income = (float) $summary['totalPemasukan'];
        $allocation = [
            'need' => round($income * 0.5, 0),
            'want' => round($income * 0.3, 0),
            'save' => round($income * 0.2, 0),
        ];

        $smartRecommendation = $summary['totalPengeluaran'] > $summary['totalPemasukan']
            ? 'Pengeluaran keluarga melebihi pemasukan. Buat batas kategori keluarga dan kurangi pos terbesar.'
            : 'Arus kas keluarga sehat. Terapkan alokasi 50/30/20 dan tingkatkan porsi tabungan.';

        $familyContext = [
            'summary' => [
                'bulan' => $month,
                'totalPemasukan' => $summary['totalPemasukan'],
                'totalPengeluaran' => $summary['totalPengeluaran'],
                'neto' => $summary['neto'],
                'saldoAkhir' => $summary['saldoAkhir'],
            ],
            'spendingByCategory' => $expenseByCategory->map(function ($amount, $categoryId) use ($summary, $categoryMap) {
                $name = $categoryId ? ($categoryMap[(string) $categoryId]?->nama_kategori ?? 'Lainnya') : 'Lainnya';
                return [
                    'categoryId' => $categoryId,
                    'namaKategori' => $name,
                    'jumlah' => (float) $amount,
                    'persentase' => $summary['totalPengeluaran'] > 0
                        ? round(((float) $amount / $summary['totalPengeluaran']) * 100, 2)
                        : 0,
                ];
            })->values()->all(),
            'user' => ['role' => 'parent', 'username' => $parent->username],
            'saving_goals' => [],
            'family' => ['children_count' => $childIds->count()],
        ];

        try {
            $tips = $groqService->generateSpendingTips($familyContext);
        } catch (\Throwable $e) {
            Log::error('Family PDF narrative failed', ['error' => $e->getMessage()]);
            $tips = [];
        }

        $narrativeParagraphs = $this->flattenTipsToParagraphs($tips);

        $bulanIndo = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
            5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
            9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
        ];
        [$year, $monthNum] = explode('-', $month);
        $bulanLabel = $bulanIndo[(int) $monthNum] . ' ' . $year;

        $generatedAt = Carbon::now()->translatedFormat('d F Y H:i');

        $pdf = Pdf::loadView('reports.family-analysis-pdf', [
            'summary' => $summary,
            'allocation' => $allocation,
            'topExpense' => $topExpense,
            'smartRecommendation' => $smartRecommendation,
            'narrativeParagraphs' => $narrativeParagraphs,
            'parentName' => $parent->username,
            'bulanLabel' => $bulanLabel,
            'generatedAt' => $generatedAt,
        ])->setPaper('a4', 'portrait');

        $filename = 'Laporan-Keluarga-' . $month . '.pdf';

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->output();
        }, $filename, ['Content-Type' => 'application/pdf']);
    }

    private function flattenTipsToParagraphs(array $tips): array
    {
        if (empty($tips)) {
            return [];
        }

        $paragraphs = [];

        $budget = $tips['budget_tips'] ?? [];
        if (!empty($budget)) {
            $lines = array_map(function ($tip) {
                $title = $tip['title'] ?? 'Tips';
                $msg = $tip['message'] ?? '';
                return '• ' . $title . ' — ' . $msg;
            }, $budget);
            $paragraphs[] = 'Tips Anggaran: ' . implode(' | ', $lines);
        }

        $category = $tips['category_tips'] ?? [];
        if (!empty($category)) {
            $lines = array_map(function ($tip) {
                $title = $tip['title'] ?? 'Tips';
                $msg = $tip['message'] ?? '';
                return '• ' . $title . ' — ' . $msg;
            }, $category);
            $paragraphs[] = 'Tips per Kategori: ' . implode(' | ', $lines);
        }

        $saving = $tips['saving_tips'] ?? [];
        if (!empty($saving)) {
            $lines = array_map(function ($tip) {
                $title = $tip['title'] ?? 'Tips';
                $msg = $tip['message'] ?? '';
                return '• ' . $title . ' — ' . $msg;
            }, $saving);
            $paragraphs[] = 'Tips Menabung: ' . implode(' | ', $lines);
        }

        $warnings = $tips['warnings'] ?? [];
        if (!empty($warnings)) {
            $lines = array_map(function ($tip) {
                $title = $tip['title'] ?? 'Peringatan';
                $msg = $tip['message'] ?? '';
                return '• ' . $title . ' — ' . $msg;
            }, $warnings);
            $paragraphs[] = 'Peringatan: ' . implode(' | ', $lines);
        }

        return $paragraphs;
    }
}
