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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
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

        DB::connection('mongodb')->beginTransaction();

        try {
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
                $wallet = Wallet::firstOrCreate(['user_id' => (string) $user->id], ['saldo_sekarang' => 0]);
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
                'keterangan' => $request->input('keterangan'),
                'source_id' => $sourceId,
            ]);
            NotificationFeed::create(['user_id' => (string) $user->id, 'title' => 'Transaksi berhasil', 'message' => 'Transaksi '.$jenis.' sebesar '.number_format($amount, 0, ',', '.').' berhasil dicatat.', 'read_at' => null, 'meta' => ['transaction_id' => (string) $transaction->id]]);
            $this->mongoAuditService->log($request, $user->id, 'transaction.created', [
                'transaction_id' => $transaction->id,
                'amount' => (float) $transaction->jumlah,
                'jenis' => $transaction->jenis,
            ]);

            DB::connection('mongodb')->commit();

            return response()->json([
                'message' => 'Transaksi berhasil dicatat dan saldo diperbarui.',
                'transactionId' => $transaction->id,
            ], 201);
        } catch (\Exception $e) {
            DB::connection('mongodb')->rollBack();
            throw $e;
        }
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

        DB::connection('mongodb')->beginTransaction();

        try {
            $child = User::where('_id', (string) $validated['child_id'])->where('role', config('constants.roles.child'))->firstOrFail();
            $wallet = Wallet::firstOrCreate(['user_id' => (string) $child->id], ['saldo_sekarang' => 0]);
            $amount = (float) $validated['amount'];
            $wallet->saldo_sekarang = ((float) $wallet->saldo_sekarang) + $amount;
            $wallet->save();

            $depositCategory = Category::query()->where('nama_kategori', config('constants.categories.Tabungan'))->first();
            $transaction = Transaction::create([
                'user_id' => (string) $child->id,
                'category_id' => $depositCategory ? (string) $depositCategory->id : null,
                'jenis' => config('constants.transaction_types.pemasukan'),
                'status' => config('constants.transaction_status.berhasil'),
                'jumlah' => $amount,
                'tanggal' => now()->toDateString(),
                'keterangan' => $validated['keterangan'] ?: 'Deposit dari orang tua',
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

            DB::connection('mongodb')->commit();

            return response()->json(['message' => 'Deposit berhasil.'], 201);
        } catch (\Exception $e) {
            DB::connection('mongodb')->rollBack();
            throw $e;
        }
    }

    public function contribute(Request $request)
    {
        $user = $request->user();
        $goal = \App\Models\SavingGoal::where('_id', $request->input('id_target'))->where('user_id', (string) $user->id)->firstOrFail();
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
            \App\Models\GoalContribution::create(['saving_goal_id' => (string) $goal->id, 'user_id' => (string) $user->id, 'jumlah' => $amount, 'contributed_at' => now()]);
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
        $goal = \App\Models\SavingGoal::where('_id', $request->input('id_target'))->where('user_id', (string) $user->id)->firstOrFail();
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

            NotificationFeed::create([
                'user_id' => (string) $user->id,
                'title' => 'Ambil uang dari kantong',
                'message' => 'Berhasil mengambil Rp '.number_format($amount, 0, ',', '.').' dari kantong '.$goal->nama_target,
                'read_at' => null,
            ]);

            DB::connection('mongodb')->commit();

            return response()->json(['message' => 'Berhasil mengambil uang dari kantong tabungan!']);
        } catch (\Exception $e) {
            DB::connection('mongodb')->rollBack();
            throw $e;
        }
    }
}
