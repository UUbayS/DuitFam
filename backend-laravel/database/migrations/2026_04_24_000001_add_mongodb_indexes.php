<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use MongoDB\Driver\Exception\CommandException;

return new class extends Migration
{
    public function up()
    {
        $mongodb = DB::connection('mongodb');

        $indexes = [
            'users' => [
                ['key' => ['username' => 1], 'options' => ['unique' => true, 'name' => 'idx_users_username']],
                ['key' => ['email' => 1], 'options' => ['unique' => true, 'name' => 'idx_users_email']],
                ['key' => ['api_token' => 1], 'options' => ['unique' => true, 'sparse' => true, 'name' => 'idx_users_api_token']],
            ],
            'transactions' => [
                ['key' => ['user_id' => 1, 'tanggal' => -1], 'options' => ['name' => 'idx_transactions_user_date']],
                ['key' => ['category_id' => 1], 'options' => ['name' => 'idx_transactions_category']],
                ['key' => ['jenis' => 1], 'options' => ['name' => 'idx_transactions_jenis']],
            ],
            'wallets' => [
                ['key' => ['user_id' => 1], 'options' => ['unique' => true, 'name' => 'idx_wallets_user']],
            ],
            'saving_goals' => [
                ['key' => ['user_id' => 1, 'status' => 1], 'options' => ['name' => 'idx_saving_goals_user_status']],
                ['key' => ['deadline' => 1], 'options' => ['name' => 'idx_saving_goals_deadline']],
            ],
            'parent_child_relations' => [
                ['key' => ['parent_id' => 1, 'child_id' => 1], 'options' => ['unique' => true, 'name' => 'idx_relations_parent_child']],
                ['key' => ['parent_id' => 1, 'is_active' => 1], 'options' => ['name' => 'idx_relations_parent_active']],
            ],
            'withdrawal_requests' => [
                ['key' => ['child_id' => 1, 'status' => 1], 'options' => ['name' => 'idx_withdrawals_child_status']],
                ['key' => ['parent_id' => 1, 'status' => 1], 'options' => ['name' => 'idx_withdrawals_parent_status']],
            ],
            'notification_feeds' => [
                ['key' => ['user_id' => 1, 'created_at' => -1], 'options' => ['name' => 'idx_notifications_user_date']],
                ['key' => ['read_at' => 1], 'options' => ['name' => 'idx_notifications_read']],
            ],
            'activity_logs' => [
                ['key' => ['user_id' => 1, 'event' => 1, 'created_at' => -1], 'options' => ['name' => 'idx_activity_user_event_date']],
            ],
            'analytics_snapshots' => [
                ['key' => ['user_id' => 1, 'month' => -1], 'options' => ['name' => 'idx_analytics_user_month']],
            ],
            'smart_insights' => [
                ['key' => ['user_id' => 1, 'generated_at' => -1], 'options' => ['name' => 'idx_insights_user_date']],
            ],
        ];

        foreach ($indexes as $collection => $indexList) {
            foreach ($indexList as $index) {
                try {
                    $mongodb->getCollection($collection)->createIndex($index['key'], $index['options']);
                } catch (CommandException $e) {
                    // Skip if index already exists
                    if (!str_contains($e->getMessage(), 'already exists')) {
                        throw $e;
                    }
                }
            }
        }
    }

    public function down()
    {
        $mongodb = DB::connection('mongodb');

        $collections = [
            'users', 'transactions', 'wallets', 'saving_goals',
            'parent_child_relations', 'withdrawal_requests',
            'notification_feeds', 'activity_logs',
            'analytics_snapshots', 'smart_insights'
        ];

        foreach ($collections as $collection) {
            try {
                $mongodb->getCollection($collection)->dropIndexes();
            } catch (\Exception $e) {
                // Ignore errors on rollback
            }
        }
    }
};
