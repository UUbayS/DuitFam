<?php

namespace App\Services;

use App\Models\Budget;
use App\Models\Mongo\NotificationFeed;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class BudgetAlertService
{
    /**
     * Cek threshold anggaran & kirim notifikasi (jika perlu).
     * Dipanggil setelah create transaction.
     */
    public function check(string $userId, string $categoryId, string $periodeBulan): void
    {
        try {
            $budget = Budget::query()
                ->where('user_id', $userId)
                ->where('category_id', $categoryId)
                ->where('periode_bulan', $periodeBulan)
                ->first();

            if (! $budget) {
                return;
            }

            $limit = (float) $budget->jumlah;
            if ($limit <= 0) {
                return;
            }

            $used = (float) Transaction::query()
                ->where('user_id', $userId)
                ->where('category_id', $categoryId)
                ->where('jenis', config('constants.transaction_types.pengeluaran'))
                ->where('status', config('constants.transaction_status.berhasil'))
                ->where('tanggal', 'like', $periodeBulan . '%')
                ->sum('jumlah');

            $ratio = $used / $limit;
            $alertType = null;
            if ($ratio >= 1.0) {
                $alertType = 'budget_exceeded';
            } elseif ($ratio >= 0.8) {
                $alertType = 'budget_warning';
            }

            if (! $alertType) {
                return;
            }

            $alertKey = "{$alertType}:{$periodeBulan}:{$userId}:{$categoryId}";

            $exists = NotificationFeed::query()
                ->where('user_id', $userId)
                ->where('meta.alert_key', $alertKey)
                ->exists();
            if ($exists) {
                return;
            }

            $category = \App\Models\Category::where('_id', $categoryId)->first();
            $categoryName = $category?->nama_kategori ?? 'Lainnya';
            $percent = round($ratio * 100, 0);

            if ($alertType === 'budget_exceeded') {
                $title = 'Anggaran Terlampaui';
                $message = "Pengeluaran kategori {$categoryName} bulan ini mencapai Rp " . number_format($used, 0, ',', '.')
                    . " ({$percent}% dari anggaran Rp " . number_format($limit, 0, ',', '.') . ").";
            } else {
                $title = 'Peringatan Anggaran';
                $message = "Pengeluaran kategori {$categoryName} sudah {$percent}% dari anggaran bulan ini "
                    . "(Rp " . number_format($used, 0, ',', '.') . " / Rp " . number_format($limit, 0, ',', '.') . ").";
            }

            NotificationFeed::create([
                'user_id' => $userId,
                'title' => $title,
                'message' => $message,
                'read_at' => null,
                'meta' => [
                    'type' => $alertType,
                    'alert_key' => $alertKey,
                    'category_id' => $categoryId,
                    'periode_bulan' => $periodeBulan,
                    'used' => $used,
                    'limit' => $limit,
                    'percent' => $percent,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('BudgetAlertService failed', ['error' => $e->getMessage()]);
        }
    }
}
