<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class RecurringTransaction extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'recurring_transactions';

    protected $fillable = [
        'user_id',
        'category_id',
        'jenis',
        'jumlah',
        'keterangan',
        'frequency',
        'day_of_week',
        'day_of_month',
        'start_date',
        'end_date',
        'last_generated_date',
        'is_active',
    ];
}
