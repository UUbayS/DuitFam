<?php

return [
    'roles' => [
        'parent' => 'parent',
        'child' => 'child',
    ],

    'transaction_types' => [
        'pemasukan' => 'pemasukan',
        'pengeluaran' => 'pengeluaran',
        'menabung' => 'menabung',
        'refund' => 'refund',
    ],

    'transaction_status' => [
        'berhasil' => 'berhasil',
        'pending' => 'pending',
        'approved' => 'approved',
        'rejected' => 'rejected',
    ],

    'goal_status' => [
        'aktif' => 'aktif',
        'tercapai' => 'tercapai',
        'batal' => 'batal',
    ],

    'categories' => [
        'Tabungan' => 'Tabungan',
        'Makanan' => 'Makanan',
        'Transportasi' => 'Transportasi',
        'Hiburan' => 'Hiburan',
        'Pendidikan' => 'Pendidikan',
        'Kesehatan' => 'Kesehatan',
        'Lainnya' => 'Lainnya',
    ],

    'token_expiration' => 3, // hours
    'rate_limit' => [
        'auth' => 20,      // requests per minute
        'ai' => 10,       // requests per minute
        'reset_password' => 5, // requests per minute
    ],
];
