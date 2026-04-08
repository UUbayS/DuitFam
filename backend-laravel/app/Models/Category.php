<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class Category extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'categories';

    protected $fillable = ['nama_kategori'];
}
