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
            Log::info('AUTH_REGISTER_ATTEMPT', [
                'email' => $payload['email'] ?? null,
                'username' => $payload['username'] ?? null,
                'role' => 'parent',
            ]);

            if (User::where('username', $request->input('username'))->exists() || User::where('email', $request->input('email'))->exists()) {
                return response()->json(['message' => 'Email atau Username sudah terdaftar.'], 409);
            }

            $user = User::create([
                'username' => (string) $request->input('username'),
                'email' => (string) $request->input('email'),
                'role' => 'parent',
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
            $identifier = (string) $request->input('email');
            Log::info('AUTH_LOGIN_ATTEMPT', ['identifier' => $identifier]);

            $user = User::where('email', $identifier)->orWhere('username', $identifier)->first();
            if (! $user || ! Hash::check((string) $request->input('password'), $user->password)) {
                Log::warning('AUTH_LOGIN_INVALID_CREDENTIALS', ['identifier' => $identifier]);

                return response()->json(['message' => 'Email atau Password salah.'], 401);
            }
            if (isset($user->is_active) && ! $user->is_active) {
                return response()->json(['message' => 'Akun dinonaktifkan.'], 403);
            }

            $token = Str::random(80);
            $user->api_token = $token;
            $user->save();
            Log::info('AUTH_LOGIN_SUCCESS', ['user_id' => $user->id, 'email' => $user->email]);

            return response()->json([
                'message' => 'Login berhasil.',
                'token' => $token,
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
            $user->save();
        }

        return response()->json(['message' => 'Logout berhasil.']);
    }
}
