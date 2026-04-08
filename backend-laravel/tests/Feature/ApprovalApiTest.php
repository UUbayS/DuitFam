<?php

namespace Tests\Feature;

use App\Models\ParentChildRelation;
use App\Models\User;
use App\Models\WithdrawalRequest;
use Illuminate\Support\Str;
use Tests\TestCase;

class ApprovalApiTest extends TestCase
{
    public function test_child_can_create_withdrawal_request(): void
    {
        $parent = User::factory()->create(['role' => 'parent']);
        $child = User::factory()->create(['role' => 'child']);
        ParentChildRelation::create(['parent_id' => $parent->id, 'child_id' => $child->id, 'is_active' => true]);
        $token = Str::random(80);
        $child->api_token = $token;
        $child->save();

        $this->withHeader('Authorization', 'Bearer '.$token)->postJson('/api/transactions/withdrawals', [
            'amount' => 50000,
            'reason' => 'Beli buku',
        ])->assertStatus(201);

        $this->assertTrue(WithdrawalRequest::where('child_id', (string) $child->id)->where('parent_id', (string) $parent->id)->where('status', 'pending')->exists());
    }
}
