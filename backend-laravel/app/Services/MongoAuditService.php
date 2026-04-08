<?php

namespace App\Services;

use App\Models\Mongo\ActivityLog;
use Illuminate\Http\Request;

class MongoAuditService
{
    public function log(Request $request, string $userId, string $event, array $payload = []): void
    {
        ActivityLog::create([
            'user_id' => $userId,
            'event' => $event,
            'payload' => $payload,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);
    }
}
