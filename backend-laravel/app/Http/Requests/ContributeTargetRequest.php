<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ContributeTargetRequest extends FormRequest
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
            'id_target' => ['required', 'exists:saving_goals,id'],
            'jumlah' => ['required', 'numeric', 'min:1'],
        ];
    }
}
