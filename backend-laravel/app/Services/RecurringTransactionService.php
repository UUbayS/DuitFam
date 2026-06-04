<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Mongo\NotificationFeed;
use App\Models\RecurringTransaction;
use App\Models\SavingGoal;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Traits\HasSafeMongoTransaction;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RecurringTransactionService
{
    use HasSafeMongoTransaction;

    public function __construct(
        private readonly BudgetAlertService $budgetAlertService,
    ) {}

    /**
     * Generate transactions for a single recurring up to today.
     * Returns array of created transactions.
     */
    public function generateForRecurring(RecurringTransaction $r, bool $autoCreate = false): array
    {
        if (! $r->is_active) {
            return [];
        }

        $today = Carbon::today();
        $endDate = $r->end_date ? Carbon::parse($r->end_date) : $today;
        if ($endDate->lt($today)) {
            $r->is_active = false;
            $r->save();
            return [];
        }

        $startDate = Carbon::parse($r->start_date);
        $cursor = $r->last_generated_date
            ? Carbon::parse($r->last_generated_date)->copy()->addDay()
            : $startDate->copy();

        if ($cursor->lt($startDate)) {
            $cursor = $startDate->copy();
        }

        $dueDates = $this->computeDueDates($r, $cursor, $today);
        if (empty($dueDates)) {
            return [];
        }

        $user = User::where('_id', (string) $r->user_id)->first();
        if (! $user) {
            Log::warning('Recurring skipped, user not found', ['recurring_id' => (string) $r->id]);
            return [];
        }

        $created = [];
        $latestDate = $r->last_generated_date ? Carbon::parse($r->last_generated_date) : null;

        try {
            $this->safeMongoTransaction(function () use ($r, $user, $dueDates, &$created, &$latestDate) {
                foreach ($dueDates as $date) {
                    $tx = $this->createSingleTransaction($user, $r, $date);
                    if ($tx) {
                        $created[] = $tx;
                        if (! $latestDate || $date->gt($latestDate)) {
                            $latestDate = $date->copy();
                        }
                    }
                }
                if ($latestDate) {
                    $r->last_generated_date = $latestDate->toDateString();
                    $r->save();
                }
            });
        } catch (\Throwable $e) {
            Log::error('Recurring generation failed', [
                'recurring_id' => (string) $r->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }

        if (! empty($created)) {
            $count = count($created);
            $kategoriName = $this->resolveCategoryName($r);
            NotificationFeed::create([
                'user_id' => (string) $r->user_id,
                'title' => $autoCreate ? 'Transaksi berulang otomatis' : 'Transaksi berulang dicatat',
                'message' => "{$count} transaksi {$r->jenis} '{$kategoriName}' sebesar Rp " . number_format((float) $r->jumlah, 0, ',', '.') . " telah dicatat.",
                'read_at' => null,
                'meta' => [
                    'type' => 'recurring_generated',
                    'recurring_id' => (string) $r->id,
                    'count' => $count,
                ],
            ]);
        }

        return $created;
    }

    /**
     * Generate for all active recurring owned by user.
     * Returns summary: { generated: int, by_recurring: [...] }
     */
    public function generateAllActive(User $user, bool $autoCreate = false): array
    {
        $recurring = RecurringTransaction::query()
            ->where('user_id', (string) $user->id)
            ->where('is_active', true)
            ->get();

        $total = 0;
        $perRecurring = [];

        foreach ($recurring as $r) {
            try {
                $created = $this->generateForRecurring($r, $autoCreate);
                $count = count($created);
                $total += $count;
                $perRecurring[] = [
                    'recurring_id' => (string) $r->id,
                    'keterangan' => $r->keterangan,
                    'generated' => $count,
                ];
            } catch (\Throwable $e) {
                $perRecurring[] = [
                    'recurring_id' => (string) $r->id,
                    'keterangan' => $r->keterangan,
                    'generated' => 0,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return [
            'total' => $total,
            'by_recurring' => $perRecurring,
        ];
    }

    /**
     * Compute due dates between cursor and today for this recurring.
     */
    protected function computeDueDates(RecurringTransaction $r, Carbon $cursor, Carbon $today): array
    {
        $dates = [];
        $max = $today->copy();

        if ($r->frequency === 'daily') {
            $d = $cursor->copy();
            while ($d->lte($max)) {
                $dates[] = $d->copy();
                $d->addDay();
            }
        } elseif ($r->frequency === 'weekly') {
            $targetDow = (int) $r->day_of_week;
            $d = $cursor->copy();
            while ($d->lte($max)) {
                if ((int) $d->dayOfWeekIso === $targetDow) {
                    $dates[] = $d->copy();
                }
                $d->addDay();
            }
        } elseif ($r->frequency === 'monthly') {
            $targetDom = (int) $r->day_of_month;
            $d = $cursor->copy()->startOfMonth();
            while ($d->lte($max)) {
                $dom = min($targetDom, $d->daysInMonth);
                $candidate = $d->copy()->day($dom);
                if ($candidate->gte($cursor) && $candidate->lte($max)) {
                    $dates[] = $candidate->copy();
                }
                $d->addMonth()->startOfMonth();
            }
        }

        return $dates;
    }

    /**
     * Create a single transaction from recurring data.
     * Reuses balance logic similar to TransactionController::store.
     */
    protected function createSingleTransaction(User $user, RecurringTransaction $r, Carbon $date): ?Transaction
    {
        $jenis = (string) $r->jenis;
        $amount = (float) $r->jumlah;
        $categoryId = (string) $r->category_id;

        if ($amount <= 0) {
            return null;
        }

        if ($jenis === config('constants.transaction_types.pengeluaran')) {
            $wallet = Wallet::where('user_id', (string) $user->id)->first();
            if (! $wallet || (float) $wallet->saldo_sekarang < $amount) {
                Log::warning('Recurring skipped, insufficient balance', [
                    'recurring_id' => (string) $r->id,
                    'user_id' => (string) $user->id,
                    'amount' => $amount,
                ]);
                return null;
            }
            $wallet->saldo_sekarang = ((float) $wallet->saldo_sekarang) - $amount;
            $wallet->save();
        } else {
            $wallet = Wallet::where('user_id', (string) $user->id)->first();
            if (! $wallet) {
                $wallet = Wallet::create(['user_id' => (string) $user->id, 'saldo_sekarang' => 0]);
            }
            $wallet->saldo_sekarang = ((float) $wallet->saldo_sekarang) + $amount;
            $wallet->save();
        }

        $baseKeterangan = (string) ($r->keterangan ?: '');
        $keterangan = '[Recurring] ' . $baseKeterangan;

        $tx = Transaction::create([
            'user_id' => (string) $user->id,
            'category_id' => $categoryId,
            'jenis' => $jenis,
            'status' => config('constants.transaction_status.berhasil'),
            'jumlah' => $amount,
            'tanggal' => $date->toDateString(),
            'keterangan' => $keterangan,
            'is_recurring' => true,
        ]);

        $this->budgetAlertService->check(
            (string) $user->id,
            $categoryId,
            $date->format('Y-m'),
        );

        return $tx;
    }

    protected function resolveCategoryName(RecurringTransaction $r): string
    {
        if (! $r->category_id) {
            return 'Tanpa Kategori';
        }
        $cat = Category::where('_id', (string) $r->category_id)->first();
        return $cat?->nama_kategori ?? 'Lainnya';
    }
}
