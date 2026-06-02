<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ApprovalActionRequest;
use App\Http\Requests\StoreWithdrawalRequest;
use App\Models\Mongo\NotificationFeed;
use App\Models\ParentChildRelation;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use App\Services\MongoAuditService;
use App\Traits\HasSafeMongoTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ApprovalController extends Controller
{
    use HasSafeMongoTransaction;

    public function __construct(private readonly MongoAuditService $mongoAuditService) {}

    public function store(StoreWithdrawalRequest $request)
    {
        $child = $request->user();
        if ($child->role !== config('constants.roles.child')) {
            return response()->json(['message' => 'Hanya akun anak dapat membuat pengajuan penarikan.'], 403);
        }

        $relation = ParentChildRelation::where('child_id', $child->id)->where('is_active', true)->first();
        if (! $relation) {
            return response()->json(['message' => 'Akun anak belum terhubung ke orang tua.'], 400);
        }

        WithdrawalRequest::create([
            'child_id' => $child->id,
            'parent_id' => $relation->parent_id,
            'amount' => $request->input('amount'),
            'reason' => $request->input('reason'),
            'status' => config('constants.transaction_status.pending'),
        ]);

        NotificationFeed::create([
            'user_id' => $relation->parent_id,
            'title' => 'Permintaan baru',
            'message' => 'Ada permintaan dana baru dari akun anak.',
            'read_at' => null,
            'meta' => ['child_id' => $child->id],
        ]);
        $this->mongoAuditService->log($request, $child->id, 'withdrawal.requested', [
            'parent_id' => $relation->parent_id,
            'amount' => (float) $request->input('amount'),
        ]);

        return response()->json(['message' => 'Permintaan berhasil dibuat.'], 201);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $query = WithdrawalRequest::query();
        if ($user->role === config('constants.roles.parent')) {
            $query->where('parent_id', $user->id);
        } else {
            $query->where('child_id', $user->id);
        }

        $data = $query->latest()
            ->limit(50)
            ->get(['_id', 'child_id', 'parent_id', 'amount', 'reason', 'rejection_reason', 'status', 'created_at'])
            ->map(function ($w) {
            return [
                'id' => (string) $w->id,
                'child_id' => (string) $w->child_id,
                'parent_id' => (string) $w->parent_id,
                'amount' => (float) $w->amount,
                'reason' => $w->reason,
                'rejection_reason' => $w->rejection_reason ?? null,
                'status' => $w->status,
                'created_at' => $w->created_at,
            ];
        });

        return response()->json(['message' => 'Berhasil mengambil data.', 'data' => $data]);
    }

    public function action(ApprovalActionRequest $request, string $id)
    {
        $parent = $request->user();
        if ($parent->role !== config('constants.roles.parent')) {
            return response()->json(['message' => 'Hanya orang tua dapat menyetujui/menolak.'], 403);
        }

        $withdrawal = WithdrawalRequest::where('_id', $id)->where('parent_id', (string) $parent->id)->firstOrFail();
        if ($withdrawal->status !== config('constants.transaction_status.pending')) {
            return response()->json(['message' => 'Permintaan ini sudah diproses.'], 400);
        }

        $action = $request->input('action');

        return $this->safeMongoTransaction(function () use ($request, $parent, $withdrawal, $action) {
            $parentWallet = null;

            if ($action === config('constants.transaction_status.approved')) {
                $parentWallet = Wallet::where('user_id', $withdrawal->parent_id)->firstOrFail();
                if ((float) $parentWallet->saldo_sekarang < (float) $withdrawal->amount) {
                    return response()->json(['message' => 'Saldo orang tua tidak mencukupi untuk menyetujui permintaan ini.'], 422);
                }
            }

            $withdrawal->status = $action;
            if ($action === 'rejected') {
                $withdrawal->rejection_reason = $request->input('reason', '');
            }
            $withdrawal->approved_by = (string) $parent->id;
            $withdrawal->approved_at = now();
            $withdrawal->save();

            if ($action === config('constants.transaction_status.approved')) {
                // 1. Kurangi saldo Orang Tua
                $parentWallet->saldo_sekarang = ((float) $parentWallet->saldo_sekarang) - (float) $withdrawal->amount;
                $parentWallet->save();

                // 2. Tambah saldo Anak
                $childWallet = Wallet::where('user_id', $withdrawal->child_id)->firstOrFail();
                $childWallet->saldo_sekarang = ((float) $childWallet->saldo_sekarang) + (float) $withdrawal->amount;
                $childWallet->save();

                // 3. Transaksi untuk Anak (Pemasukan)
                Transaction::create([
                    'user_id' => $withdrawal->child_id,
                    'jenis' => config('constants.transaction_types.pemasukan'),
                    'status' => config('constants.transaction_status.berhasil'),
                    'jumlah' => $withdrawal->amount,
                    'tanggal' => now()->toDateString(),
                    'keterangan' => 'Permintaan disetujui orang tua',
                    'is_internal' => true,
                ]);

                // 4. Transaksi untuk Orang Tua (Pengeluaran)
                Transaction::create([
                    'user_id' => $withdrawal->parent_id,
                    'jenis' => config('constants.transaction_types.pengeluaran'),
                    'status' => config('constants.transaction_status.berhasil'),
                    'jumlah' => $withdrawal->amount,
                    'tanggal' => now()->toDateString(),
                    'keterangan' => 'Permintaan disetujui untuk anak',
                    'is_internal' => true,
                ]);
            }

            NotificationFeed::create([
                'user_id' => $withdrawal->child_id,
                'title' => 'Status permintaan diperbarui',
                'message' => 'Permintaan Anda '.$withdrawal->status.'.',
                'read_at' => null,
                'meta' => ['withdrawal_id' => (string) $withdrawal->id, 'status' => $withdrawal->status],
            ]);
            $this->mongoAuditService->log($request, $parent->id, 'withdrawal.processed', [
                'withdrawal_id' => $withdrawal->id,
                'status' => $withdrawal->status,
            ]);

            return response()->json(['message' => 'Permintaan berhasil diproses.']);
        });
    }
}
