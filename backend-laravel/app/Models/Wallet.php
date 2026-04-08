<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Wallet extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'wallets';

    protected $fillable = ['user_id', 'saldo_sekarang'];
}
