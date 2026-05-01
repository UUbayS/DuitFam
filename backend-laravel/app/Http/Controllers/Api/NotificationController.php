<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mongo\NotificationFeed;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $data = NotificationFeed::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get(['_id', 'title', 'message', 'read_at', 'created_at'])
            ->map(function ($item) {
            return [
                'id' => (string) $item->_id,
                'title' => $item->title,
                'message' => $item->message,
                'read_at' => $item->read_at,
                'created_at' => $item->created_at,
            ];
        });

        return response()->json(['message' => 'Berhasil mengambil notifikasi.', 'data' => $data]);
    }

    public function markRead(Request $request, string $id)
    {
        NotificationFeed::where('_id', $id)->where('user_id', $request->user()->id)->update(['read_at' => now()]);

        return response()->json(['message' => 'Notifikasi ditandai terbaca.']);
    }
}
