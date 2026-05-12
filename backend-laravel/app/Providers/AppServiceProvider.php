<?php

namespace App\Providers;

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
        // Register observers for event-driven cache invalidation
        \App\Models\Transaction::observe(\App\Observers\TransactionObserver::class);
        \App\Models\WithdrawalRequest::observe(\App\Observers\WithdrawalRequestObserver::class);
    }
}
