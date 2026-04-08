<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Transaction extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'transactions';

    protected $fillable = [
        'user_id',
        'category_id',
        'jenis',
        'status',
        'jumlah',
        'tanggal',
        'keterangan',
    ];
}
