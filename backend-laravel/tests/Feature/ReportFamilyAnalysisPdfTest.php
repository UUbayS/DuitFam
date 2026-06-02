<?php

namespace Tests\Feature;

use App\Models\ParentChildRelation;
use App\Models\User;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReportFamilyAnalysisPdfTest extends TestCase
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

    public function test_child_cannot_download_family_pdf(): void
    {
        $child = $this->makeUser('child');

        $response = $this->withHeaders($this->authHeaders($child))
            ->getJson('/api/reports/family/analysis/pdf?month=2026-06');

        $response->assertStatus(403);
    }

    public function test_invalid_month_returns_422(): void
    {
        $parent = $this->makeUser('parent');

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/analysis/pdf?month=2026-13');

        $response->assertStatus(422);
    }

    public function test_parent_can_download_family_pdf(): void
    {
        $parent = $this->makeUser('parent');

        $response = $this->withHeaders($this->authHeaders($parent))
            ->get('/api/reports/family/analysis/pdf?month=2026-06');

        $response->assertStatus(200);
        $this->assertStringContainsString('application/pdf', $response->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $response->streamedContent());
    }
}
