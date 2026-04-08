<?php

namespace Tests;

use App\Models\Category;
use App\Models\GoalContribution;
use App\Models\Mongo\ActivityLog;
use App\Models\Mongo\AnalyticsSnapshot;
use App\Models\Mongo\NotificationFeed;
use App\Models\Mongo\SmartInsight;
use App\Models\ParentChildRelation;
use App\Models\Role;
use App\Models\SavingGoal;
use App\Models\Transaction;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            ActivityLog::class,
            AnalyticsSnapshot::class,
            NotificationFeed::class,
            SmartInsight::class,
            Category::class,
            GoalContribution::class,
            ParentChildRelation::class,
            Role::class,
            SavingGoal::class,
            Transaction::class,
            User::class,
            UserNotification::class,
            Wallet::class,
            WithdrawalRequest::class,
        ] as $modelClass) {
            $modelClass::query()->delete();
        }
    }
}
