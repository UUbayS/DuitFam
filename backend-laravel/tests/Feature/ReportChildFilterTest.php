<?php

namespace Tests\Feature;

use App\Models\ParentChildRelation;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Transaction;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReportChildFilterTest extends TestCase
{
    private function makeUser(string $role): User
    {
        return User::factory()->create(['role' => $role]);
    }

    private function authHeaders(User $user): array
    {
        $token = Str::random(80);
        $user->api_token = hash('sha256', $token);
        $user->save();
        return [
            'Authorization' => 'Bearer ' . $token,
            'Accept' => 'application/json',
        ];
    }

    private function linkChild(User $parent, User $child): void
    {
        ParentChildRelation::create([
            'parent_id' => (string) $parent->id,
            'child_id' => (string) $child->id,
            'is_active' => true,
        ]);
        Wallet::firstOrCreate(['user_id' => (string) $child->id], ['saldo_sekarang' => 0]);
    }

    public function test_child_filter_returns_403_when_child_not_owned(): void
    {
        $parent = $this->makeUser('parent');
        $stranger = $this->makeUser('child');

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/summary?child_id=' . $stranger->id);

        $response->assertStatus(403);
    }

    public function test_child_filter_returns_data_for_owned_child(): void
    {
        $parent = $this->makeUser('parent');
        $child = $this->makeUser('child');
        $this->linkChild($parent, $child);

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/summary?child_id=' . $child->id);

        $response->assertStatus(200);
        $response->assertJsonPath('data.username', $child->username);
    }

    public function test_child_filter_overrides_group_param(): void
    {
        $parent = $this->makeUser('parent');
        $child = $this->makeUser('child');
        $this->linkChild($parent, $child);

        Transaction::create([
            'user_id' => (string) $parent->id,
            'jenis' => config('constants.transaction_types.pemasukan'),
            'jumlah' => 999,
            'status' => config('constants.transaction_status.berhasil'),
            'tanggal' => now()->format('Y-m-d'),
            'is_internal' => false,
        ]);

        Transaction::create([
            'user_id' => (string) $child->id,
            'jenis' => config('constants.transaction_types.pemasukan'),
            'jumlah' => 100,
            'status' => config('constants.transaction_status.berhasil'),
            'tanggal' => now()->format('Y-m-d'),
            'is_internal' => false,
        ]);

        // group=ortu would normally restrict to parent only; child_id must take precedence.
        // Asserting on totalPemasukan proves scope: child's 100 is included, parent's 999 is excluded.
        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/summary?child_id=' . $child->id . '&group=ortu');

        $response->assertStatus(200);
        $response->assertJsonPath('data.username', $child->username);
        $response->assertJsonPath('data.totalPemasukan', 100);
    }

    public function test_historical_with_child_id_returns_200(): void
    {
        $parent = $this->makeUser('parent');
        $child = $this->makeUser('child');
        $this->linkChild($parent, $child);

        Transaction::create([
            'user_id' => (string) $parent->id,
            'jenis' => config('constants.transaction_types.pemasukan'),
            'jumlah' => 999,
            'status' => config('constants.transaction_status.berhasil'),
            'tanggal' => '2026-06-15',
            'is_internal' => false,
        ]);

        Transaction::create([
            'user_id' => (string) $child->id,
            'jenis' => config('constants.transaction_types.pemasukan'),
            'jumlah' => 100,
            'status' => config('constants.transaction_status.berhasil'),
            'tanggal' => '2026-06-15',
            'is_internal' => false,
        ]);

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/historical?unit=tahunan&year=2026&child_id=' . $child->id);

        $response->assertStatus(200);
        $response->assertJsonPath('data.0.pemasukan', 100);
    }

    public function test_historical_with_unowned_child_id_returns_403(): void
    {
        $parent = $this->makeUser('parent');
        $stranger = $this->makeUser('child');

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/historical?unit=tahunan&year=2026&child_id=' . $stranger->id);

        $response->assertStatus(403);
    }
}
