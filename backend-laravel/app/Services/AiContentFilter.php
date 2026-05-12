<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class AiContentFilter
{
    /**
     * Kata kunci yang menunjukkan topik keuangan (setidaknya satu harus ada)
     */
    private const FINANCIAL_KEYWORDS = [
        'uang', 'pengeluaran', 'pemasukan', 'tabungan', 'budget', 'saldo',
        'tagihan', 'belanja', 'investasi', 'utang', 'beli', 'harga', 'diskon',
        'pendapatan', 'gaji', 'bayar', 'transaksi', 'tambah', 'kurang',
        'menabung', 'target', 'keuangan', 'dana darurat', 'kategori',
        'tampilkan', 'ringkasan', 'analisis', 'laporan', 'bulan', 'mingguan',
        'jumlah', 'total', 'sisa', 'habis', 'penggunaan', 'pengeluaran',
        'dompet', 'rekening', 'transfer', 'deposit', 'tarik', 'kontribusi',
        'capai', 'capaian', 'progress', 'persentase', 'tips', 'sarana',
        'rencana', 'pengaturan', 'kelola', 'keluarga', 'anak', 'kebutuhan',
        'keinginan', 'prioritas', 'penghematan',
    ];

    /**
     * Kata kunci topik NON-finansial yang harus diblokir
     */
    private const BLOCKED_KEYWORDS = [
        'politik', 'pemilu', 'presiden', 'pemerintah', 'demo', 'unjuk rasa',
        'protes', 'parpol', 'dpr', 'senator', 'menteri', 'walikota',
        'film', 'movie', 'sinema', 'bioskop', 'nonton',
        'game', 'viral', 'tiktok', 'instagram', 'facebook', 'twitter', 'youtube',
        'cuaca', 'ramalan', 'zodiak', 'nasib', 'hoki',
        'olahraga', 'sepak bola', 'liga', 'pemain', 'coach', 'stadion',
        'musik', 'lagu', 'album', 'penyanyi', 'band', 'konser',
        'selebriti', 'gosip', 'artis', 'komedi', 'stand up',
        'sihir', 'takhayul', 'horoskop', 'mitos', 'primbon',
        'ngoding', 'program', 'kode', 'software', 'bug', 'debug',
        'resep', 'masak', 'kuliner', 'makanan', 'restoran', 'kafe',
        'liburan', 'travel', 'wisata', 'hotel', 'penerbangan',
        'otomotif', 'mobil', 'motor', 'bensin', 'servis',
        'fashion', 'pakaian', 'toko', 'belanja online', 'shopee',
        'tiket', 'event', 'konser', 'festival',
    ];

    /**
     * Pola prompt injection
     */
    private const INJECTION_PATTERNS = [
        '/ignore\s+(your\s+)?(instructions|rules|system)/i',
        '/you\s+are\s+(now\s+)?(a\s+)?(different|new|another)/i',
        '/pretend\s+to\s+be/i',
        '/forget\s+(everything|all|your\s+previous)/i',
        '/disregard\s+(previous|all)\s+(instructions|rules)/i',
        '/as\s+a\s+(pirate|hacker|criminal)/i',
        '/jailbreak/i',
        '/developer\s+mode/i',
        '/dismiss\s+(your|all)\s+(ethical|moral)/i',
        '/respond\s+without\s+(restrictions|censorship)/i',
    ];

    /**
     * Greeting patterns - allowed without financial keywords
     */
    private const GREETING_PATTERNS = [
        '/^(halo|hai|hello|hi|selamat|pagi|siang|sore|malam)[\s,.!?]*$/i',
        '/^(thank?s|terima\s+kasih|makasih)/i',
        '/^(ok|oke|okay|baik|ya|iya|benar)/i',
        '/^bantuan$/i',
        '/^tolong$/i',
    ];

    /**
     * Periksa apakah pesan mengandung kata-kata tidak pantas (profanity)
     */
    public function containsProfanity(string $message): bool
    {
        $profanityList = [
            'babi', 'bodoh', 'tolol', 'gila', 'sinting', 'goblok',
            'ngentot', 'memek', 'kontol', 'anjg', 'kafir', 'setan',
            'dajjal', 'jalang', 'pelacur', 'bangsat', 'asu', 'asw',
            'anj', 'bngst', 'bgst', 'bng', 'tdk', 'korang',
            'cibai', 'macha', 'mekek', 'kurek', 'jembut', 'bego',
            'goblok', 'gembel', 'sinting', 'gila', 'gembel',
        ];

        $messageLower = strtolower($message);
        foreach ($profanityList as $word) {
            // Cek sebagai kata utuh (menggunakan word boundary regex)
            if (preg_match('/\b' . preg_quote($word, '/') . '\b/i', $messageLower)) {
                return true;
            }
            // Juga cek sebagai substring untuk kata-kata sangat vulgar
            if (str_contains($messageLower, $word)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Periksa apakah pesan adalah upaya prompt injection
     */
    public function isPromptInjection(string $message): bool
    {
        foreach (self::INJECTION_PATTERNS as $pattern) {
            if (preg_match($pattern, $message)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Periksa apakah pesan berkaitan dengan topik keuangan
     */
    public function isFinancial(string $message): bool
    {
        $messageLower = strtolower($message);

        foreach (self::FINANCIAL_KEYWORDS as $keyword) {
            if (str_contains($messageLower, $keyword)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Periksa apakah pesan adalah greeting/salam
     */
    public function isGreeting(string $message): bool
    {
        $messageLower = strtolower(trim($message));

        foreach (self::GREETING_PATTERNS as $pattern) {
            if (preg_match($pattern, $messageLower)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Filter utama - mengembalikan FilterResult
     */
    public function filter(string $message): FilterResult
    {
        // 1. Cek profanity
        if ($this->containsProfanity($message)) {
            return new FilterResult(
                approved: false,
                reason: 'profanity',
                message: 'Pesan mengandung kata-kata tidak pantas. Mohon gunakan bahasa yang sopan.'
            );
        }

        // 2. Cek prompt injection
        if ($this->isPromptInjection($message)) {
            return new FilterResult(
                approved: false,
                reason: 'injection',
                message: 'Pesan tidak valid. Saya hanya bisa membantu pertanyaan seputar keuangan.'
            );
        }

        // 3. Cek apakah topik finansial
        if ($this->isFinancial($message)) {
            return new FilterResult(
                approved: true,
                reason: 'financial',
                message: null
            );
        }

        // 4. Cek apakah greeting — izinkan tapi dengan response ringan
        if ($this->isGreeting($message)) {
            return new FilterResult(
                approved: true,
                reason: 'greeting',
                message: null
            );
        }

        // 5. Off-topic — tolak
        return new FilterResult(
            approved: false,
            reason: 'off_topic',
            message: 'Maaf, sebagai asisten keuangan DuitFam, saya hanya bisa membantu pertanyaan seputar keuangan dan pengelolaan anggaran Anda. Contoh: "Berapa pengeluaran saya bulan ini?" atau "Tips menabung apa ya?"'
        );
    }
}

class FilterResult
{
    public bool $approved;
    public string $reason;
    public ?string $message;

    public function __construct(bool $approved, string $reason, ?string $message)
    {
        $this->approved = $approved;
        $this->reason = $reason;
        $this->message = $message;
    }
}