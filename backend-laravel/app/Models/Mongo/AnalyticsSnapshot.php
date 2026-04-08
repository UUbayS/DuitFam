<?php

namespace App\Models\Mongo;

use MongoDB\Laravel\Eloquent\Model;

class AnalyticsSnapshot extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'analytics_snapshots';

    protected $fillable = ['user_id', 'period', 'summary', 'chart_data', 'created_at'];

    public $timestamps = false;
}
