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
        if (! $token) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user = User::where('api_token', $token)->first();
        if (! $user) {
            return response()->json(['message' => 'Invalid token.'], 401);
        }
        if (isset($user->is_active) && ! $user->is_active) {
            return response()->json(['message' => 'Akun dinonaktifkan.'], 403);
        }

        auth()->setUser($user);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
