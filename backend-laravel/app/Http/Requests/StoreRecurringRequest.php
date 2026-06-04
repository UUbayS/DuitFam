<?php

namespace App\Http\Requests;

use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;

class StoreRecurringRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_id' => ['required', 'string'],
            'jenis' => ['required', 'in:pemasukan,pengeluaran'],
            'jumlah' => ['required', 'numeric', 'min:1'],
            'keterangan' => ['nullable', 'string', 'max:255'],
            'frequency' => ['required', 'in:daily,weekly,monthly'],
            'day_of_week' => ['required_if:frequency,weekly', 'nullable', 'integer', 'between:1,7'],
            'day_of_month' => ['required_if:frequency,monthly', 'nullable', 'integer', 'between:1,31'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($v) {
            $categoryId = $this->input('category_id');
            if ($categoryId && ! Category::where('_id', (string) $categoryId)->exists()) {
                $v->errors()->add('category_id', 'Kategori tidak valid.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'day_of_week.required_if' => 'Hari (1=Senin, 7=Minggu) wajib untuk frekuensi mingguan.',
            'day_of_month.required_if' => 'Tanggal (1-31) wajib untuk frekuensi bulanan.',
            'end_date.after_or_equal' => 'Tanggal selesai harus setelah atau sama dengan tanggal mulai.',
        ];
    }
}
