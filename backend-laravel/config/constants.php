<?php

return [
    'roles' => [
        'parent',
        'child',
    ],

    'transaction_types' => [
        'pemasukan',
        'pengeluaran',
        'menabung',
        'refund',
    ],

    'transaction_status' => [
        'berhasil',
        'pending',
        'approved',
        'rejected',
    ],

    'goal_status' => [
        'aktif',
        'tercapai',
        'batal',
    ],

    'categories' => [
        'Tabungan',
        'Makanan',
        'Transportasi',
        'Hiburan',
        'Pendidikan',
        'Kesehatan',
        'Lainnya',
    ],

    'token_expiration' => 3, // hours
    'rate_limit' => [
        'auth' => 5,      // requests per minute
        'ai' => 10,       // requests per minute
        'reset_password' => 3, // requests per minute
    ],
];
