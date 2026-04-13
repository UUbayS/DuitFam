<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class GroqService
{
    /**
     * Send chat message to local LLM (Gemma 4 via Ollama)
     * DISABLED: Using smart rule-based responses instead (0.5b model is too inaccurate)
     */
    public function chat(string $message, array $context = []): ?string
    {
        return null; // Skip LLM, use controller's fallback
    }

    /**
     * Generate spending alerts based on financial data
     */
    public function generateSpendingAlerts(array $financialData): array
    {
        return $this->generateRuleBasedAlerts($financialData);
    }

    /**
     * Generate financial advice
     */
    public function generateFinancialAdvice(
        array $financialData,
        string $question,
    ): ?string {
        return null; // Skip LLM, let controller handle it
    }

    /**
     * Generate rule-based alerts
     */
    protected function generateRuleBasedAlerts(array $data): array
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
                    "message" =>
                        "Pengeluaran Anda melebihi pemasukan sebesar Rp " .
                        number_format(abs($net), 0, ",", ".") .
                        ". Segera kurangi pengeluaran!",
                    "severity" => "high",
                    "amount" => abs($net),
                ];
            } elseif ($ratio > 0.9) {
                $alerts[] = [
                    "type" => "warning",
                    "title" => "⚠️ Pengeluaran Hampir Melebihi Pemasukan",
                    "message" =>
                        "Anda sudah mengeluarkan " .
                        round($ratio * 100) .
                        "% dari pemasukan. Sisa budget sangat tipis!",
                    "severity" => "high",
                    "amount" => $expense,
                ];
            } elseif ($ratio < 0.7) {
                $alerts[] = [
                    "type" => "success",
                    "title" => "✅ Keuangan Sehat!",
                    "message" =>
                        "Bagus! Anda hanya mengeluarkan " .
                        round($ratio * 100) .
                        "% dari pemasukan. Bisa menabung lebih banyak.",
                    "severity" => "low",
                ];
            }
        }

        // Category alerts
        foreach ($spendingByCategory as $category) {
            if (($category["persentase"] ?? 0) > 30) {
                $alerts[] = [
                    "type" => "warning",
                    "title" => "📊 {$category["namaKategori"]} Terlalu Tinggi",
                    "message" =>
                        "{$category["namaKategori"]} menghabiskan Rp " .
                        number_format($category["jumlah"], 0, ",", ".") .
                        " ({$category["persentase"]}% dari total)",
                    "severity" => "medium",
                    "amount" => $category["jumlah"],
                ];
            }
        }

        return $alerts;
    }
}
