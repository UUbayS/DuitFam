<?php

namespace App\Services;

use App\Models\Mongo\SmartInsight;
use App\Models\Transaction;
use App\Models\Wallet;
use Illuminate\Support\Facades\Log;

class FinancialEventService
{
    /**
     * Invalidate spending tips cache for a user
     */
    public static function invalidateUserTips(string $userId): void
    {
        try {
            SmartInsight::invalidateForUser($userId);
            Log::info("Spending tips cache invalidated for user: {$userId}");
        } catch (\Exception $e) {
            Log::error("Failed to invalidate tips cache for user {$userId}: " . $e->getMessage());
        }
    }

    /**
     * Handle deposit event - invalidates both parent and child cache
     */
    public static function handleDeposit(string $parentId, string $childId): void
    {
        self::invalidateUserTips($parentId);
        self::invalidateUserTips($childId);
    }

    /**
     * Handle withdrawal approval - invalidates both parent and child cache
     */
    public static function handleWithdrawalApproval(string $parentId, string $childId): void
    {
        self::invalidateUserTips($parentId);
        self::invalidateUserTips($childId);
    }
}
