<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTargetRequest extends FormRequest
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
            'nama_target' => ['required', 'string', 'max:255'],
            'target_jumlah' => ['required', 'numeric', 'min:1'],
            'tanggal_target' => ['required', 'date'],
            'child_id' => ['nullable', 'string'],
        ];
    }
}
