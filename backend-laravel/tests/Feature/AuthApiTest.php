<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    public function test_register_and_login_flow(): void
    {
        $this->postJson('/api/auth/register', [
            'username' => 'anak_satu',
            'email' => 'anak1@gmail.com',
            'password' => 'Password1',
        ])->assertStatus(201);

        $this->assertTrue(User::where('email', 'anak1@gmail.com')->where('role', 'parent')->exists());

        $this->postJson('/api/auth/login', [
            'email' => 'anak1@gmail.com',
            'password' => 'Password1',
        ])->assertStatus(200)->assertJsonStructure(['token', 'user' => ['id_user', 'username', 'email']]);
    }
}
