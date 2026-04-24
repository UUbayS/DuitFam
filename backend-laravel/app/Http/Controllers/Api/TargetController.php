<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContributeTargetRequest;
use App\Http\Requests\StoreTargetRequest;
use App\Models\GoalContribution;
use App\Models\Mongo\NotificationFeed;
use App\Models\ParentChildRelation;
use App\Models\SavingGoal;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Services\MongoAuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TargetController extends Controller
{
    public function __construct(private readonly MongoAuditService $mongoAuditService) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $childId = $request->query('child_id');
        $targetUserIds = [(string) $user->id];

        if ($user->role === config('constants.roles.parent')) {
            if ($childId) {
                $hasRelation = ParentChildRelation::query()
                    ->where('parent_id', (string) $user->id)
                    ->where('child_id', (string) $childId)
                    ->where('is_active', true)
                    ->exists();
                if (! $hasRelation) {
                    return response()->json(['message' => 'Akun anak tidak ditemukan atau tidak aktif.'], 404);
                }
                $targetUserIds = [(string) $childId];
            } else {
                // Get all active children IDs
                $childrenIds = ParentChildRelation::query()
                    ->where('parent_id', (string) $user->id)
                    ->where('is_active', true)
                    ->pluck('child_id')
                    ->toArray();
                $targetUserIds = array_merge($targetUserIds, $childrenIds);
            }
        }

        $goals = SavingGoal::whereIn('user_id', $targetUserIds)
            ->latest()
            ->get()
            ->map(function ($goal) {
            $target = (float) $goal->target_jumlah;
            $collected = (float) ($goal->jumlah_terkumpul ?? 0);
            $progress = $target > 0 ? round(($collected / $target) * 100, 2) : 0;

            return [
                'id_target' => (string) $goal->id,
                'id_user' => (string) $goal->user_id,
                'nama_target' => $goal->nama_target,
                'target_jumlah' => (float) $goal->target_jumlah,
                'jumlah_terkumpul' => $collected,
                'tanggal_target' => $goal->tanggal_target,
                'status' => $goal->status,
                'created_at' => $goal->created_at,
                'updated_at' => $goal->updated_at,
                'progress' => $progress,
                'sisa' => max(0, $target - $collected),
            ];
        });

        return response()->json(['message' => 'Berhasil mengambil target.', 'data' => $goals]);
    }

    public function store(StoreTargetRequest $request)
    {
        $user = $request->user();
        $targetUserId = (string) $user->id;
        $childId = $request->input('child_id');
        if ($user->role === config('constants.roles.parent') && $childId) {
            $hasRelation = ParentChildRelation::query()
                ->where('parent_id', (string) $user->id)
                ->where('child_id', (string) $childId)
                ->where('is_active', true)
                ->exists();
            if (! $hasRelation) {
                return response()->json(['message' => 'Akun anak tidak ditemukan atau tidak aktif.'], 404);
            }
            $targetUserId = (string) $childId;
        }

        SavingGoal::create([
            'user_id' => $targetUserId,
            'nama_target' => $request->input('nama_target'),
            'target_jumlah' => $request->input('target_jumlah'),
            'tanggal_target' => $request->input('tanggal_target'),
            'jumlah_terkumpul' => 0,
            'status' => config('constants.goal_status.aktif'),
        ]);

        return response()->json(['message' => 'Target berhasil dibuat.'], 201);
    }

    public function update(Request $request, string $id)
    {
        $user = $request->user();
        $goal = SavingGoal::where('_id', $id)->firstOrFail();
        $isOwner = (string) $goal->user_id === (string) $user->id;
        $canParentManage = $user->role === config('constants.roles.parent') && ParentChildRelation::query()
            ->where('parent_id', (string) $user->id)
            ->where('child_id', (string) $goal->user_id)
            ->where('is_active', true)
            ->exists();

        if (! $isOwner && ! $canParentManage) {
            return response()->json(['message' => 'Tidak punya akses.'], 403);
        }

        $validated = $request->validate([
            'nama_target' => ['sometimes', 'string', 'max:255'],
            'target_jumlah' => ['sometimes', 'numeric', 'min:1'],
            'tanggal_target' => ['sometimes', 'date'],
            'status' => ['sometimes', 'in:'.config('constants.goal_status.aktif').','.config('constants.goal_status.tercapai').','.config('constants.goal_status.batal')],
        ]);

        $goal->update($validated);

        return response()->json(['message' => 'Target berhasil diperbarui.']);
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();
        $goal = SavingGoal::where('_id', $id)->firstOrFail();
        $isOwner = (string) $goal->user_id === (string) $user->id;
        $canParentManage = $user->role === config('constants.roles.parent') && ParentChildRelation::query()
            ->where('parent_id', (string) $user->id)
            ->where('child_id', (string) $goal->user_id)
            ->where('is_active', true)
            ->exists();

        if (! $isOwner && ! $canParentManage) {
            return response()->json(['message' => 'Tidak punya akses.'], 403);
        }

        DB::connection('mongodb')->beginTransaction();

        try {
            $refundAmount = (float) ($goal->jumlah_terkumpul ?? 0);
            if ($refundAmount > 0) {
                $wallet = Wallet::where('user_id', (string) $goal->user_id)->first();
                if ($wallet) {
                    $wallet->saldo_sekarang = ((float) $wallet->saldo_sekarang) + $refundAmount;
                    $wallet->save();

                    Transaction::create([
                        'user_id' => (string) $goal->user_id,
                        'category_id' => null,
                        'jenis' => config('constants.transaction_types.refund'),
                        'status' => config('constants.transaction_status.berhasil'),
                        'jumlah' => $refundAmount,
                        'tanggal' => now()->toDateString(),
                        'keterangan' => 'Refund penghapusan kantong: ' . $goal->nama_target,
                    ]);
                }
            }

            $goal->delete();

            DB::connection('mongodb')->commit();

            return response()->json(['message' => 'Target berhasil dihapus permanen dan saldo dikembalikan ke wallet utama.']);
        } catch (\Exception $e) {
            DB::connection('mongodb')->rollBack();
            throw $e;
        }
    }

    public function contribute(ContributeTargetRequest $request)
    {
        $user = $request->user();
        $goal = SavingGoal::where('_id', $request->input('id_target'))->where('user_id', (string) $user->id)->firstOrFail();
        $amount = (float) $request->input('jumlah');
        $wallet = Wallet::where('user_id', (string) $user->id)->firstOrFail();
        if ((float) $wallet->saldo_sekarang < $amount) {
            throw ValidationException::withMessages(['jumlah' => ['Saldo utama tidak mencukupi.']]);
        }

        DB::connection('mongodb')->beginTransaction();

        try {
            $wallet->saldo_sekarang = ((float) $wallet->saldo_sekarang) - $amount;
            $wallet->save();
            $goal->jumlah_terkumpul = ((float) $goal->jumlah_terkumpul) + $amount;
            if ((float) $goal->jumlah_terkumpul >= (float) $goal->target_jumlah) {
                $goal->status = config('constants.goal_status.tercapai');
            }
            $goal->save();
            GoalContribution::create(['saving_goal_id' => (string) $goal->id, 'user_id' => (string) $user->id, 'jumlah' => $amount, 'contributed_at' => now()]);
            Transaction::create(['user_id' => (string) $user->id, 'category_id' => null, 'jenis' => config('constants.transaction_types.menabung'), 'status' => config('constants.transaction_status.berhasil'), 'jumlah' => $amount, 'tanggal' => now()->toDateString(), 'keterangan' => 'Kontribusi Target: '.$goal->nama_target, 'source_id' => (string) $goal->id]);
            NotificationFeed::create(['user_id' => (string) $user->id, 'title' => 'Kontribusi target', 'message' => 'Kontribusi ke target '.$goal->nama_target.' berhasil.', 'read_at' => null, 'meta' => ['goal_id' => (string) $goal->id]]);
            $this->mongoAuditService->log($request, $user->id, 'goal.contributed', [
                'goal_id' => $goal->id,
                'amount' => $amount,
            ]);

            DB::connection('mongodb')->commit();

            return response()->json(['message' => 'Kontribusi berhasil!']);
        } catch (\Exception $e) {
            DB::connection('mongodb')->rollBack();
            throw $e;
        }
    }

    public function withdraw(Request $request)
    {
        $request->validate([
            'id_target' => ['required', 'string'],
            'jumlah' => ['required', 'numeric', 'min:1'],
        ]);

        $user = $request->user();
        $goal = SavingGoal::where('_id', $request->input('id_target'))->where('user_id', (string) $user->id)->firstOrFail();
        $amount = (float) $request->input('jumlah');

        if ((float) $goal->jumlah_terkumpul < $amount) {
            throw ValidationException::withMessages(['jumlah' => ['Saldo di kantong tabungan tidak mencukupi.']]);
        }

        DB::connection('mongodb')->beginTransaction();

        try {
            $wallet = Wallet::where('user_id', (string) $user->id)->firstOrFail();

            $wallet->saldo_sekarang = ((float) $wallet->saldo_sekarang) + $amount;
            $wallet->save();

            $goal->jumlah_terkumpul = ((float) $goal->jumlah_terkumpul) - $amount;
            if ($goal->status === config('constants.goal_status.tercapai') && (float) $goal->jumlah_terkumpul < (float) $goal->target_jumlah) {
                $goal->status = config('constants.goal_status.aktif');
            }
            $goal->save();

            Transaction::create([
                'user_id' => (string) $user->id,
                'category_id' => null,
                'jenis' => config('constants.transaction_types.refund'),
                'status' => config('constants.transaction_status.berhasil'),
                'jumlah' => $amount,
                'tanggal' => now()->toDateString(),
                'keterangan' => 'Ambil uang dari Kantong: '.$goal->nama_target
            ]);

            DB::connection('mongodb')->commit();

            return response()->json(['message' => 'Berhasil mengambil uang dari kantong tabungan!']);
        } catch (\Exception $e) {
            DB::connection('mongodb')->rollBack();
            throw $e;
        }
    }
}
