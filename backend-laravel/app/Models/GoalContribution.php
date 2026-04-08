<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class GoalContribution extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'goal_contributions';

    protected $fillable = ['saving_goal_id', 'user_id', 'jumlah', 'contributed_at'];
}
