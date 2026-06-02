<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('generate-invite', function (Request $request) {
            $key = $request->user()?->id ?? $request->ip();
            return Limit::perMinutes(5, 5)->by($key);
        });

        // Register observers for event-driven cache invalidation
        \App\Models\Transaction::observe(\App\Observers\TransactionObserver::class);
        \App\Models\WithdrawalRequest::observe(\App\Observers\WithdrawalRequestObserver::class);
    }
}
