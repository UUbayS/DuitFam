<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;

class UtilityController extends Controller
{
    public function categories()
    {
        $data = Category::query()->orderBy('nama_kategori')->get()->map(function ($c) {
            return [
                'id_kategori' => (string) $c->id,
                'nama_kategori' => $c->nama_kategori,
            ];
        });

        return response()->json([
            'message' => 'Berhasil mengambil kategori.',
            'data' => $data,
        ]);
    }
}
