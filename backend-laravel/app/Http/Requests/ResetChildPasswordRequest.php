<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ResetChildPasswordRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'password' => [
                'required',
                'string',
                'min:8',
                'regex:/[A-Z]/',    // Harus ada huruf besar
                'regex:/\d/',      // Harus ada angka
                'confirmed'        // Cek password_confirmation
            ],
        ];
    }

    public function messages()
    {
        return [
            'password.required' => 'Password wajib diisi.',
            'password.min' => 'Password minimal 8 karakter.',
            'password.regex' => 'Password harus mengandung huruf besar dan angka.',
            'password.confirmed' => 'Konfirmasi password tidak sesuai.',
        ];
    }
}
