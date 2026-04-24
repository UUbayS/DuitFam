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

        $categories = [
            // Pengeluaran
            ['nama_kategori' => 'Makanan & Minuman', 'jenis' => 'pengeluaran', 'icon' => 'CupHot'],
            ['nama_kategori' => 'Belanja', 'jenis' => 'pengeluaran', 'icon' => 'Bag'],
            ['nama_kategori' => 'Transportasi', 'jenis' => 'pengeluaran', 'icon' => 'CarFront'],
            ['nama_kategori' => 'Hiburan', 'jenis' => 'pengeluaran', 'icon' => 'Controller'],
            ['nama_kategori' => 'Kesehatan', 'jenis' => 'pengeluaran', 'icon' => 'HeartPulse'],
            ['nama_kategori' => 'Pendidikan', 'jenis' => 'pengeluaran', 'icon' => 'Book'],
            ['nama_kategori' => 'Tagihan', 'jenis' => 'pengeluaran', 'icon' => 'Receipt'],
            ['nama_kategori' => 'Cicilan', 'jenis' => 'pengeluaran', 'icon' => 'CreditCard'],
            ['nama_kategori' => 'Lainnya', 'jenis' => 'pengeluaran', 'icon' => 'QuestionCircle'],
            
            // Pemasukan
            ['nama_kategori' => 'Gaji', 'jenis' => 'pemasukan', 'icon' => 'Wallet2'],
            ['nama_kategori' => 'Bonus', 'jenis' => 'pemasukan', 'icon' => 'Gift'],
            ['nama_kategori' => 'Investasi', 'jenis' => 'pemasukan', 'icon' => 'GraphUpArrow'],
            ['nama_kategori' => 'Hadiah', 'jenis' => 'pemasukan', 'icon' => 'EmojiSmile'],
            ['nama_kategori' => 'Lainnya (Pemasukan)', 'jenis' => 'pemasukan', 'icon' => 'PlusCircle'],
        ];

        foreach ($categories as $cat) {
            Category::updateOrCreate(['nama_kategori' => $cat['nama_kategori']], $cat);
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
