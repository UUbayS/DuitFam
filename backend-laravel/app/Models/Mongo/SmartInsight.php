<?php

namespace App\Models\Mongo;

use MongoDB\Laravel\Eloquent\Model;
use Carbon\Carbon;

class SmartInsight extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'smart_insights';

    protected $fillable = [
        'user_id', 'month', 'insight', 'recommendation', 'score',
        'tips', 'financial_snapshot', 'expires_at', 'is_valid', 'created_at'
    ];

    protected $casts = [
        'tips' => 'array',
        'financial_snapshot' => 'array',
        'expires_at' => 'datetime',
        'is_valid' => 'boolean',
        'created_at' => 'datetime'
    ];

    public $timestamps = false;

    /**
     * Get valid insight for user if exists and not expired
     */
    public static function getValidInsight($userId)
    {
        return self::where('user_id', $userId)
            ->where('is_valid', true)
            ->where('expires_at', '>', Carbon::now())
            ->orderBy('created_at', 'desc')
            ->first();
    }

    /**
     * Invalidate all insights for a user
     */
    public static function invalidateForUser($userId): void
    {
        self::where('user_id', $userId)
            ->where('is_valid', true)
            ->update(['is_valid' => false]);
    }

    /**
     * Store new tips for user
     */
    public static function storeTips($userId, array $tips, array $snapshot, int $daysValid = 30): self
    {
        // Invalidate existing first
        self::invalidateForUser($userId);
        
        return self::create([
            'user_id' => $userId,
            'month' => Carbon::now()->format('Y-m'),
            'tips' => $tips,
            'financial_snapshot' => $snapshot,
            'expires_at' => Carbon::now()->addDays($daysValid),
            'is_valid' => true,
            'created_at' => Carbon::now(),
        ]);
    }
}
