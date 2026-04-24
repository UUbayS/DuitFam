<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;

class UtilityController extends Controller
{
    public function categories()
    {
        $data = Category::query()->orderBy('nama_kategori')->get()->map(function ($c) {
            $jenis = $c->jenis;
            
            // Fallback logic for legacy categories missing 'jenis'
            if (!$jenis) {
                $incomeKeywords = ['gaji', 'bonus', 'investasi', 'hadiah', 'saku'];
                $isIncome = false;
                foreach ($incomeKeywords as $kw) {
                    if (str_contains(strtolower($c->nama_kategori), $kw)) {
                        $isIncome = true;
                        break;
                    }
                }
                $jenis = $isIncome ? 'pemasukan' : 'pengeluaran';
            }

            return [
                'id_kategori' => (string) $c->id,
                'nama_kategori' => $c->nama_kategori,
                'jenis' => $jenis,
                'icon' => $c->icon ?? 'Tag',
            ];
        });

        return response()->json([
            'message' => 'Berhasil mengambil kategori.',
            'data' => $data,
        ]);
    }
}
