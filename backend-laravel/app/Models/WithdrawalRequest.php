<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class WithdrawalRequest extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'withdrawal_requests';

    protected $fillable = [
        'child_id',
        'parent_id',
        'approved_by',
        'amount',
        'reason',
        'status',
        'approved_at',
    ];
}
