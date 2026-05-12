<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class BackfillUsernames extends Command
{
    protected $signature = 'app:backfill-usernames';
    protected $description = 'Backfill username_lower field for existing users';

    public function handle()
    {
        $users = User::where(function ($query) {
            $query->whereNull('username_lower')->orWhere('username_lower', '');
        })->get();

        if ($users->isEmpty()) {
            $this->info('Semua user sudah memiliki username_lower.');
            return Command::SUCCESS;
        }

        $bar = $this->output->createProgressBar(count($users));
        $bar->start();

        foreach ($users as $user) {
            $user->username_lower = strtolower($user->username);
            $user->save();
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info('Berhasil backfill ' . count($users) . ' user.');

        return Command::SUCCESS;
    }
}
