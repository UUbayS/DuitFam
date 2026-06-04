<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BulkCancelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'ids.required' => 'Minimal satu ID transaksi harus diberikan.',
            'ids.array' => 'Format IDs tidak valid.',
            'ids.min' => 'Minimal satu ID transaksi harus diberikan.',
            'ids.max' => 'Maksimal 100 transaksi per aksi.',
        ];
    }
}
