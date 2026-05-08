<?php

namespace App\Observers;

use App\Models\WithdrawalRequest;
use App\Services\FinancialEventService;
use Illuminate\Support\Facades\Log;

class WithdrawalRequestObserver
{
    /**
     * Handle the WithdrawalRequest "updated" event.
     */
    public function updated(WithdrawalRequest $withdrawalRequest): void
    {
        // Only invalidate if status changed to 'approved' (not rejected)
        if ($withdrawalRequest->isDirty('status') && 
            $withdrawalRequest->status === config('constants.transaction_status.approved')) {
            $this->invalidateRelatedCache($withdrawalRequest);
        }
    }

    /**
     * Invalidate cache for both parent and child
     */
    protected function invalidateRelatedCache(WithdrawalRequest $withdrawalRequest): void
    {
        try {
            $parentId = (string) $withdrawalRequest->parent_id;
            $childId = (string) $withdrawalRequest->child_id;
            
            FinancialEventService::handleWithdrawalApproval($parentId, $childId);
        } catch (\Exception $e) {
            Log::error("WithdrawalRequestObserver error: " . $e->getMessage());
        }
    }
}
