<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ParentChildRelation;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function updateProfile(Request $request)
    {
        $validated = $request->validate([
            'username' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'ends_with:@gmail.com'],
            'profile_photo' => ['nullable', 'string', 'max:2048'],
        ]);
        if (! empty($validated['username']) && User::where('username', $validated['username'])->where('_id', '!=', (string) $request->user()->id)->exists()) {
            return response()->json(['message' => 'Username sudah dipakai.'], 409);
        }
        if (! empty($validated['email']) && User::where('email', $validated['email'])->where('_id', '!=', (string) $request->user()->id)->exists()) {
            return response()->json(['message' => 'Email sudah dipakai.'], 409);
        }

        $request->user()->update($validated);

        return response()->json(['message' => 'Profil berhasil diperbarui.']);
    }

    public function updatePassword(Request $request)
    {
        $validated = $request->validate([
            'currentPassword' => ['required', 'string'],
            'newPassword' => ['required', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/'],
        ]);

        if (! Hash::check($validated['currentPassword'], $request->user()->password)) {
            return response()->json(['message' => 'Password lama tidak sesuai.'], 400);
        }

        $request->user()->update(['password' => Hash::make($validated['newPassword'])]);

        return response()->json(['message' => 'Password berhasil diperbarui.']);
    }

    public function linkChild(Request $request)
    {
        if ($request->user()->role !== 'parent') {
            return response()->json(['message' => 'Hanya akun parent yang dapat menambah anak.'], 403);
        }

        $validated = $request->validate([
            'child_email' => ['required', 'email'],
        ]);

        $child = User::where('email', $validated['child_email'])->where('role', 'child')->first();
        if (! $child) {
            return response()->json(['message' => 'Akun child tidak ditemukan.'], 404);
        }

        ParentChildRelation::firstOrCreate([
            'parent_id' => $request->user()->id,
            'child_id' => $child->id,
        ], ['is_active' => true]);

        return response()->json(['message' => 'Akun anak berhasil ditautkan.']);
    }

    public function createChild(Request $request)
    {
        if ($request->user()->role !== 'parent') {
            return response()->json(['message' => 'Hanya akun parent yang dapat membuat akun anak.'], 403);
        }

        $validated = $request->validate([
            'username' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/'],
            'saldo_awal' => ['nullable', 'numeric', 'min:0'],
        ]);
        if (User::where('username', $validated['username'])->exists()) {
            return response()->json(['message' => 'Username sudah dipakai.'], 409);
        }
        if (User::where('email', $validated['email'])->exists()) {
            return response()->json(['message' => 'Email sudah dipakai.'], 409);
        }

        $child = User::create([
            'username' => $validated['username'],
            'email' => $validated['email'],
            'role' => 'child',
            'password' => Hash::make($validated['password']),
            'is_active' => true,
        ]);
        Wallet::firstOrCreate(
            ['user_id' => (string) $child->id],
            ['saldo_sekarang' => $validated['saldo_awal'] ?? 0]
        );
        ParentChildRelation::firstOrCreate([
            'parent_id' => (string) $request->user()->id,
            'child_id' => (string) $child->id,
        ], ['is_active' => true]);

        return response()->json(['message' => 'Akun anak berhasil dibuat.', 'data' => [
            'id' => (string) $child->id,
            'username' => $child->username,
            'email' => $child->email,
            'is_active' => (bool) ($child->is_active ?? true),
        ]], 201);
    }

    public function updateChild(Request $request, string $id)
    {
        if ($request->user()->role !== 'parent') {
            return response()->json(['message' => 'Hanya akun parent yang dapat mengubah akun anak.'], 403);
        }

        $hasRelation = ParentChildRelation::query()
            ->where('parent_id', (string) $request->user()->id)
            ->where('child_id', (string) $id)
            ->exists();
        if (! $hasRelation) {
            return response()->json(['message' => 'Akun anak tidak ditemukan.'], 404);
        }

        $child = User::where('_id', (string) $id)->where('role', 'child')->firstOrFail();
        $validated = $request->validate([
            'username' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email'],
            'password' => ['sometimes', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($validated['username']) && User::where('username', $validated['username'])->where('_id', '!=', (string) $child->id)->exists()) {
            return response()->json(['message' => 'Username sudah dipakai.'], 409);
        }
        if (isset($validated['email']) && User::where('email', $validated['email'])->where('_id', '!=', (string) $child->id)->exists()) {
            return response()->json(['message' => 'Email sudah dipakai.'], 409);
        }
        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $child->update($validated);

        return response()->json(['message' => 'Akun anak berhasil diperbarui.']);
    }

    public function toggleChild(Request $request, string $id)
    {
        if ($request->user()->role !== 'parent') {
            return response()->json(['message' => 'Hanya akun parent yang dapat menonaktifkan akun anak.'], 403);
        }

        $relation = ParentChildRelation::query()
            ->where('parent_id', (string) $request->user()->id)
            ->where('child_id', (string) $id)
            ->first();
        if (! $relation) {
            return response()->json(['message' => 'Akun anak tidak ditemukan.'], 404);
        }

        $relation->is_active = ! (bool) $relation->is_active;
        $relation->save();
        User::where('_id', (string) $id)->update(['is_active' => (bool) $relation->is_active]);

        return response()->json(['message' => $relation->is_active ? 'Akun anak diaktifkan.' : 'Akun anak dinonaktifkan.']);
    }

    public function children(Request $request)
    {
        if ($request->user()->role !== 'parent') {
            return response()->json(['message' => 'Hanya akun parent yang dapat melihat daftar anak.'], 403);
        }

        $children = ParentChildRelation::query()
            ->where('parent_id', $request->user()->id)
            ->get()
            ->map(function ($relation) {
                $child = User::where('_id', $relation->child_id)->first();
                if (! $child) {
                    return null;
                }

                return [
                    'id' => (string) $child->id,
                    'username' => $child->username,
                    'email' => $child->email,
                    'is_active' => (bool) ($relation->is_active ?? false),
                ];
            })
            ->filter()
            ->values();

        return response()->json(['message' => 'OK', 'data' => $children]);
    }

    public function childrenBalances(Request $request)
    {
        if ($request->user()->role !== 'parent') {
            return response()->json(['message' => 'Hanya akun parent yang dapat melihat saldo anak.'], 403);
        }

        $relations = ParentChildRelation::query()->where('parent_id', (string) $request->user()->id)->get();
        $childIds = $relations->pluck('child_id')->map(fn ($id) => (string) $id)->values();
        $walletMap = Wallet::query()
            ->whereIn('user_id', $childIds->all())
            ->get()
            ->keyBy('user_id');

        $data = $relations->map(function ($relation) use ($walletMap) {
            $child = User::where('_id', (string) $relation->child_id)->first();
            if (! $child) {
                return null;
            }
            $wallet = $walletMap[(string) $child->id] ?? null;

            return [
                'id' => (string) $child->id,
                'username' => $child->username,
                'email' => $child->email,
                'is_active' => (bool) ($relation->is_active ?? false),
                'saldo' => (float) ($wallet?->saldo_sekarang ?? 0),
            ];
        })->filter()->values();

        return response()->json(['message' => 'OK', 'data' => $data]);
    }

    public function deleteChild(Request $request, string $id)
    {
        if ($request->user()->role !== 'parent') {
            return response()->json(['message' => 'Hanya akun parent yang dapat menghapus akun anak.'], 403);
        }

        $relation = ParentChildRelation::query()
            ->where('parent_id', (string) $request->user()->id)
            ->where('child_id', (string) $id)
            ->first();
        if (! $relation) {
            return response()->json(['message' => 'Akun anak tidak ditemukan.'], 404);
        }

        $child = User::where('_id', (string) $id)->where('role', 'child')->first();
        if ($child) {
            // Cleanup child data
            Wallet::where('user_id', (string) $id)->delete();
            $child->delete();
        }

        $relation->delete();

        return response()->json(['message' => 'Akun anak berhasil dihapus.']);
    }
}
