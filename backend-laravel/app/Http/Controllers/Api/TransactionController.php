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

}
