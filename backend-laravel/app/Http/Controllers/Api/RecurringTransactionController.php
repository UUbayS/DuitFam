<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRecurringRequest;
use App\Models\Category;
use App\Models\RecurringTransaction;
use App\Services\RecurringTransactionService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class RecurringTransactionController extends Controller
{
    public function __construct(
        private readonly RecurringTransactionService $service,
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $items = RecurringTransaction::query()
            ->where('user_id', (string) $user->id)
            ->orderByDesc('created_at')
            ->get();

        $categoryIds = $items->pluck('category_id')->filter()->unique()->map(fn($id) => (string) $id)->all();
        $categories = Category::whereIn('_id', $categoryIds)->get()->keyBy(fn($c) => (string) $c->id)->all();

        $data = $items->map(function ($r) use ($categories) {
            $cat = $categories[(string) $r->category_id] ?? null;
            return [
                'id' => (string) $r->id,
                'user_id' => (string) $r->user_id,
                'category_id' => (string) $r->category_id,
                'nama_kategori' => $cat?->nama_kategori ?? 'Lainnya',
                'icon_kategori' => $cat?->icon ?? 'Tag',
                'jenis' => $r->jenis,
                'jumlah' => (float) $r->jumlah,
                'keterangan' => $r->keterangan,
                'frequency' => $r->frequency,
                'day_of_week' => $r->day_of_week,
                'day_of_month' => $r->day_of_month,
                'start_date' => $r->start_date,
                'end_date' => $r->end_date,
                'last_generated_date' => $r->last_generated_date,
                'is_active' => (bool) $r->is_active,
                'next_due_date' => $this->computeNextDue($r),
            ];
        })->values()->all();

        return response()->json([
            'message' => 'Berhasil mengambil daftar transaksi berulang.',
            'data' => $data,
        ]);
    }

    public function store(StoreRecurringRequest $request)
    {
        $user = $request->user();
        $data = $request->validated();

        $r = RecurringTransaction::create([
            'user_id' => (string) $user->id,
            'category_id' => (string) $data['category_id'],
            'jenis' => (string) $data['jenis'],
            'jumlah' => (float) $data['jumlah'],
            'keterangan' => $data['keterangan'] ?? null,
            'frequency' => (string) $data['frequency'],
            'day_of_week' => $data['day_of_week'] ?? null,
            'day_of_month' => $data['day_of_month'] ?? null,
            'start_date' => (string) $data['start_date'],
            'end_date' => $data['end_date'] ?? null,
            'last_generated_date' => null,
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Transaksi berulang berhasil ditambahkan.',
            'data' => ['id' => (string) $r->id],
        ], 201);
    }

    public function update(StoreRecurringRequest $request, string $id)
    {
        $user = $request->user();
        $r = RecurringTransaction::where('_id', $id)->firstOrFail();

        if ((string) $r->user_id !== (string) $user->id) {
            return response()->json(['message' => 'Tidak punya akses.'], 403);
        }

        $data = $request->validated();
        $r->category_id = (string) $data['category_id'];
        $r->jenis = (string) $data['jenis'];
        $r->jumlah = (float) $data['jumlah'];
        $r->keterangan = $data['keterangan'] ?? null;
        $r->frequency = (string) $data['frequency'];
        $r->day_of_week = $data['day_of_week'] ?? null;
        $r->day_of_month = $data['day_of_month'] ?? null;
        $r->start_date = (string) $data['start_date'];
        $r->end_date = $data['end_date'] ?? null;
        $r->save();

        return response()->json(['message' => 'Transaksi berulang berhasil diperbarui.']);
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();
        $r = RecurringTransaction::where('_id', $id)->firstOrFail();
        if ((string) $r->user_id !== (string) $user->id) {
            return response()->json(['message' => 'Tidak punya akses.'], 403);
        }
        $r->delete();
        return response()->json(['message' => 'Transaksi berulang berhasil dihapus.']);
    }

    public function generate(Request $request, string $id)
    {
        $user = $request->user();
        $r = RecurringTransaction::where('_id', $id)->firstOrFail();
        if ((string) $r->user_id !== (string) $user->id) {
            return response()->json(['message' => 'Tidak punya akses.'], 403);
        }
        try {
            $created = $this->service->generateForRecurring($r, autoCreate: false);
            return response()->json([
                'message' => count($created) . ' transaksi berhasil dicatat.',
                'generated' => count($created),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Generate gagal: ' . $e->getMessage(),
            ], 422);
        }
    }

    public function generateAll(Request $request)
    {
        $user = $request->user();
        try {
            $result = $this->service->generateAllActive($user, autoCreate: false);
            return response()->json([
                'message' => $result['total'] . ' transaksi berulang dicatat.',
                'total' => $result['total'],
                'by_recurring' => $result['by_recurring'],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Generate semua gagal: ' . $e->getMessage(),
            ], 422);
        }
    }

    protected function computeNextDue(RecurringTransaction $r): ?string
    {
        if (! $r->is_active) return null;
        $today = Carbon::today();
        $start = Carbon::parse($r->start_date);
        $last = $r->last_generated_date ? Carbon::parse($r->last_generated_date) : $start->copy()->subDay();
        $cursor = $last->copy()->addDay();
        if ($cursor->lt($start)) $cursor = $start->copy();

        for ($i = 0; $i < 366; $i++) {
            if ($r->frequency === 'daily') {
                if ($cursor->gte($start)) return $cursor->toDateString();
                $cursor->addDay();
            } elseif ($r->frequency === 'weekly') {
                if ((int) $cursor->dayOfWeekIso === (int) $r->day_of_week && $cursor->gte($start)) {
                    return $cursor->toDateString();
                }
                $cursor->addDay();
            } elseif ($r->frequency === 'monthly') {
                $dom = min((int) $r->day_of_month, $cursor->daysInMonth);
                $candidate = $cursor->copy()->startOfMonth()->day($dom);
                if ($candidate->gte($cursor) && $candidate->gte($start)) {
                    return $candidate->toDateString();
                }
                $cursor->addMonth()->startOfMonth();
            } else {
                return null;
            }
            if ($cursor->gt($today->copy()->addYear())) return null;
        }
        return null;
    }
}
