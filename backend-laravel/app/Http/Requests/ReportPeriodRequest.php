<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReportPeriodRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'month' => ['nullable', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'month.regex' => 'Format month harus YYYY-MM (contoh: 2026-06).',
            'start_date.date_format' => 'Format start_date harus YYYY-MM-DD.',
            'end_date.date_format' => 'Format end_date harus YYYY-MM-DD.',
            'end_date.after_or_equal' => 'end_date tidak boleh sebelum start_date.',
            'page.min' => 'page minimal 1.',
            'per_page.max' => 'per_page maksimal 100.',
        ];
    }
}
