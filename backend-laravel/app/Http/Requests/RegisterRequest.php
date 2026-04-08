<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
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
            'username' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'ends_with:@gmail.com'],
            'password' => ['required', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/'],
            'role' => ['nullable', 'in:parent'],
        ];
    }
}
