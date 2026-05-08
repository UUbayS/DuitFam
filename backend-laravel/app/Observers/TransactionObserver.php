<?php

namespace App\Observers;

use App\Models\Transaction;
use App\Services\FinancialEventService;
use Illuminate\Support\Facades\Log;

class TransactionObserver
{
    /**
     * Handle the Transaction "created" event.
     */
    public function created(Transaction $transaction): void
    {
        $this->invalidateUserCache($transaction);
    }

    /**
     * Handle the Transaction "updated" event.
     */
    public function updated(Transaction $transaction): void
    {
        // Only invalidate if status changed to 'berhasil' or amount/category changed
        if ($transaction->isDirty(['status', 'jumlah', 'category_id', 'jenis'])) {
            $this->invalidateUserCache($transaction);
        }
    }

    /**
     * Handle the Transaction "deleted" event.
     */
    public function deleted(Transaction $transaction): void
    {
        $this->invalidateUserCache($transaction);
    }

    /**
     * Invalidate cache for the transaction owner
     */
    protected function invalidateUserCache(Transaction $transaction): void
    {
        try {
            $userId = (string) $transaction->user_id;
            FinancialEventService::invalidateUserTips($userId);
        } catch (\Exception $e) {
            Log::error("TransactionObserver error: " . $e->getMessage());
        }
    }
}
