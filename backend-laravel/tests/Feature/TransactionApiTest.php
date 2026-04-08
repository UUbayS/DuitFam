<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Support\Str;
use Tests\TestCase;

class TransactionApiTest extends TestCase
{
    public function test_create_income_transaction(): void
    {
        $user = User::factory()->create(['role' => 'child']);
        $wallet = Wallet::create(['user_id' => $user->id, 'saldo_sekarang' => 0]);
        $category = Category::create(['nama_kategori' => 'Pemasukan']);
        $token = Str::random(80);
        $user->api_token = $token;
        $user->save();

        $this->withHeader('Authorization', 'Bearer '.$token)->postJson('/api/transactions', [
            'jenis' => 'pemasukan',
            'jumlah' => 100000,
            'tanggal' => now()->toDateString(),
            'keterangan' => 'Uang saku',
            'id_kategori' => $category->id,
        ])->assertStatus(201);

        $wallet->refresh();
        $this->assertEquals(100000.0, (float) $wallet->saldo_sekarang);
    }
}
