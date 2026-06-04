<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Budget extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'budgets';

    protected $fillable = [
        'user_id',
        'category_id',
        'jumlah',
        'periode_bulan',
    ];
}
