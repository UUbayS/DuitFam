<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function register(RegisterRequest $request)
    {
        try {
            $payload = $request->validated();
            $username = strtolower($payload['username']);
            $email = strtolower($payload['email']);
            
            Log::info('AUTH_REGISTER_ATTEMPT', [
                'email' => $email,
                'username' => $username,
                'role' => 'parent',
            ]);

            if (User::where('username', $username)->exists() || User::where('email', $email)->exists()) {
                return response()->json(['message' => 'Email atau Username sudah terdaftar.'], 409);
            }

            $user = User::create([
                'username' => $username,
                'email' => $email,
                'role' => config('constants.roles.parent'),
                'is_active' => true,
                'password' => Hash::make((string) $request->input('password')),
            ]);

            Wallet::firstOrCreate(['user_id' => (string) $user->id], ['saldo_sekarang' => 0]);

            Log::info('AUTH_REGISTER_SUCCESS', ['user_id' => $user->id, 'email' => $user->email]);

            return response()->json([
                'message' => 'Registrasi berhasil. Akun telah dibuat, silakan login untuk melanjutkan.',
            ], 201);
        } catch (\Throwable $e) {
            Log::error('AUTH_REGISTER_FAILED', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request' => $request->except(['password']),
            ]);

            return response()->json([
                'message' => 'Registrasi gagal. Cek log backend untuk detail error.',
            ], 500);
        }
    }

    public function login(LoginRequest $request)
    {
        try {
            $start = microtime(true);
            $identifier = strtolower((string) $request->input('email'));
            Log::info('AUTH_LOGIN_ATTEMPT', ['identifier' => $identifier]);

            $t1 = microtime(true);
            $user = User::where('email', $identifier)->orWhere('username', $identifier)->first();
            $t2 = microtime(true);
            if (! $user || ! Hash::check((string) $request->input('password'), $user->password)) {
                Log::warning('AUTH_LOGIN_INVALID_CREDENTIALS', ['identifier' => $identifier]);

                return response()->json(['message' => 'Email atau Password salah.'], 401);
            }
            $t3 = microtime(true);
            if (isset($user->is_active) && ! $user->is_active) {
                return response()->json(['message' => 'Akun dinonaktifkan.'], 403);
            }

            $token = Str::random(80);
            $expiresAt = now()->addHours(3);
            $user->api_token = hash('sha256', $token);
            $user->api_token_expires_at = $expiresAt;
            $user->save();
            $t4 = microtime(true);

            Log::info('AUTH_LOGIN_SUCCESS', ['user_id' => $user->id, 'email' => $user->email, 'timing' => ['query' => $t2-$t1, 'hash' => $t3-$t2, 'save' => $t4-$t3, 'total' => $t4-$start]]);

            return response()->json([
                'message' => 'Login berhasil.',
                'token' => $token,
                'expires_at' => $expiresAt->toISOString(),
                'user' => [
                    'id_user' => (string) $user->id,
                    'username' => $user->username,
                    'email' => $user->email,
                    'role' => $user->role,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('AUTH_LOGIN_FAILED', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request' => $request->except(['password']),
            ]);

            return response()->json(['message' => 'Login gagal. Cek log backend untuk detail error.'], 500);
        }
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        if ($user) {
            $user->api_token = null;
            $user->api_token_expires_at = null;
            $user->save();
        }

        return response()->json(['message' => 'Logout berhasil.']);
    }
}
