<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBudgetRequest;
use App\Models\Budget;
use App\Models\Category;
use App\Models\ParentChildRelation;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class BudgetController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $periode = $request->input('periode_bulan') ?: now()->format('Y-m');

        $allowedUserIds = $this->getAllowedUserIds($user);

        $budgets = Budget::query()
            ->whereIn('user_id', $allowedUserIds)
            ->where('periode_bulan', $periode)
            ->get();

        $categoryIds = $budgets->pluck('category_id')->filter()->unique()->map(fn($id) => (string) $id)->all();
        $userIds = $budgets->pluck('user_id')->unique()->map(fn($id) => (string) $id)->all();

        $categories = Category::whereIn('_id', $categoryIds)->get()->keyBy(fn($c) => (string) $c->id)->all();
        $users = User::whereIn('_id', $userIds)->get()->keyBy(fn($u) => (string) $u->id)->all();

        $data = $budgets->map(function ($b) use ($categories, $users, $periode) {
            $used = (float) Transaction::query()
                ->where('user_id', (string) $b->user_id)
                ->where('category_id', (string) $b->category_id)
                ->where('jenis', config('constants.transaction_types.pengeluaran'))
                ->where('status', config('constants.transaction_status.berhasil'))
                ->where('tanggal', 'like', $periode . '%')
                ->sum('jumlah');

            $limit = (float) $b->jumlah;
            $persentase = $limit > 0 ? round(($used / $limit) * 100, 1) : 0;
            $status = 'safe';
            if ($persentase >= 100) $status = 'over';
            elseif ($persentase >= 80) $status = 'warning';

            $cat = $categories[(string) $b->category_id] ?? null;
            $usr = $users[(string) $b->user_id] ?? null;

            return [
                'id' => (string) $b->id,
                'user_id' => (string) $b->user_id,
                'username' => $usr?->username ?? '-',
                'category_id' => (string) $b->category_id,
                'nama_kategori' => $cat?->nama_kategori ?? 'Lainnya',
                'icon_kategori' => $cat?->icon ?? 'Tag',
                'jumlah' => $limit,
                'used' => $used,
                'remaining' => max(0, $limit - $used),
                'persentase' => $persentase,
                'status' => $status,
                'periode_bulan' => $b->periode_bulan,
            ];
        })->values()->all();

        return response()->json([
            'message' => 'Berhasil mengambil data anggaran.',
            'data' => $data,
        ]);
    }

    public function store(StoreBudgetRequest $request)
    {
        $data = $request->validated();
        $userId = (string) $data['user_id'];
        $categoryId = (string) $data['category_id'];
        $periode = $data['periode_bulan'];

        $existing = Budget::query()
            ->where('user_id', $userId)
            ->where('category_id', $categoryId)
            ->where('periode_bulan', $periode)
            ->first();

        if ($existing) {
            $existing->jumlah = (float) $data['jumlah'];
            $existing->save();
            $budget = $existing;
            $message = 'Anggaran berhasil diperbarui.';
        } else {
            $budget = Budget::create([
                'user_id' => $userId,
                'category_id' => $categoryId,
                'jumlah' => (float) $data['jumlah'],
                'periode_bulan' => $periode,
            ]);
            $message = 'Anggaran berhasil ditambahkan.';
        }

        return response()->json([
            'message' => $message,
            'data' => [
                'id' => (string) $budget->id,
                'user_id' => (string) $budget->user_id,
                'category_id' => (string) $budget->category_id,
                'jumlah' => (float) $budget->jumlah,
                'periode_bulan' => $budget->periode_bulan,
            ],
        ], 201);
    }

    public function update(StoreBudgetRequest $request, string $id)
    {
        $user = $request->user();
        $budget = Budget::where('_id', $id)->firstOrFail();
        $allowed = $this->getAllowedUserIds($user);

        if (! in_array((string) $budget->user_id, $allowed, true)) {
            return response()->json(['message' => 'Tidak punya akses.'], 403);
        }

        $data = $request->validated();
        $budget->jumlah = (float) $data['jumlah'];
        $budget->save();

        return response()->json(['message' => 'Anggaran berhasil diperbarui.']);
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();
        $budget = Budget::where('_id', $id)->firstOrFail();
        $allowed = $this->getAllowedUserIds($user);

        if (! in_array((string) $budget->user_id, $allowed, true)) {
            return response()->json(['message' => 'Tidak punya akses.'], 403);
        }

        $budget->delete();
        return response()->json(['message' => 'Anggaran berhasil dihapus.']);
    }

    public function summary(Request $request)
    {
        $user = $request->user();
        $periode = $request->input('periode_bulan') ?: now()->format('Y-m');
        $allowed = $this->getAllowedUserIds($user);

        $budgets = Budget::query()
            ->whereIn('user_id', $allowed)
            ->where('periode_bulan', $periode)
            ->get();
        $budgetByKey = $budgets->keyBy(fn($b) => (string) $b->user_id . ':' . (string) $b->category_id);

        $expenses = Transaction::query()
            ->whereIn('user_id', $allowed)
            ->where('jenis', config('constants.transaction_types.pengeluaran'))
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', 'like', $periode . '%')
            ->get();

        $aggregated = $expenses->groupBy(fn($tx) => (string) $tx->user_id . ':' . (string) $tx->category_id)
            ->map(fn($items, $key) => [
                'user_id' => (string) $items->first()->user_id,
                'category_id' => (string) $items->first()->category_id,
                'used' => (float) $items->sum('jumlah'),
            ])->values();

        $categoryIds = $aggregated->pluck('category_id')->unique()->map(fn($id) => (string) $id)->all();
        $userIds = $aggregated->pluck('user_id')->unique()->map(fn($id) => (string) $id)->all();
        $categories = Category::whereIn('_id', $categoryIds)->get()->keyBy(fn($c) => (string) $c->id)->all();
        $users = User::whereIn('_id', $userIds)->get()->keyBy(fn($u) => (string) $u->id)->all();

        $data = $aggregated->map(function ($row) use ($budgetByKey, $categories, $users) {
            $key = $row['user_id'] . ':' . $row['category_id'];
            $budget = $budgetByKey[$key] ?? null;
            $limit = $budget ? (float) $budget->jumlah : 0;
            $persentase = $limit > 0 ? round(($row['used'] / $limit) * 100, 1) : 0;
            $status = $limit > 0 ? (($persentase >= 100) ? 'over' : (($persentase >= 80) ? 'warning' : 'safe')) : 'no_budget';

            $cat = $categories[$row['category_id']] ?? null;
            $usr = $users[$row['user_id']] ?? null;

            return [
                'user_id' => $row['user_id'],
                'username' => $usr?->username ?? '-',
                'category_id' => $row['category_id'],
                'nama_kategori' => $cat?->nama_kategori ?? 'Lainnya',
                'icon_kategori' => $cat?->icon ?? 'Tag',
                'used' => $row['used'],
                'limit' => $limit,
                'remaining' => max(0, $limit - $row['used']),
                'persentase' => $persentase,
                'status' => $status,
            ];
        })->values()->all();

        return response()->json([
            'message' => 'Berhasil mengambil ringkasan anggaran.',
            'data' => $data,
        ]);
    }

    protected function getAllowedUserIds($user): array
    {
        $ids = [(string) $user->id];
        if ($user->role === config('constants.roles.parent')) {
            $childIds = ParentChildRelation::query()
                ->where('parent_id', (string) $user->id)
                ->where('is_active', true)
                ->pluck('child_id')
                ->map(fn($id) => (string) $id)
                ->all();
            $ids = array_merge($ids, $childIds);
        }
        return $ids;
    }
}
