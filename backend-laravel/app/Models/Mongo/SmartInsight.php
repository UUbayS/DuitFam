<?php

namespace App\Models\Mongo;

use MongoDB\Laravel\Eloquent\Model;

class SmartInsight extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'smart_insights';

    protected $fillable = ['user_id', 'month', 'insight', 'recommendation', 'score', 'created_at'];

    public $timestamps = false;
}
