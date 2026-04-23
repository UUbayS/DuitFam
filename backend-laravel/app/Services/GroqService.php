<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;

class GroqService
{
    /**
     * Main method to generate financial advice using Triple-Tier Hybrid approach
     */
    public function generateFinancialAdvice(array $financialData, string $question, array $history = []): string
    {
        // Disable execution time limit for long AI processing (loading large local models)
        set_time_limit(0);

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
        
        $prompt = "Kamu adalah DuitFam AI Financial Advisor, asisten keuangan keluarga yang cerdas, ramah, dan solutif.\n\n";
        $prompt .= "KONTEKS KEUANGAN USER SAAT INI (Bulan " . Carbon::now()->format('F Y') . "):\n";
        $prompt .= "- Total Pemasukan: Rp {$income}\n";
        $prompt .= "- Total Pengeluaran: Rp {$expense}\n";
        $prompt .= "- Saldo Saat Ini: Rp {$balance}\n";
        $prompt .= "- Selisih (Net): Rp {$net}\n\n";
        
        $prompt .= "DATA KATEGORI PENGELUARAN:\n";
        foreach (array_slice($data['spendingByCategory'] ?? [], 0, 5) as $cat) {
            $amt = number_format($cat['jumlah'], 0, ',', '.');
            $prompt .= "- {$cat['namaKategori']}: Rp {$amt} ({$cat['persentase']}%)\n";
        }
        
        $prompt .= "\nFAKTA DARI SISTEM (Gunakan ini jika user bertanya spesifik):\n\"{$factContext}\"\n\n";
        
        $prompt .= "INSTRUKSI:\n";
        $prompt .= "1. Jawab dalam Bahasa Indonesia yang santai tapi profesional.\n";
        $prompt .= "2. Gunakan emoji agar chat terasa hidup.\n";
        $prompt .= "3. Jika pengeluaran > pemasukan, berikan peringatan tegas tapi sopan.\n";
        $prompt .= "4. Berikan saran praktis untuk menghemat atau menabung.\n";
        $prompt .= "5. JANGAN memberikan nasihat investasi saham/kripto yang berisiko tinggi.\n";
        $prompt .= "6. Selalu prioritaskan keamanan dana darurat.\n";
        $prompt .= "7. JAWAB LANGSUNG pada intinya. Hindari proses berpikir internal yang terlalu panjang.\n";
        $prompt .= "8. JANGAN gunakan tag <think> atau menuliskan proses berpikirmu. Tampilkan jawaban akhir saja.";

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

        $q = strtolower($question);

        if (str_contains($q, "pengeluaran") || str_contains($q, "spending") || str_contains($q, "habis")) {
            $resp = "Total pengeluaran Anda bulan ini Rp " . number_format($expense, 0, ',', '.') . ". ";
            if ($income > 0) {
                $ratio = round(($expense / $income) * 100);
                $resp .= "Anda sudah menghabiskan {$ratio}% dari pemasukan.";
            }
            return $resp;
        }

        if (str_contains($q, "budget") || str_contains($q, "anggaran") || str_contains($q, "bisa belanja")) {
            $avail = $income - $expense;
            return ($avail > 0) 
                ? "Sisa budget aman Anda adalah Rp " . number_format($avail, 0, ',', '.') 
                : "Budget Anda sudah habis! Pengeluaran melebihi pemasukan sebesar Rp " . number_format(abs($avail), 0, ',', '.');
        }

        if (str_contains($q, "saldo") || str_contains($q, "uang")) {
            return "Saldo Anda saat ini adalah Rp " . number_format($balance, 0, ',', '.') . ".";
        }

        // Default fact summary
        return "Bulan ini pemasukan Rp " . number_format($income, 0, ',', '.') . " dan pengeluaran Rp " . number_format($expense, 0, ',', '.') . ".";
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
}
