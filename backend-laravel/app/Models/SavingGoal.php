<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class SavingGoal extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'saving_goals';

    protected $fillable = [
        'user_id',
        'nama_target',
        'target_jumlah',
        'jumlah_terkumpul',
        'tanggal_target',
        'status',
    ];
}
