<?php

namespace App\Models\Mongo;

use MongoDB\Laravel\Eloquent\Model;

class NotificationFeed extends Model
{
    protected $connection = 'mongodb';

    protected $collection = 'notification_feeds';

    protected $fillable = ['user_id', 'title', 'message', 'read_at', 'meta'];
}
