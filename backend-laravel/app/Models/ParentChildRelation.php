<?php

namespace App\Models;

use MongoDB\Laravel\Eloquent\Model;

class ParentChildRelation extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'parent_child_relations';

    protected $fillable = ['parent_id', 'child_id', 'is_active'];
}
