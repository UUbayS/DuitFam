<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;
use App\Services\AiContentFilter;

class GroqService
{
    protected AiContentFilter $filter;

    public function __construct(AiContentFilter $filter = null)
    {
        $this->filter = $filter ?? new AiContentFilter();
    }

    /**
     * Main method to generate financial advice using Triple-Tier Hybrid approach
     */
    public function generateFinancialAdvice(array $financialData, string $question, array $history = []): string
    {
        // Defense in depth: filter check before consuming tokens
        $filterResult = $this->filter->filter($question);
        if (!$filterResult->approved) {
            return $filterResult->message ?? 'Maaf, saya hanya bisa membantu pertanyaan seputar keuangan.';
        }

        // Disable execution time limit for long AI processing (loading large local models)
        set_time_limit(180); // 3 minutes max for AI processing

        // Tier 3 (Fakta Dasar dari Rule-Engine) - Selalu disiapkan sebagai fallback & konteks
        $fallbackResponse = $this->generateRuleBasedResponse($financialData, $question);
        
        // Pilih Provider Utama
        $provider = config('services.ai.provider', 'cloud');
        
        // Percobaan 1: Provider Utama (Cloud/Local)
        $response = $this->attemptAiResponse($provider, $financialData, $question, $history, $fallbackResponse);
        if ($response) return $response;

        // Percobaan 2: Fallback ke Local (Jika Cloud gagal)
        if ($provider === 'cloud' && config('services.ai.fallback_to_local')) {
            Log::info("Groq Cloud failed, falling back to Ollama Local");
            $response = $this->attemptAiResponse('local', $financialData, $question, $history, $fallbackResponse);
            if ($response) return $response;
        }

        // Percobaan 3: Fallback ke Rule-Based Murni
        Log::warning("All AI providers failed or disabled. Using Rule-Based fallback.");
        return $fallbackResponse;
    }

    /**
     * Wrapper for LLM calls with context injection
     */
    protected function attemptAiResponse(string $provider, array $data, string $question, array $history, string $factContext): ?string
    {
        $config = config("services.ai.{$provider}");
        if (!$config || (empty($config['api_key']) && $provider === 'cloud')) {
            return null;
        }

        try {
            $systemPrompt = $this->buildSystemPrompt($data, $factContext);
            $messages = $this->buildMessageArray($systemPrompt, $history, $question);

            Log::info("Calling AI Provider: {$provider} at {$config['api_url']} with model {$config['model']}");
            
            $response = Http::withHeaders($provider === 'cloud' ? [
                'Authorization' => 'Bearer ' . $config['api_key'],
                'Content-Type' => 'application/json',
            ] : [
                'Content-Type' => 'application/json',
            ])
            ->timeout(120) // Naikkan timeout karena reasoning makan waktu
            ->post($config['api_url'], [
                'model' => $config['model'],
                'messages' => $messages,
                'temperature' => 0.4, // Diturunkan agar lebih fokus dan tidak bertele-tele
                'top_p' => 0.9,
                'max_tokens' => 2000,
            ]);

            Log::info("AI Provider {$provider} response (HTTP {$response->status()}): " . $response->body());

            if ($response->successful()) {
                $content = $response->json('choices.0.message.content');
                
                if ($content && trim($content) !== "") {
                    // Bersihkan jika masih ada sisa-sisa tag <think> atau Thinking Process
                    $content = preg_replace('/<think>.*?<\/think>/s', '', $content);
                    $content = preg_replace('/(Thinking Process|Reasoning Process):/i', '', $content);
                    return trim($content);
                }
                
                Log::warning("AI Provider {$provider} returned success but content was empty.");
            }

            return null;
        } catch (\Exception $e) {
            Log::error("AI Provider {$provider} exception: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Inject financial data into System Prompt
     */
    protected function buildSystemPrompt(array $data, string $factContext): string
    {
        $summary = $data['summary'] ?? [];
        $income = number_format($summary['totalPemasukan'] ?? 0, 0, ',', '.');
        $expense = number_format($summary['totalPengeluaran'] ?? 0, 0, ',', '.');
        $net = number_format($summary['neto'] ?? 0, 0, ',', '.');
        $balance = number_format($summary['saldoAkhir'] ?? 0, 0, ',', '.');

        $user = $data['user'] ?? ['role' => 'unknown', 'username' => 'User'];

        $prompt = "Kamu adalah DuitFam AI Financial Advisor, asisten keuangan keluarga yang cerdas, ramah, dan solutif.\n\n";

        // User Context
        $prompt .= "**KONTEKS PENGGUNA:**\n";
        $prompt .= "- Nama: {$user['username']}\n";
        $prompt .= "- Peran: " . ($user['role'] === 'parent' ? 'Orang Tua' : ($user['role'] === 'child' ? 'Anak' : 'User')) . "\n\n";

        $prompt .= "**KONTEKS KEUANGAN SAAT INI (Bulan " . Carbon::now()->format('F Y') . "):**\n";
        $prompt .= "- Total Pemasukan: Rp {$income}\n";
        $prompt .= "- Total Pengeluaran: Rp {$expense}\n";
        $prompt .= "- Saldo Saat Ini: Rp {$balance}\n";
        $prompt .= "- Selisih (Net): Rp {$net}\n\n";

        $prompt .= "**DATA KATEGORI PENGELUARAN:**\n";
        foreach (array_slice($data['spendingByCategory'] ?? [], 0, 5) as $cat) {
            $amt = number_format($cat['jumlah'], 0, ',', '.');
            $prompt .= "- {$cat['namaKategori']}: Rp {$amt} ({$cat['persentase']}%)\n";
        }

        // Saving Goals
        if (!empty($data['saving_goals'])) {
            $prompt .= "\n**TARGET MENABUNG AKTIF:**\n";
            foreach ($data['saving_goals'] as $goal) {
                $targetAmt = number_format($goal['target_jumlah'], 0, ',', '.');
                $collectedAmt = number_format($goal['jumlah_terkumpul'], 0, ',', '.');
                $prompt .= "- {$goal['nama_target']}: {$goal['progress']}% (Rp {$collectedAmt} / Rp {$targetAmt})\n";
                if ($goal['is_overdue']) {
                    $prompt .= "  ⚠️ DEADLINE TERLEWATI!\n";
                } elseif ($goal['is_near_deadline']) {
                    $prompt .= "  ⏰ DEADLINE DALAM 7 HARI!\n";
                }
            }
        }

        // Family Context
        if ($user['role'] === 'parent' && !empty($data['family'])) {
            $prompt .= "\n**KELUARGA:** Anda memiliki {$data['family']['children_count']} anak terhubung.\n";
        } elseif ($user['role'] === 'child' && !empty($data['family'])) {
            $prompt .= "\n**KELUARGA:** Anda terhubung dengan orang tua.\n";
        }

        $prompt .= "\nFAKTA DARI SISTEM (Gunakan ini jika user bertanya spesifik):\n\"{$factContext}\"\n\n";

        $prompt .= "**INSTRUKSI:**\n";
        $prompt .= "1. Jawab dalam Bahasa Indonesia yang santai tapi profesional.\n";
        $prompt .= "2. HANYA jawab pertanyaan yang berkaitan dengan keuangan, pengelolaan uang, menabung, atau fitur DuitFam. Ini sangat penting!\n";
        $prompt .= "3. Jika pengguna bertanya tentang topik di luar keuangan (misalnya hiburan, politik, cuaca, coding, atau topik umum lainnya), Anda WAJIB menolaknya dengan sopan.\n";
        $prompt .= "4. Contoh penolakan: 'Maaf, sebagai asisten keuangan DuitFam, saya hanya bisa membantu pertanyaan seputar keuangan dan pengelolaan anggaran Anda.'\n";
        $prompt .= "5. Jika pengeluaran > pemasukan, berikan peringatan tegas tapi sopan.\n";
        $prompt .= "6. Berikan saran praktis untuk menghemat atau menabung.\n";
        $prompt .= "7. JANGAN memberikan nasihat investasi saham/kripto yang berisiko tinggi.\n";
        $prompt .= "8. Selalu prioritaskan keamanan dana darurat.\n";
        $prompt .= "9. JAWAB LANGSUNG pada intinya. Hindari proses berpikir internal yang terlalu panjang.\n";
        $prompt .= "10. JANGAN gunakan tag <think> atau menuliskan proses berpikirmu. Tampilkan jawaban akhir saja.\n";
        $prompt .= "11. Jika orang tua, berikan saran pengelolaan keuangan keluarga. Jika anak, berikan tips menabung yang menyenangkan.\n";
        $prompt .= "12. Ingatkan target yang terlewati deadline dengan sopan dan berikan saran mengejar target jika deadline ≤7 hari.";

        return $prompt;
    }

    /**
     * Build message array with history
     */
    protected function buildMessageArray(string $systemPrompt, array $history, string $question): array
    {
        $messages = [['role' => 'system', 'content' => $systemPrompt]];
        
        // Add limited history (last 5 messages)
        foreach (array_slice($history, -5) as $msg) {
            $messages[] = [
                'role' => $msg['role'] === 'assistant' ? 'assistant' : 'user',
                'content' => $msg['content']
            ];
        }
        
        $messages[] = ['role' => 'user', 'content' => $question];
        
        return $messages;
    }

    /**
     * Legacy Rule-Based Response Generator (The "Guru" layer)
     */
    protected function generateRuleBasedResponse(array $data, string $question): string
    {
        $summary = $data["summary"] ?? [];
        $income = $summary["totalPemasukan"] ?? 0;
        $expense = $summary["totalPengeluaran"] ?? 0;
        $net = $summary["neto"] ?? 0;
        $balance = $summary["saldoAkhir"] ?? 0;
        $spendingByCategory = $data["spendingByCategory"] ?? [];
        $user = $data["user"] ?? ['role' => 'unknown', 'username' => 'User'];
        $savingGoals = $data["saving_goals"] ?? [];

        $q = strtolower($question);

        // Handle user role questions
        if (str_contains($q, "saya anak") || str_contains($q, "saya orang tua") || str_contains($q, "peran saya") || str_contains($q, "role saya")) {
            $roleText = $user['role'] === 'parent' ? 'orang tua' : ($user['role'] === 'child' ? 'anak' : 'user');
            return "Halo {$user['username']}! Anda login sebagai **{$roleText}** di DuitFam.";
        }

        // Handle saving goals questions
        if (str_contains($q, "target") || str_contains($q, "tabungan") || str_contains($q, "nabung") || str_contains($q, " menabung")) {
            if (empty($savingGoals)) {
                return "🏦 Anda belum punya target menabung aktif. Yuk buat di menu **Target Menabung**!";
            }
            $resp = "🏦 **Target Menabung Anda:**\n\n";
            foreach ($savingGoals as $goal) {
                $targetAmt = number_format($goal['target_jumlah'], 0, ',', '.');
                $collectedAmt = number_format($goal['jumlah_terkumpul'], 0, ',', '.');
                $resp .= "• **{$goal['nama_target']}**: {$goal['progress']}%\n";
                $resp .= "  Rp {$collectedAmt} / Rp {$targetAmt}\n";
                if ($goal['is_overdue']) {
                    $resp .= "  ⚠️ **Deadline terlewati!** Segera selesaikan.\n";
                } elseif ($goal['is_near_deadline']) {
                    $resp .= "  ⏰ **Deadline dalam 7 hari!** Buruan kejar!\n";
                }
            }
            return $resp;
        }

        if (str_contains($q, "pengeluaran") || str_contains($q, "spending") || str_contains($q, "habis")) {
            $resp = "📊 Total pengeluaran Anda bulan ini Rp " . number_format($expense, 0, ',', '.') . ". ";
            if ($income > 0) {
                $ratio = round(($expense / $income) * 100);
                $resp .= "Anda sudah menghabiskan {$ratio}% dari pemasukan.";
            }
            return $resp;
        }

        if (str_contains($q, "budget") || str_contains($q, "anggaran") || str_contains($q, "bisa belanja")) {
            $avail = $income - $expense;
            return ($avail > 0)
                ? "💵 Sisa budget aman Anda adalah Rp " . number_format($avail, 0, ',', '.')
                : "🚫 Budget Anda sudah habis! Pengeluaran melebihi pemasukan sebesar Rp " . number_format(abs($avail), 0, ',', '.');
        }

        if (str_contains($q, "saldo") || str_contains($q, "uang")) {
            return "💰 Saldo Anda saat ini adalah Rp " . number_format($balance, 0, ',', '.') . ".";
        }

        // Default fact summary
        return "📊 Bulan ini pemasukan Rp " . number_format($income, 0, ',', '.') . " dan pengeluaran Rp " . number_format($expense, 0, ',', '.') . ".";
    }

    /**
     * AI Spending Alerts (Stays rule-based for precision)
     */
    public function generateSpendingAlerts(array $data): array
    {
        $alerts = [];
        $summary = $data["summary"] ?? [];
        $spendingByCategory = $data["spendingByCategory"] ?? [];

        $income = $summary["totalPemasukan"] ?? 0;
        $expense = $summary["totalPengeluaran"] ?? 0;
        $net = $summary["neto"] ?? 0;

        if ($income > 0) {
            $ratio = $expense / $income;
            if ($ratio > 1) {
                $alerts[] = [
                    "type" => "warning",
                    "title" => "🚨 Pengeluaran Melebihi Pemasukan!",
                    "message" => "Segera kurangi pengeluaran! Selisih: Rp " . number_format(abs($net), 0, ",", "."),
                    "severity" => "high",
                    "amount" => abs($net),
                ];
            } elseif ($ratio > 0.9) {
                $alerts[] = [
                    "type" => "warning",
                    "title" => "⚠️ Budget Kritis",
                    "message" => "Anda sudah pakai " . round($ratio * 100) . "% pemasukan.",
                    "severity" => "high",
                ];
            }
        }

        foreach ($spendingByCategory as $category) {
            if (($category["persentase"] ?? 0) > 30) {
                $alerts[] = [
                    "type" => "warning",
                    "title" => "📊 {$category["namaKategori"]} Tinggi",
                    "message" => "Menghabiskan {$category["persentase"]}% total pengeluaran.",
                    "severity" => "medium",
                ];
            }
        }

        return $alerts;
    }


    // Deprecated method for backward compatibility
    public function chat(string $message, array $context = []): ?string
    {
        return $this->generateFinancialAdvice($context, $message);
    }

    /**
     * Generate structured spending tips based on financial data
     * Returns array with categories: budget_tips, category_tips, saving_tips, warnings
     */
    public function generateSpendingTips(array $financialData): array
    {
        set_time_limit(180);
        
        // Try primary AI provider
        $provider = config('services.ai.provider', 'cloud');
        $tipsJson = $this->attemptSpendingTipsAiResponse($provider, $financialData);
        
        if ($tipsJson) {
            $parsed = json_decode($tipsJson, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($parsed)) {
                return $this->validateTipsStructure($parsed);
            }
        }
        
        // Fallback to local AI if cloud failed
        if ($provider === 'cloud' && config('services.ai.fallback_to_local')) {
            Log::info("Groq Cloud failed for spending tips, falling back to Ollama Local");
            $tipsJson = $this->attemptSpendingTipsAiResponse('local', $financialData);
            if ($tipsJson) {
                $parsed = json_decode($tipsJson, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($parsed)) {
                    return $this->validateTipsStructure($parsed);
                }
            }
        }
        
        // Final fallback to rule-based tips
        Log::warning("All AI providers failed for spending tips. Using Rule-Based fallback.");
        return $this->generateRuleBasedSpendingTips($financialData);
    }
    
    /**
     * Attempt to get spending tips from AI provider
     */
    protected function attemptSpendingTipsAiResponse(string $provider, array $data): ?string
    {
        $config = config("services.ai.{$provider}");
        if (!$config || (empty($config['api_key']) && $provider === 'cloud')) {
            return null;
        }
        
        try {
            $messages = [
                ['role' => 'system', 'content' => $this->buildSpendingTipsPrompt($data)],
                ['role' => 'user', 'content' => 'Berikan tips pengeluaran cerdas dalam format JSON sesuai instruksi. Pastikan output adalah JSON yang valid tanpa teks tambahan.']
            ];
            
            Log::info("Calling AI Provider: {$provider} for spending tips");
            
            $response = Http::withHeaders($provider === 'cloud' ? [
                'Authorization' => 'Bearer ' . $config['api_key'],
                'Content-Type' => 'application/json',
            ] : [
                'Content-Type' => 'application/json',
            ])
            ->timeout(120)
            ->post($config['api_url'], [
                'model' => $config['model'],
                'messages' => $messages,
                'temperature' => 0.3,
                'max_tokens' => 2000,
            ]);
            
            if ($response->successful()) {
                $content = $response->json('choices.0.message.content');
                if ($content && trim($content) !== '') {
                    $content = preg_replace('/<think>.*?<\/think>/s', '', $content);
                    return trim($content);
                }
            }
            
            return null;
        } catch (\Exception $e) {
            Log::error("AI Provider {$provider} exception for spending tips: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Build prompt for spending tips generation
     */
    protected function buildSpendingTipsPrompt(array $data): string
    {
        $summary = $data['summary'] ?? [];
        $income = number_format($summary['totalPemasukan'] ?? 0, 0, ',', '.');
        $expense = number_format($summary['totalPengeluaran'] ?? 0, 0, ',', '.');
        $net = number_format($summary['neto'] ?? 0, 0, ',', '.');
        $balance = number_format($summary['saldoAkhir'] ?? 0, 0, ',', '.');
        
        $prompt = "Kamu adalah DuitFam AI Financial Advisor. Berikan tips pengeluaran cerdas berdasarkan data keuangan berikut.\n\n";
        $prompt .= "**DATA KEUANGAN:**\n";
        $prompt .= "- Pemasukan: Rp {$income}\n";
        $prompt .= "- Pengeluaran: Rp {$expense}\n";
        $prompt .= "- Saldo Akhir: Rp {$balance}\n";
        $prompt .= "- Net: Rp {$net}\n\n";
        
        $prompt .= "**KATEGORI PENGELUARAN:**\n";
        foreach (array_slice($data['spendingByCategory'] ?? [], 0, 5) as $cat) {
            $amt = number_format($cat['jumlah'], 0, ',', '.');
            $prompt .= "- {$cat['namaKategori']}: Rp {$amt} ({$cat['persentase']}%)\n";
        }
        
        $prompt .= "\n**TARGET MENABUNG:**\n";
        if (!empty($data['saving_goals'])) {
            foreach ($data['saving_goals'] as $goal) {
                $targetAmt = number_format($goal['target_jumlah'], 0, ',', '.');
                $collectedAmt = number_format($goal['jumlah_terkumpul'], 0, ',', '.');
                $prompt .= "- {$goal['nama_target']}: {$goal['progress']}% (Rp {$collectedAmt} / Rp {$targetAmt})\n";
            }
        } else {
            $prompt .= "- Tidak ada target menabung aktif\n";
        }
        
        $prompt .= "\n**INSTRUKSI:**\n";
        $prompt .= "1. Berikan tips dalam Bahasa Indonesia yang santai dan praktis.\n";
        $prompt .= "2. Bagi tips menjadi 4 kategori: budget_tips, category_tips, saving_tips, warnings.\n";
        $prompt .= "3. Setiap kategori berisi array of objects dengan field: id (string), title (string), message (string), priority ('high'/'medium'/'low').\n";
        $prompt .= "4. Untuk budget_tips: Tips mengelola anggaran berdasarkan pemasukan (gunakan aturan 50/30/20 jika relevan).\n";
        $prompt .= "5. Untuk category_tips: Tips berdasarkan kategori pengeluaran terbesar (beri saran spesifik per kategori).\n";
        $prompt .= "6. Untuk saving_tips: Tips menabung sesuai target yang ada.\n";
        $prompt .= "7. Untuk warnings: Peringatan jika pengeluaran > pemasukan, atau kategori terlalu tinggi.\n";
        $prompt .= "8. Kembalikan dalam format JSON yang valid, tanpa teks tambahan di luar JSON.\n";
        $prompt .= "9. Pastikan setiap tips memiliki id unik (contoh: 'budget_1', 'category_1', 'saving_1', 'warning_1').\n";
        $prompt .= "10. JANGAN gunakan tag <think> atau menuliskan proses berpikirmu. Tampilkan jawaban akhir saja.\n";
        
        return $prompt;
    }
    
    /**
     * Validate and structure the tips array
     */
    protected function validateTipsStructure(array $tips): array
    {
        $validCategories = ['budget_tips', 'category_tips', 'saving_tips', 'warnings'];
        $validPriorities = ['high', 'medium', 'low'];
        
        $result = [];
        foreach ($validCategories as $cat) {
            $result[$cat] = [];
            if (isset($tips[$cat]) && is_array($tips[$cat])) {
                foreach ($tips[$cat] as $tip) {
                    if (isset($tip['id'], $tip['title'], $tip['message'], $tip['priority'])) {
                        $result[$cat][] = [
                            'id' => (string)$tip['id'],
                            'title' => $tip['title'],
                            'message' => $tip['message'],
                            'priority' => in_array($tip['priority'], $validPriorities) ? $tip['priority'] : 'low',
                        ];
                    }
                }
            }
        }
        
        return $result;
    }
    
    /**
     * Generate rule-based spending tips as fallback
     */
    protected function generateRuleBasedSpendingTips(array $data): array
    {
        $summary = $data['summary'] ?? [];
        $income = $summary['totalPemasukan'] ?? 0;
        $expense = $summary['totalPengeluaran'] ?? 0;
        $net = $summary['neto'] ?? 0;
        $spendingByCategory = $data['spendingByCategory'] ?? [];
        $savingGoals = $data['saving_goals'] ?? [];
        
        $tips = [
            'budget_tips' => [],
            'category_tips' => [],
            'saving_tips' => [],
            'warnings' => []
        ];
        
        // Budget tips
        if ($income > 0) {
            $ratio = $expense / $income;
            if ($ratio > 1) {
                $tips['budget_tips'][] = [
                    'id' => 'budget_1',
                    'title' => 'Pengeluaran Melebihi Pemasukan',
                    'message' => 'Segera kurangi pengeluaran! Selisih: Rp ' . number_format(abs($net), 0, ',', '.'),
                    'priority' => 'high'
                ];
            } elseif ($ratio > 0.9) {
                $tips['budget_tips'][] = [
                    'id' => 'budget_2',
                    'title' => 'Budget Kritis',
                    'message' => 'Pengeluaran sudah mencapai ' . round($ratio*100) . '% dari pemasukan. Kurangi pengeluaran non-esensial.',
                    'priority' => 'high'
                ];
            } else {
                $tips['budget_tips'][] = [
                    'id' => 'budget_3',
                    'title' => 'Anggaran Aman',
                    'message' => 'Pengeluaran Anda ' . round($ratio*100) . '% dari pemasukan. Pertahankan pola ini!',
                    'priority' => 'low'
                ];
            }
        }
        
        // Category tips
        foreach (array_slice($spendingByCategory, 0, 3) as $index => $cat) {
            if ($cat['persentase'] > 20) {
                $tips['category_tips'][] = [
                    'id' => 'category_' . ($index + 1),
                    'title' => 'Pengeluaran ' . $cat['namaKategori'] . ' Tinggi',
                    'message' => 'Kategori ' . $cat['namaKategori'] . ' menghabiskan ' . $cat['persentase'] . '% total pengeluaran. Coba batasi pengeluaran di kategori ini.',
                    'priority' => $cat['persentase'] > 30 ? 'high' : 'medium'
                ];
            }
        }
        
        // Saving tips
        if (empty($savingGoals)) {
            $tips['saving_tips'][] = [
                'id' => 'saving_1',
                'title' => 'Buat Target Menabung',
                'message' => 'Anda belum memiliki target menabung aktif. Yuk buat di menu Target Menabung!',
                'priority' => 'low'
            ];
        } else {
            foreach ($savingGoals as $goal) {
                if ($goal['is_near_deadline']) {
                    $tips['saving_tips'][] = [
                        'id' => 'saving_2',
                        'title' => 'Deadline Target Dekat',
                        'message' => 'Target ' . $goal['nama_target'] . ' akan berakhir dalam 7 hari. Segera kejar target Anda!',
                        'priority' => 'high'
                    ];
                } elseif ($goal['is_overdue']) {
                    $tips['saving_tips'][] = [
                        'id' => 'saving_3',
                        'title' => 'Deadline Target Terlewat',
                        'message' => 'Target ' . $goal['nama_target'] . ' sudah melewati deadline. Evaluasi target Anda!',
                        'priority' => 'medium'
                    ];
                }
            }
        }
        
        // Warnings
        if ($expense > $income) {
            $tips['warnings'][] = [
                'id' => 'warning_1',
                'title' => 'Defisit Keuangan',
                'message' => 'Pengeluaran melebihi pemasukan sebesar Rp ' . number_format(abs($net), 0, ',', '.'),
                'priority' => 'high'
            ];
        }
        
        return $tips;
    }
}
