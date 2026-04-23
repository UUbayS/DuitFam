<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTransactionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>|string>
     */
    public function rules(): array
    {
        return [
            'jenis' => ['required', 'in:pemasukan,pengeluaran,menabung,refund'],
            'jumlah' => ['required', 'numeric', 'min:1'],
            'tanggal' => ['required', 'date'],
            'keterangan' => ['nullable', 'string', 'max:1000'],
            'id_kategori' => ['nullable', 'string'],
            'source_id' => ['nullable', 'string'],
        ];
    }
}
