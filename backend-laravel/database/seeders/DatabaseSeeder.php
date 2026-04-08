<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $mongo = DB::connection('mongodb')->getMongoDB();
        $mongo->selectCollection('users')->createIndex(['email' => 1], ['unique' => true]);
        $mongo->selectCollection('users')->createIndex(['username' => 1], ['unique' => true]);
        $mongo->selectCollection('users')->createIndex(['api_token' => 1]);
        $mongo->selectCollection('users')->createIndex(['role' => 1]);
        $mongo->selectCollection('users')->createIndex(['is_active' => 1]);

        $mongo->selectCollection('wallets')->createIndex(['user_id' => 1], ['unique' => true]);

        $mongo->selectCollection('categories')->createIndex(['nama_kategori' => 1], ['unique' => true]);

        $mongo->selectCollection('parent_child_relations')->createIndex(['parent_id' => 1, 'is_active' => 1]);
        $mongo->selectCollection('parent_child_relations')->createIndex(['child_id' => 1]);

        $mongo->selectCollection('transactions')->createIndex(['user_id' => 1, 'created_at' => -1]);
        $mongo->selectCollection('transactions')->createIndex(['user_id' => 1, 'tanggal' => 1]);
        $mongo->selectCollection('transactions')->createIndex(['user_id' => 1, 'jenis' => 1, 'tanggal' => 1]);

        $mongo->selectCollection('saving_goals')->createIndex(['user_id' => 1, 'created_at' => -1]);
        $mongo->selectCollection('saving_goals')->createIndex(['user_id' => 1, 'status' => 1]);

        $mongo->selectCollection('withdrawal_requests')->createIndex(['child_id' => 1, 'created_at' => -1]);
        $mongo->selectCollection('withdrawal_requests')->createIndex(['parent_id' => 1, 'created_at' => -1]);
        $mongo->selectCollection('withdrawal_requests')->createIndex(['status' => 1]);

        foreach (['parent', 'child'] as $roleName) {
            Role::firstOrCreate(['name' => $roleName]);
        }

        foreach (['Makanan', 'Transportasi', 'Hiburan', 'Tabungan', 'Pendidikan'] as $categoryName) {
            Category::firstOrCreate(['nama_kategori' => $categoryName]);
        }

        User::firstOrCreate(
            ['email' => 'parent@gmail.com'],
            ['username' => 'parent_demo', 'role' => 'parent', 'password' => Hash::make('Password1')]
        );

        User::firstOrCreate(
            ['email' => 'child@gmail.com'],
            ['username' => 'child_demo', 'role' => 'child', 'password' => Hash::make('Password1')]
        );
    }
}
