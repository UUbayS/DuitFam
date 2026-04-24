<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TokenAuthMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(["message" => "Unauthenticated."], 401);
        }

        $user = User::where("api_token", hash('sha256', $token))->first();

        if (!$user) {
            return response()->json(["message" => "Invalid token."], 401);
        }

        // Check token expiration
        if (isset($user->api_token_expires_at) && $user->api_token_expires_at < now()) {
            return response()->json(["message" => "Token expired."], 401);
        }

        if (isset($user->is_active) && !$user->is_active) {
            return response()->json(["message" => "Akun dinonaktifkan."], 403);
        }

        // Set user on request so $request->user() works
        $request->setUserResolver(fn() => $user);

        return $next($request);
    }
}
