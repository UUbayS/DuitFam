<?php

namespace Tests\Feature;

use App\Models\SavingGoal;
use App\Models\User;
use Illuminate\Support\Str;
use Tests\TestCase;

class TargetApiTest extends TestCase
{
    public function test_create_target(): void
    {
        $user = User::factory()->create(['role' => 'child']);
        $token = Str::random(80);
        $user->api_token = $token;
        $user->save();

        $this->withHeader('Authorization', 'Bearer '.$token)->postJson('/api/targets', [
            'nama_target' => 'Laptop',
            'target_jumlah' => 5000000,
            'tanggal_target' => now()->addMonth()->toDateString(),
        ])->assertStatus(201);

        $this->assertTrue(SavingGoal::where('nama_target', 'Laptop')->where('user_id', (string) $user->id)->exists());
    }
}
