<?php

namespace Tests\Feature;

use App\Models\ParentChildRelation;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReportFamilyAnalysisPdfTest extends TestCase
{
    private function makeUser(string $role): User
    {
        $user = new User();
        $user->username = $role . '_' . uniqid();
        $user->email = $role . '_' . uniqid() . '@test.local';
        $user->password = bcrypt('Password1');
        $user->role = $role;
        $user->save();
        return $user;
    }

    private function authHeaders(User $user): array
    {
        $token = Str::random(80);
        $user->api_token = hash('sha256', $token);
        $user->save();
        Auth::login($user);
        return [
            'Authorization' => 'Bearer ' . $token,
            'Accept' => 'application/json',
        ];
    }

    public function test_child_cannot_download_family_pdf(): void
    {
        $child = $this->makeUser('child');

        $response = $this->withHeaders($this->authHeaders($child))
            ->get('/api/reports/family/analysis/pdf?month=2026-06');

        $response->assertStatus(403);
    }

    public function test_invalid_month_returns_422(): void
    {
        $parent = $this->makeUser('parent');

        $response = $this->withHeaders($this->authHeaders($parent))
            ->get('/api/reports/family/analysis/pdf?month=2026-13');

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
