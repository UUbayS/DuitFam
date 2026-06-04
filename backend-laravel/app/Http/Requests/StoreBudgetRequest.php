<?php

namespace App\Http\Requests;

use App\Models\Category;
use App\Models\ParentChildRelation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;

class StoreBudgetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['required', 'string'],
            'category_id' => ['required', 'string'],
            'jumlah' => ['required', 'numeric', 'min:0'],
            'periode_bulan' => ['required', 'regex:/^\d{4}-\d{2}$/'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($v) {
            $user = $this->user();
            $targetUserId = (string) $this->input('user_id');

            if ($targetUserId !== (string) $user->id) {
                if ($user->role !== config('constants.roles.parent')) {
                    $v->errors()->add('user_id', 'Anda hanya dapat mengatur anggaran untuk akun sendiri.');
                    return;
                }
                $isChild = ParentChildRelation::query()
                    ->where('parent_id', (string) $user->id)
                    ->where('child_id', $targetUserId)
                    ->where('is_active', true)
                    ->exists();
                if (! $isChild) {
                    $v->errors()->add('user_id', 'Akun tersebut bukan anak Anda.');
                }
            }

            $categoryId = $this->input('category_id');
            if ($categoryId && ! Category::where('_id', (string) $categoryId)->exists()) {
                $v->errors()->add('category_id', 'Kategori tidak valid.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'jumlah.min' => 'Anggaran tidak boleh negatif.',
            'periode_bulan.regex' => 'Format periode harus YYYY-MM.',
        ];
    }
}
