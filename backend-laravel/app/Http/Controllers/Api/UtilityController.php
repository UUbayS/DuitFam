<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Support\Facades\Cache;

class UtilityController extends Controller
{
    public function categories()
    {
        $data = Cache::remember('categories', 3600, function () {
            return Category::query()->orderBy('nama_kategori')->get(['_id', 'nama_kategori', 'jenis', 'icon'])->map(function ($c) {
                $jenis = $c->jenis;
                
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
        });

        return response()->json([
            'message' => 'Berhasil mengambil kategori.',
            'data' => $data,
        ]);
    }
}
