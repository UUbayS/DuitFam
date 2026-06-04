<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTransactionRequest;
use App\Models\Category;
use App\Models\Mongo\NotificationFeed;
use App\Models\ParentChildRelation;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\MongoAuditService;
use App\Traits\HasSafeMongoTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    use HasSafeMongoTransaction;

    public function __construct(private readonly MongoAuditService $mongoAuditService) {}

    public function store(StoreTransactionRequest $request)
    {
        $user = $request->user();
        $amount = (float) $request->input('jumlah');
        $jenis = $request->input('jenis');
        $categoryId = $request->input('id_kategori');
        $sourceId = $request->input('source_id');

        if ($categoryId && ! Category::where('_id', (string) $categoryId)->exists()) {
            throw ValidationException::withMessages(['id_kategori' => ['Kategori tidak valid.']]);
        }

        return $this->safeMongoTransaction(function () use ($request, $user, $amount, $jenis, $categoryId, $sourceId) {
            // Logic for Savings Goal as source
            if ($sourceId) {
                $goal = \App\Models\SavingGoal::where('_id', $sourceId)->where('user_id', (string) $user->id)->first();
                if (!$goal) {
                    throw ValidationException::withMessages(['source_id' => ['Kantong tabungan tidak ditemukan.']]);
                }

                if ($jenis === config('constants.transaction_types.pengeluaran') && (float)$goal->jumlah_terkumpul < $amount) {
                    throw ValidationException::withMessages(['jumlah' => ['Saldo di kantong tabungan tidak mencukupi.']]);
                }

                $goal->jumlah_terkumpul = ((float)$goal->jumlah_terkumpul) + ($jenis === config('constants.transaction_types.pemasukan') ? $amount : ($amount * -1));
                if ($goal->status === config('constants.goal_status.tercapai') && (float)$goal->jumlah_terkumpul < (float)$goal->target_jumlah) {
                    $goal->status = config('constants.goal_status.aktif');
                }
                $goal->save();
            } else {
                // Logic for Main Wallet
                $wallet = Wallet::where('user_id', (string) $user->id)->first();
                if (!$wallet) {
                    $wallet = Wallet::create(['user_id' => (string) $user->id, 'saldo_sekarang' => 0]);
                }
                if ($jenis === config('constants.transaction_types.pengeluaran') && (float) $wallet->saldo_sekarang < $amount) {
                    throw ValidationException::withMessages(['jumlah' => ['Saldo utama tidak mencukupi.']]);
                }
                $wallet->saldo_sekarang = ((float) $wallet->saldo_sekarang) + ($jenis === config('constants.transaction_types.pemasukan') ? $amount : ($amount * -1));
                $wallet->save();
            }

            $transaction = Transaction::create([
                'user_id' => (string) $user->id,
                'category_id' => $categoryId,
                'jenis' => $jenis,
                'status' => config('constants.transaction_status.berhasil'),
                'jumlah' => $amount,
                'tanggal' => $request->input('tanggal'),
                'keterangan' => $request->input('keterangan') ?: null,
                'source_id' => $sourceId,
            ]);
            NotificationFeed::create(['user_id' => (string) $user->id, 'title' => 'Transaksi berhasil', 'message' => 'Transaksi '.$jenis.' sebesar '.number_format($amount, 0, ',', '.').' berhasil dicatat.', 'read_at' => null, 'meta' => ['transaction_id' => (string) $transaction->id]]);
            $this->mongoAuditService->log($request, $user->id, 'transaction.created', [
                'transaction_id' => $transaction->id,
                'amount' => (float) $transaction->jumlah,
                'jenis' => $transaction->jenis,
            ]);

            return response()->json([
                'message' => 'Transaksi berhasil dicatat dan saldo diperbarui.',
                'transactionId' => $transaction->id,
            ], 201);
        });
    }

    public function deposit(Request $request)
    {
        $parent = $request->user();
        if ($parent->role !== config('constants.roles.parent')) {
            return response()->json(['message' => 'Hanya akun parent yang dapat melakukan deposit.'], 403);
        }

        $validated = $request->validate([
            'child_id' => ['required', 'string'],
            'amount' => ['required', 'numeric', 'min:1'],
            'keterangan' => ['nullable', 'string', 'max:255'],
        ]);

        $hasRelation = ParentChildRelation::query()
            ->where('parent_id', (string) $parent->id)
            ->where('child_id', (string) $validated['child_id'])
            ->where('is_active', true)
            ->exists();
        if (!$hasRelation) {
            return response()->json(['message' => 'Akun anak tidak ditemukan atau tidak aktif.'], 404);
        }

        return $this->safeMongoTransaction(function () use ($request, $parent, $validated) {
            $child = User::where('_id', (string) $validated['child_id'])->where('role', config('constants.roles.child'))->firstOrFail();
            $amount = (float) $validated['amount'];
            
            // 1. Deduct from Parent Wallet
            $parentWallet = Wallet::where('user_id', (string) $parent->id)->first();
            if (!$parentWallet) {
                $parentWallet = Wallet::create(['user_id' => (string) $parent->id, 'saldo_sekarang' => 0]);
            }
            
            if ((float) $parentWallet->saldo_sekarang < $amount) {
                return response()->json(['message' => 'Saldo Anda tidak mencukupi untuk melakukan deposit.'], 422);
            }
            
            $parentWallet->saldo_sekarang = ((float) $parentWallet->saldo_sekarang) - $amount;
            $parentWallet->save();

            // 2. Add to Child Wallet
            $childWallet = Wallet::where('user_id', (string) $child->id)->first();
            if (!$childWallet) {
                $childWallet = Wallet::create(['user_id' => (string) $child->id, 'saldo_sekarang' => 0]);
            }
            $childWallet->saldo_sekarang = ((float) $childWallet->saldo_sekarang) + $amount;
            $childWallet->save();

            $depositCategory = Category::query()->where('nama_kategori', config('constants.categories.Tabungan'))->first();
            $keterangan = $request->input('keterangan') ?? 'Deposit ke anak: ' . $child->username;

            // 3. Create Transaction for Parent (Expense)
            Transaction::create([
                'user_id' => (string) $parent->id,
                'category_id' => $depositCategory ? (string) $depositCategory->id : null,
                'jenis' => config('constants.transaction_types.pengeluaran'),
                'status' => config('constants.transaction_status.berhasil'),
                'jumlah' => $amount,
                'tanggal' => now()->toDateString(),
                'keterangan' => $keterangan,
                'is_internal' => true,
            ]);

            // 4. Create Transaction for Child (Income)
            $transaction = Transaction::create([
                'user_id' => (string) $child->id,
                'category_id' => $depositCategory ? (string) $depositCategory->id : null,
                'jenis' => config('constants.transaction_types.pemasukan'),
                'status' => config('constants.transaction_status.berhasil'),
                'jumlah' => $amount,
                'tanggal' => now()->toDateString(),
                'keterangan' => $request->input('keterangan') ?? 'Deposit dari orang tua (' . $parent->username . ')',
                'is_internal' => true,
            ]);

            NotificationFeed::create([
                'user_id' => (string) $child->id,
                'title' => 'Deposit diterima',
                'message' => 'Saldo bertambah sebesar '.number_format($amount, 0, ',', '.').' dari orang tua.',
                'read_at' => null,
                'meta' => ['transaction_id' => (string) $transaction->id, 'parent_id' => (string) $parent->id],
            ]);

            $this->mongoAuditService->log($request, (string) $parent->id, 'deposit.created', [
                'child_id' => (string) $child->id,
                'amount' => $amount,
                'transaction_id' => (string) $transaction->id,
            ]);

            return response()->json(['message' => 'Deposit berhasil dan saldo Anda telah diperbarui.'], 201);
        });
    }

    public function show(Request $request, string $id)
    {
        $user = $request->user();
        $transaction = Transaction::where('_id', $id)->firstOrFail();

        $isOwner = (string) $transaction->user_id === (string) $user->id;
        $isParentOfOwner = false;
        if (! $isOwner && $user->role === config('constants.roles.parent')) {
            $isParentOfOwner = ParentChildRelation::query()
                ->where('parent_id', (string) $user->id)
                ->where('child_id', (string) $transaction->user_id)
                ->where('is_active', true)
                ->exists();
        }
        if (! $isOwner && ! $isParentOfOwner) {
            return response()->json(['message' => 'Tidak punya akses.'], 403);
        }

        $category = $transaction->category_id
            ? Category::where('_id', (string) $transaction->category_id)->first()
            : null;

        return response()->json([
            'message' => 'OK',
            'data' => [
                'id_transaksi' => (string) $transaction->id,
                'user_id' => (string) $transaction->user_id,
                'jenis' => $transaction->jenis,
                'jumlah' => (float) $transaction->jumlah,
                'keterangan' => $transaction->keterangan,
                'tanggal' => $transaction->tanggal,
                'status' => $transaction->status,
                'id_kategori' => $transaction->category_id ? (string) $transaction->category_id : null,
                'nama_kategori' => $category?->nama_kategori,
                'icon_kategori' => $category?->icon,
                'source_id' => $transaction->source_id ? (string) $transaction->source_id : null,
                'is_internal' => (bool) ($transaction->is_internal ?? false),
            ],
        ]);
    }

    public function update(Request $request, string $id)
    {
        $user = $request->user();
        $transaction = Transaction::where('_id', $id)->firstOrFail();

        $isOwner = (string) $transaction->user_id === (string) $user->id;
        $isParentOfOwner = false;
        if (! $isOwner && $user->role === config('constants.roles.parent')) {
            $isParentOfOwner = ParentChildRelation::query()
                ->where('parent_id', (string) $user->id)
                ->where('child_id', (string) $transaction->user_id)
                ->where('is_active', true)
                ->exists();
        }
        if (! $isOwner && ! $isParentOfOwner) {
            return response()->json(['message' => 'Tidak punya akses.'], 403);
        }

        if ($transaction->status === config('constants.transaction_status.dibatalkan')) {
            return response()->json(['message' => 'Transaksi yang sudah dibatalkan tidak dapat diedit.'], 422);
        }

        if ($transaction->is_internal) {
            return response()->json(['message' => 'Transaksi internal hasil deposit/persetujuan tidak dapat diedit.'], 422);
        }

        $validated = $request->validate([
            'jumlah' => ['sometimes', 'numeric', 'min:1'],
            'tanggal' => ['sometimes', 'date'],
            'keterangan' => ['nullable', 'string', 'max:1000'],
            'id_kategori' => ['sometimes', 'nullable', 'string'],
            'source_id' => ['sometimes', 'nullable', 'string'],
        ]);

        if (isset($validated['id_kategori']) && $validated['id_kategori']
            && ! Category::where('_id', (string) $validated['id_kategori'])->exists()) {
            throw ValidationException::withMessages(['id_kategori' => ['Kategori tidak valid.']]);
        }

        return $this->safeMongoTransaction(function () use ($request, $transaction, $validated) {
            $oldAmount = (float) $transaction->jumlah;
            $oldJenis = $transaction->jenis;
            $oldSourceId = $transaction->source_id ? (string) $transaction->source_id : null;

            $newAmount = isset($validated['jumlah']) ? (float) $validated['jumlah'] : $oldAmount;
            $newSourceId = array_key_exists('source_id', $validated)
                ? ($validated['source_id'] ?: null)
                : $oldSourceId;
            $newSourceId = $newSourceId ? (string) $newSourceId : null;

            if ($oldJenis === config('constants.transaction_types.menabung')
                || $oldJenis === config('constants.transaction_types.refund')) {
                return response()->json([
                    'message' => 'Transaksi kontribusi/penarikan tabungan tidak dapat diedit. Hapus lalu buat ulang.',
                ], 422);
            }

            if ($newSourceId && $oldJenis === config('constants.transaction_types.pengeluaran')) {
                $goal = \App\Models\SavingGoal::where('_id', $newSourceId)
                    ->where('user_id', (string) $transaction->user_id)
                    ->first();
                if (! $goal) {
                    throw ValidationException::withMessages(['source_id' => ['Kantong tabungan tidak ditemukan.']]);
                }
                if ((float) $goal->jumlah_terkumpul < $newAmount) {
                    throw ValidationException::withMessages(['jumlah' => ['Saldo di kantong tabungan tidak mencukupi.']]);
                }
            }

            $this->revertBalanceDelta($transaction->user_id, $oldJenis, $oldAmount, $oldSourceId);
            $this->applyBalanceDelta($transaction->user_id, $oldJenis, $newSourceId, $newAmount);

            $transaction->jumlah = $newAmount;
            $transaction->tanggal = $validated['tanggal'] ?? $transaction->tanggal;
            $transaction->keterangan = array_key_exists('keterangan', $validated)
                ? ($validated['keterangan'] ?: null)
                : $transaction->keterangan;
            $transaction->category_id = array_key_exists('id_kategori', $validated)
                ? ($validated['id_kategori'] ?: null)
                : $transaction->category_id;
            $transaction->source_id = $newSourceId;
            $transaction->save();

            NotificationFeed::create([
                'user_id' => (string) $transaction->user_id,
                'title' => 'Transaksi diedit',
                'message' => 'Transaksi '.$oldJenis.' sebesar '.number_format($newAmount, 0, ',', '.').' telah diperbarui.',
                'read_at' => null,
                'meta' => ['transaction_id' => (string) $transaction->id],
            ]);

            $this->mongoAuditService->log($request, $transaction->user_id, 'transaction.updated', [
                'transaction_id' => $transaction->id,
                'old_amount' => $oldAmount,
                'new_amount' => $newAmount,
                'old_source_id' => $oldSourceId,
                'new_source_id' => $newSourceId,
            ]);

            return response()->json([
                'message' => 'Transaksi berhasil diperbarui dan saldo disesuaikan.',
                'transactionId' => (string) $transaction->id,
            ]);
        });
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();
        $transaction = Transaction::where('_id', $id)->firstOrFail();

        $isOwner = (string) $transaction->user_id === (string) $user->id;
        $isParentOfOwner = false;
        if (! $isOwner && $user->role === config('constants.roles.parent')) {
            $isParentOfOwner = ParentChildRelation::query()
                ->where('parent_id', (string) $user->id)
                ->where('child_id', (string) $transaction->user_id)
                ->where('is_active', true)
                ->exists();
        }
        if (! $isOwner && ! $isParentOfOwner) {
            return response()->json(['message' => 'Tidak punya akses.'], 403);
        }

        if ($transaction->status === config('constants.transaction_status.dibatalkan')) {
            return response()->json(['message' => 'Transaksi sudah dibatalkan sebelumnya.'], 422);
        }

        if ($transaction->is_internal) {
            return response()->json(['message' => 'Transaksi internal hasil deposit/persetujuan tidak dapat dihapus.'], 422);
        }

        if (in_array($transaction->jenis, [
            config('constants.transaction_types.menabung'),
            config('constants.transaction_types.refund'),
        ], true)) {
            return response()->json([
                'message' => 'Transaksi kontribusi/penarikan tabungan tidak dapat dihapus langsung. Gunakan menu Kantong.',
            ], 422);
        }

        return $this->safeMongoTransaction(function () use ($request, $transaction) {
            $oldAmount = (float) $transaction->jumlah;
            $oldJenis = $transaction->jenis;
            $oldSourceId = $transaction->source_id ? (string) $transaction->source_id : null;

            $this->revertBalanceDelta($transaction->user_id, $oldJenis, $oldAmount, $oldSourceId);

            $transaction->status = config('constants.transaction_status.dibatalkan');
            $transaction->save();

            NotificationFeed::create([
                'user_id' => (string) $transaction->user_id,
                'title' => 'Transaksi dibatalkan',
                'message' => 'Transaksi '.$oldJenis.' sebesar '.number_format($oldAmount, 0, ',', '.').' telah dibatalkan dan saldo dikembalikan.',
                'read_at' => null,
                'meta' => ['transaction_id' => (string) $transaction->id],
            ]);

            $this->mongoAuditService->log($request, $transaction->user_id, 'transaction.cancelled', [
                'transaction_id' => $transaction->id,
                'amount' => $oldAmount,
                'jenis' => $oldJenis,
                'source_id' => $oldSourceId,
            ]);

            return response()->json([
                'message' => 'Transaksi dibatalkan dan saldo telah dikembalikan.',
            ]);
        });
    }

    protected function revertBalanceDelta(string $userId, string $jenis, float $amount, ?string $sourceId): void
    {
        if ($sourceId) {
            $goal = \App\Models\SavingGoal::where('_id', $sourceId)
                ->where('user_id', $userId)
                ->first();
            if (! $goal) {
                return;
            }
            $current = (float) $goal->jumlah_terkumpul;
            if ($jenis === config('constants.transaction_types.pemasukan')) {
                $goal->jumlah_terkumpul = $current - $amount;
            } elseif ($jenis === config('constants.transaction_types.pengeluaran')) {
                $goal->jumlah_terkumpul = $current + $amount;
            }
            $goal->save();
            return;
        }

        $wallet = Wallet::where('user_id', $userId)->first();
        if (! $wallet) {
            return;
        }
        $current = (float) $wallet->saldo_sekarang;
        if ($jenis === config('constants.transaction_types.pemasukan')) {
            $wallet->saldo_sekarang = $current - $amount;
        } elseif ($jenis === config('constants.transaction_types.pengeluaran')) {
            $wallet->saldo_sekarang = $current + $amount;
        }
        $wallet->save();
    }

    protected function applyBalanceDelta(string $userId, string $jenis, ?string $sourceId, float $amount): void
    {
        if ($sourceId) {
            $goal = \App\Models\SavingGoal::where('_id', $sourceId)
                ->where('user_id', $userId)
                ->first();
            if (! $goal) {
                return;
            }
            $delta = $jenis === config('constants.transaction_types.pemasukan') ? $amount : -$amount;
            $goal->jumlah_terkumpul = ((float) $goal->jumlah_terkumpul) + $delta;
            if ($goal->status === config('constants.goal_status.tercapai') && (float) $goal->jumlah_terkumpul < (float) $goal->target_jumlah) {
                $goal->status = config('constants.goal_status.aktif');
            }
            $goal->save();
            return;
        }

        $wallet = Wallet::where('user_id', $userId)->first();
        if (! $wallet) {
            $wallet = Wallet::create(['user_id' => $userId, 'saldo_sekarang' => 0]);
        }
        $delta = $jenis === config('constants.transaction_types.pemasukan') ? $amount : -$amount;
        $wallet->saldo_sekarang = ((float) $wallet->saldo_sekarang) + $delta;
        $wallet->save();
    }
}
