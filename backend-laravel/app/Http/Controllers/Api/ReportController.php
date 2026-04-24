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
            ->where('tanggal', 'like', $month.'%');

        $income = (float) (clone $base)->where('jenis', 'pemasukan')->sum('jumlah');
        $expense = (float) (clone $base)->where('jenis', 'pengeluaran')->sum('jumlah');
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
            ->where('tanggal', 'like', $month.'%');

        $income = (float) (clone $txBase)->where('jenis', 'pemasukan')->sum('jumlah');
        $expense = (float) (clone $txBase)->where('jenis', 'pengeluaran')->sum('jumlah');
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
        $summaryData = $this->buildUserSummary($userId, $month);

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
        $rows = Transaction::where('user_id', $userId)->orderByDesc('created_at')->limit(50)->get();
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

            if ($t->jenis === 'menabung') {
                $categoryName = 'Menabung';
                $categoryIcon = 'PiggyBank';
            } else if ($t->jenis === 'refund') {
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
                    'jenis' => 'pengeluaran',
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
        $grouped = [];
        foreach (Transaction::where('user_id', (string) $request->user()->id)->get() as $t) {
            $m = substr((string) $t->tanggal, 0, 7);
            if (! isset($grouped[$m])) {
                $grouped[$m] = ['month' => $m, 'pemasukan' => 0, 'pengeluaran' => 0];
            }
            if ($t->jenis === 'pemasukan') {
                $grouped[$m]['pemasukan'] += (float) $t->jumlah;
            } else if ($t->jenis === 'pengeluaran') {
                $grouped[$m]['pengeluaran'] += (float) $t->jumlah;
            }
        }
        $data = array_values($grouped);

        return response()->json(['message' => 'OK', 'data' => $data]);
    }

    public function analysis(Request $request)
    {
        $userId = (string) $request->user()->id;
        $month = (string) $request->query('month', now()->format('Y-m'));
        $summary = $this->buildUserSummary($userId, $month);
        $expenseByCategory = Transaction::query()
            ->where('user_id', $userId)
            ->where('jenis', 'pengeluaran')
            ->where('tanggal', 'like', $month.'%')
            ->get()
            ->groupBy('category_id')
            ->map(fn ($items) => (float) $items->sum('jumlah'));

        $topExpense = null;
        if ($expenseByCategory->isNotEmpty()) {
            $topCategoryId = $expenseByCategory->sortDesc()->keys()->first();
            $topAmount = (float) $expenseByCategory->max();
            $category = $topCategoryId ? Category::find($topCategoryId) : null;
            $topExpense = (object) [
                'categoryId' => $topCategoryId ? (string) $topCategoryId : null,
                'namaKategori' => $category?->nama_kategori ?? 'Lainnya',
                'jumlah' => $topAmount,
            ];
        }
        $categoryBreakdown = $expenseByCategory->sortDesc()->map(function (float $amount, $categoryId) use ($summary) {
            $category = $categoryId ? Category::find($categoryId) : null;

            return [
                'categoryId' => $categoryId ? (string) $categoryId : null,
                'namaKategori' => $category?->nama_kategori ?? 'Lainnya',
                'jumlah' => $amount,
                'persentase' => $summary['totalPengeluaran'] > 0 ? round(($amount / (float) $summary['totalPengeluaran']) * 100, 2) : 0,
            ];
        })->values();

        $chart = $this->historical($request)->getData(true)['data'];
        $smartRecommendation = $summary['totalPengeluaran'] > $summary['totalPemasukan']
            ? 'Pengeluaran melebihi pemasukan. Terapkan batas kategori harian.'
            : 'Kondisi arus kas sehat. Alokasikan minimal 20% ke tabungan/investasi.';
        $income = (float) $summary['totalPemasukan'];
        $need = round($income * 0.5, 0);
        $want = round($income * 0.3, 0);
        $save = round($income * 0.2, 0);
        $recommendation = [
            'namaMetode' => 'Metode 50/30/20',
            'deskripsiMetode' => 'Bagi pemasukan: 50% kebutuhan, 30% keinginan, 20% tabungan/investasi.',
            'detailRekomendasi' => 'Dari pemasukan '.number_format($income, 0, ',', '.').', rekomendasi alokasi: kebutuhan '.number_format($need, 0, ',', '.').', keinginan '.number_format($want, 0, ',', '.').', tabungan/investasi '.number_format($save, 0, ',', '.').'.',
            'langkah_implementasi' => 'Catat semua pemasukan & pengeluaran|Kelompokkan pengeluaran menjadi kebutuhan vs keinginan|Tetapkan batas pengeluaran per kategori|Sisihkan 20% di awal bulan untuk tabungan/target|Evaluasi akhir periode dan sesuaikan batas',
        ];
        SmartInsight::create([
            'user_id' => $request->user()->id,
            'month' => $request->query('month', now()->format('Y-m')),
            'insight' => 'Analisis 50/30/20 otomatis.',
            'recommendation' => $smartRecommendation,
            'score' => $summary['neto'] >= 0 ? 80 : 55,
            'created_at' => now(),
        ]);

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
            'spendingByCategory' => $categoryBreakdown,
            'recommendation' => $recommendation,
        ]]);
    }

    public function familySummary(Request $request)
    {
        $parent = $request->user();
        if ($parent->role !== 'parent') {
            return response()->json(['message' => 'Hanya akun parent yang dapat melihat laporan keluarga.'], 403);
        }

        $month = (string) $request->query('month', now()->format('Y-m'));
        $data = $this->buildFamilySummary((string) $parent->id, $month);

        return response()->json(['message' => 'OK', 'data' => $data]);
    }

    public function familyHistorical(Request $request)
    {
        $parent = $request->user();
        if ($parent->role !== 'parent') {
            return response()->json(['message' => 'Hanya akun parent yang dapat melihat laporan keluarga.'], 403);
        }

        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parent->id)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();

        $grouped = [];
        foreach (Transaction::query()->whereIn('user_id', $childIds->all())->get() as $t) {
            $m = substr((string) $t->tanggal, 0, 7);
            if (! isset($grouped[$m])) {
                $grouped[$m] = ['month' => $m, 'pemasukan' => 0, 'pengeluaran' => 0];
            }
            if ($t->jenis === 'pemasukan') {
                $grouped[$m]['pemasukan'] += (float) $t->jumlah;
            } else if ($t->jenis === 'pengeluaran') {
                $grouped[$m]['pengeluaran'] += (float) $t->jumlah;
            }
        }

        return response()->json(['message' => 'OK', 'data' => array_values($grouped)]);
    }

    public function familyHistory(Request $request)
    {
        $parent = $request->user();
        if ($parent->role !== 'parent') {
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

            if ($t->jenis === 'menabung') {
                $categoryName = 'Menabung';
                $categoryIcon = 'PiggyBank';
            } else if ($t->jenis === 'refund') {
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
                    'jenis' => 'pengeluaran',
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
        if ($parent->role !== 'parent') {
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
            ->where('jenis', 'pengeluaran')
            ->where('tanggal', 'like', $month.'%')
            ->get()
            ->groupBy('category_id')
            ->map(fn ($items) => (float) $items->sum('jumlah'));

        $topExpense = null;
        if ($expenseByCategory->isNotEmpty()) {
            $topCategoryId = $expenseByCategory->sortDesc()->keys()->first();
            $topAmount = (float) $expenseByCategory->max();
            $category = $topCategoryId ? Category::find($topCategoryId) : null;
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
