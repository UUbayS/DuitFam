<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ResetChildPasswordRequest;
use App\Models\Mongo\NotificationFeed;
use App\Models\ParentChildRelation;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Transaction;
use App\Models\SavingGoal;
use App\Models\GoalContribution;
use App\Models\WithdrawalRequest;
use App\Services\MongoAuditService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    use ApiResponseTrait;

    public function updateProfile(Request $request)
    {
        try {
            $validated = $request->validate([
                'username' => ['nullable', 'string', 'max:255'],
                'email' => ['nullable', 'email'],
                'profile_photo' => ['nullable', 'string', 'max:2048', 'regex:/^(https?:\/\/|data:image\/(jpeg|png|webp|gif);base64,)/i'],
            ]);
            if (! empty($validated['username']) && User::where('username', $validated['username'])->where('_id', '!=', (string) $request->user()->id)->exists()) {
                return $this->errorResponse('Username sudah dipakai.', [], 409);
            }
            if (! empty($validated['email']) && User::where('email', $validated['email'])->where('_id', '!=', (string) $request->user()->id)->exists()) {
                return $this->errorResponse('Email sudah dipakai.', [], 409);
            }

            $request->user()->update($validated);

            return $this->successResponse(null, 'Profil berhasil diperbarui.');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Gagal memperbarui profil.', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->errorResponse('Gagal memperbarui profil.', [], 500);
        }
    }

    public function updatePassword(Request $request)
    {
        try {
            $validated = $request->validate([
                'currentPassword' => ['required', 'string'],
                'newPassword' => ['required', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/'],
            ]);

            if (! Hash::check($validated['currentPassword'], $request->user()->password)) {
                return $this->errorResponse('Password lama tidak sesuai.', [], 400);
            }

            $request->user()->update(['password' => Hash::make($validated['newPassword'])]);

            return $this->successResponse(null, 'Password berhasil diperbarui.');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Gagal memperbarui password.', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->errorResponse('Gagal memperbarui password.', [], 500);
        }
    }

    public function linkChild(Request $request)
    {
        try {
            if ($request->user()->role !== config('constants.roles.parent')) {
                return $this->errorResponse('Hanya akun parent yang dapat menambah anak.', [], 403);
            }

            $validated = $request->validate([
                'child_email' => ['required', 'email'],
            ]);

            $child = User::where('email', $validated['child_email'])->where('role', config('constants.roles.child'))->first();
            if (! $child) {
                return $this->errorResponse('Akun child tidak ditemukan.', [], 404);
            }

            ParentChildRelation::firstOrCreate([
                'parent_id' => $request->user()->id,
                'child_id' => $child->id,
            ], ['is_active' => true]);

            return $this->successResponse(null, 'Akun anak berhasil ditautkan.');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Gagal menautkan anak.', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->errorResponse('Gagal menautkan anak.', [], 500);
        }
    }

    public function createChild(Request $request)
    {
        try {
            if ($request->user()->role !== config('constants.roles.parent')) {
                return $this->errorResponse('Hanya akun parent yang dapat membuat akun anak.', [], 403);
            }

            $validated = $request->validate([
                'username' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email'],
                'password' => ['required', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/'],
                'saldo_awal' => ['nullable', 'numeric', 'min:0'],
            ]);
            if (User::where('username', $validated['username'])->exists()) {
                return $this->errorResponse('Username sudah dipakai.', [], 409);
            }
            if (User::where('email', $validated['email'])->exists()) {
                return $this->errorResponse('Email sudah dipakai.', [], 409);
            }

            $child = User::create([
                'username' => $validated['username'],
                'email' => $validated['email'],
                'role' => config('constants.roles.child'),
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

            return $this->successResponse([
                'id' => (string) $child->id,
                'username' => $child->username,
                'email' => $child->email,
                'is_active' => (bool) ($child->is_active ?? true),
            ], 'Akun anak berhasil dibuat.', 201);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Gagal membuat akun anak.', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->errorResponse('Gagal membuat akun anak.', [], 500);
        }
    }

    public function updateChild(Request $request, string $id)
    {
        try {
            if ($request->user()->role !== config('constants.roles.parent')) {
                return $this->errorResponse('Hanya akun parent yang dapat mengubah akun anak.', [], 403);
            }

            $hasRelation = ParentChildRelation::query()
                ->where('parent_id', (string) $request->user()->id)
                ->where('child_id', (string) $id)
                ->exists();
            if (! $hasRelation) {
                return $this->errorResponse('Akun anak tidak ditemukan.', [], 404);
            }

            $child = User::where('_id', (string) $id)->where('role', config('constants.roles.child'))->firstOrFail();
            $validated = $request->validate([
                'username' => ['sometimes', 'string', 'max:255'],
                'email' => ['sometimes', 'email'],
                'password' => ['sometimes', 'string', 'min:8', 'regex:/[A-Z]/', 'regex:/\d/'],
                'is_active' => ['sometimes', 'boolean'],
            ]);

            if (isset($validated['username']) && User::where('username', $validated['username'])->where('_id', '!=', (string) $child->id)->exists()) {
                return $this->errorResponse('Username sudah dipakai.', [], 409);
            }
            if (isset($validated['email']) && User::where('email', $validated['email'])->where('_id', '!=', (string) $child->id)->exists()) {
                return $this->errorResponse('Email sudah dipakai.', [], 409);
            }
            if (isset($validated['password'])) {
                $validated['password'] = Hash::make($validated['password']);
            }

            $child->update($validated);

            return $this->successResponse(null, 'Akun anak berhasil diperbarui.');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Gagal memperbarui akun anak.', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->errorResponse('Gagal memperbarui akun anak.', [], 500);
        }
    }

    public function toggleChild(Request $request, string $id)
    {
        try {
            if ($request->user()->role !== config('constants.roles.parent')) {
                return $this->errorResponse('Hanya akun parent yang dapat menonaktifkan akun anak.', [], 403);
            }

            $relation = ParentChildRelation::query()
                ->where('parent_id', (string) $request->user()->id)
                ->where('child_id', (string) $id)
                ->first();
            if (! $relation) {
                return $this->errorResponse('Akun anak tidak ditemukan.', [], 404);
            }

            $relation->is_active = ! (bool) $relation->is_active;
            $relation->save();
            User::where('_id', (string) $id)->update(['is_active' => (bool) $relation->is_active]);

            return $this->successResponse(null, $relation->is_active ? 'Akun anak diaktifkan.' : 'Akun anak dinonaktifkan.');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Gagal mengubah status akun anak.', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->errorResponse('Gagal mengubah status akun anak.', [], 500);
        }
    }

    public function children(Request $request)
    {
        try {
            if ($request->user()->role !== config('constants.roles.parent')) {
                return $this->errorResponse('Hanya akun parent yang dapat melihat daftar anak.', [], 403);
            }

            $relations = ParentChildRelation::query()
                ->where('parent_id', $request->user()->id)
                ->get();

            $childIds = $relations->pluck('child_id')->map(fn($id) => (string) $id)->all();
            $childMap = User::whereIn('_id', $childIds)->get()->keyBy(fn($u) => (string) $u->id);

            $children = $relations->map(function ($relation) use ($childMap) {
                $child = $childMap[(string) $relation->child_id] ?? null;
                if (!$child) return null;

                return [
                    'id' => (string) $child->id,
                    'username' => $child->username,
                    'email' => $child->email,
                    'is_active' => (bool) ($relation->is_active ?? false),
                ];
            })->filter()->values();

            return $this->successResponse($children, 'OK');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Gagal mengambil daftar anak.', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->errorResponse('Gagal mengambil daftar anak.', [], 500);
        }
    }

    public function childrenBalances(Request $request)
    {
        try {
            if ($request->user()->role !== config('constants.roles.parent')) {
                return $this->errorResponse('Hanya akun parent yang dapat melihat saldo anak.', [], 403);
            }

            $relations = ParentChildRelation::query()->where('parent_id', (string) $request->user()->id)->get();
            $childIds = $relations->pluck('child_id')->map(fn($id) => (string) $id)->values();
            
            $childMap = User::whereIn('_id', $childIds->all())->get()->keyBy(fn($u) => (string) $u->id);
            $walletMap = Wallet::query()
                ->whereIn('user_id', $childIds->all())
                ->get()
                ->keyBy('user_id');

            $data = $relations->map(function ($relation) use ($childMap, $walletMap) {
                $child = $childMap[(string) $relation->child_id] ?? null;
                if (!$child) return null;
                $wallet = $walletMap[(string) $child->id] ?? null;

                return [
                    'id' => (string) $child->id,
                    'username' => $child->username,
                    'email' => $child->email,
                    'is_active' => (bool) ($relation->is_active ?? false),
                    'saldo' => (float) ($wallet?->saldo_sekarang ?? 0),
                ];
            })->filter()->values();

            return $this->successResponse($data, 'OK');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Gagal mengambil saldo anak.', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->errorResponse('Gagal mengambil saldo anak.', [], 500);
        }
    }

    public function deleteChild(Request $request, string $id)
    {
        try {
            if ($request->user()->role !== config('constants.roles.parent')) {
                return $this->errorResponse('Hanya akun parent yang dapat menghapus akun anak.', [], 403);
            }

            $relation = ParentChildRelation::query()
                ->where('parent_id', (string) $request->user()->id)
                ->where('child_id', (string) $id)
                ->first();
            if (! $relation) {
                return $this->errorResponse('Akun anak tidak ditemukan.', [], 404);
            }

            $child = User::where('_id', (string) $id)->where('role', config('constants.roles.child'))->first();
            if ($child) {
                // Cleanup child data
                Wallet::where('user_id', (string) $id)->delete();
                Transaction::where('user_id', (string) $id)->delete();
                SavingGoal::where('user_id', (string) $id)->delete();
                GoalContribution::where('user_id', (string) $id)->delete();
                NotificationFeed::where('user_id', (string) $id)->delete();
                WithdrawalRequest::where('child_id', (string) $id)->delete();
                $child->delete();
            }

            $relation->delete();

            return $this->successResponse(null, 'Akun anak berhasil dihapus.');
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Gagal menghapus akun anak.', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return $this->errorResponse('Gagal menghapus akun anak.', [], 500);
        }
    }

    public function resetChildPassword(ResetChildPasswordRequest $request, string $id)
    {
        $parent = $request->user();

        // 1. Cek apakah parent
        if ($parent->role !== config('constants.roles.parent')) {
            return response()->json(['message' => 'Hanya akun parent yang dapat mereset password anak.'], 403);
        }

        // 2. Cek apakah child terhubung dengan parent ini
        $relation = ParentChildRelation::query()
            ->where('parent_id', (string) $parent->id)
            ->where('child_id', (string) $id)
            ->first();

        if (!$relation) {
            return response()->json(['message' => 'Akun anak tidak ditemukan.'], 404);
        }

        // 3. Ambil data child
        $child = User::where('_id', (string) $id)->where('role', config('constants.roles.child'))->firstOrFail();

        // 4. Update password (sudah tervalidasi di Form Request)
        $child->password = Hash::make($request->password);
        $child->save();

        // 5. Kirim notifikasi ke anak (hanya NotificationFeed)
        NotificationFeed::create([
            'user_id' => (string) $child->id,
            'title' => 'Password Direset',
            'message' => 'Password akun Anda telah direset oleh orang tua. Silakan gunakan password baru untuk login.',
            'read_at' => null,
            'meta' => [
                'reset_by' => (string) $parent->id,
                'reset_by_name' => $parent->username,
            ],
        ]);

        // 6. Audit log
        app(MongoAuditService::class)->log($request, $parent->id, 'child.password_reset', [
            'child_id' => (string) $child->id,
            'child_username' => $child->username,
        ]);

        return response()->json(['message' => 'Password anak berhasil direset.']);
    }
}
