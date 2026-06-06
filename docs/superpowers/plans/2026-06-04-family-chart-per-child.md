# Family Chart Per-Child Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-child filtering to the chart and a transaction history list on `FamilyPage` (Anggota Keluarga), driven by clicking a child card. Backend endpoints gain a `child_id` query param to scope data to one child.

**Architecture:** Additive backend change (new `child_id` query param on family endpoints with ownership validation), minimal frontend service/type changes, and a stateful UI in `FamilyPage.tsx` that selects a child and feeds the new `child_id` into the existing `fetchFamily*` services.

**Tech Stack:** PHP 8.2 / Laravel (MongoDB via `mongodb/laravel-mongodb`), React 19 + TypeScript, react-bootstrap 2, recharts.

---

## File Structure

**Backend (modify 1 file):**
- `backend-laravel/app/Http\Controllers/Api/ReportController.php` - add `resolveTargetUserIds()` helper, plumb `child_id` into 5 family endpoints.

**Backend (create 1 test file):**
- `backend-laravel/tests/Feature/ReportChildFilterTest.php` - cover valid child, invalid child, and child-vs-group precedence.

**Frontend (modify 3 files):**
- `frontend/src/services/report.service.ts` - add `child_id` to `FilterParams`.
- `frontend/src/types/report.types.ts` - add `username?` to `MonthlySummary`.
- `frontend/src/pages/FamilyPage.tsx` - add `selectedChildId` state, clickable cards with selection indicator, dynamic chart title, new history section, child_id-aware `loadData()`.

No new files in frontend.

---

## Task 1: Backend - Add `resolveTargetUserIds` helper and test for ownership validation

**Files:**
- Modify: `backend-laravel/app/Http\Controllers/Api/ReportController.php:99-200` (extend `buildFamilySummary`)
- Test: `backend-laravel/tests/Feature/ReportChildFilterTest.php` (new)

- [ ] **Step 1.1: Write the failing test**

Create `backend-laravel/tests/Feature/ReportChildFilterTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\ParentChildRelation;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Transaction;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReportChildFilterTest extends TestCase
{
    private function makeUser(string $role): User
    {
        return User::factory()->create(['role' => $role]);
    }

    private function authHeaders(User $user): array
    {
        $token = Str::random(80);
        $user->api_token = hash('sha256', $token);
        $user->save();
        return [
            'Authorization' => 'Bearer ' . $token,
            'Accept' => 'application/json',
        ];
    }

    private function linkChild(User $parent, User $child): void
    {
        ParentChildRelation::create([
            'parent_id' => (string) $parent->id,
            'child_id' => (string) $child->id,
            'is_active' => true,
        ]);
        Wallet::firstOrCreate(['user_id' => (string) $child->id], ['saldo_sekarang' => 0]);
    }

    public function test_child_filter_returns_403_when_child_not_owned(): void
    {
        $parent = $this->makeUser('parent');
        $stranger = $this->makeUser('child');

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/summary?child_id=' . $stranger->id);

        $response->assertStatus(403);
    }

    public function test_child_filter_returns_data_for_owned_child(): void
    {
        $parent = $this->makeUser('parent');
        $child = $this->makeUser('child');
        $this->linkChild($parent, $child);

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/summary?child_id=' . $child->id);

        $response->assertStatus(200);
        $response->assertJsonPath('data.username', $child->username);
    }

    public function test_child_filter_overrides_group_param(): void
    {
        $parent = $this->makeUser('parent');
        $child = $this->makeUser('child');
        $this->linkChild($parent, $child);

        // group=ortu would normally restrict to parent only; child_id must take precedence
        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/summary?child_id=' . $child->id . '&group=ortu');

        $response->assertStatus(200);
        $response->assertJsonPath('data.username', $child->username);
    }
}
```

- [ ] **Step 1.2: Run the test to confirm it fails**

Run: `cd backend-laravel && php artisan test --filter=ReportChildFilterTest`
Expected: All 3 tests fail (no `child_id` support yet, no `username` field yet).

- [ ] **Step 1.3: Add the `resolveTargetUserIds` helper to ReportController**

In `backend-laravel/app/Http\Controllers/Api/ReportController.php`, add this private method (just above `private function applyTimeFilter` near the top of the class, after the class opening brace):

```php
    private function resolveTargetUserIds(Request $request, string $parentId): array
    {
        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parentId)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();

        $childId = $request->query('child_id');

        if ($childId) {
            $childId = (string) $childId;
            $owned = $childIds->contains($childId);
            if (!$owned) {
                abort(403, 'Anak tidak ditemukan dalam keluarga Anda.');
            }
            return [$childId];
        }

        $group = $request->query('group', 'semua');
        if ($group === 'ortu') {
            return [$parentId];
        }
        if ($group === 'anak') {
            return $childIds->all();
        }
        return collect([$parentId])->merge($childIds)->unique()->values()->all();
    }
```

- [ ] **Step 1.4: Refactor `buildFamilySummary` to use the helper**

In `ReportController.php`, replace the `buildFamilySummary` body (lines ~99-200). The replacement uses the helper and adds `username` to the result:

```php
    private function buildFamilySummary(string $parentId, Request $request): array
    {
        $allUserIds = collect($this->resolveTargetUserIds($request, $parentId));
        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parentId)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();

        $group = $request->query('group', 'semua');
        $childId = $request->query('child_id');
        $effectiveGroup = $childId ? 'anak' : $group;

        $txBase = Transaction::query()
            ->whereIn('user_id', $allUserIds->all())
            ->where('status', config('constants.transaction_status.berhasil'));

        $txBase = $this->applyTimeFilter($txBase, $request);

        $incomeQuery = (clone $txBase)->where('jenis', config('constants.transaction_types.pemasukan'));
        $expenseQuery = (clone $txBase)->where('jenis', config('constants.transaction_types.pengeluaran'));

        if ($effectiveGroup === 'semua') {
            $income = (float) $incomeQuery->where('is_internal', '!=', true)->sum('jumlah');
            $expense = (float) $expenseQuery->where('is_internal', '!=', true)->sum('jumlah');
        } else {
            $income = (float) $incomeQuery->sum('jumlah');
            $expense = (float) $expenseQuery->sum('jumlah');
        }

        $childWalletTotal = 0;
        if ($effectiveGroup !== 'ortu' && $childIds->isNotEmpty()) {
            $groupChildIds = ($effectiveGroup === 'anak') ? $allUserIds : $childIds;
            $childWalletTotal = (float) Wallet::query()->whereIn('user_id', $groupChildIds->all())->sum('saldo_sekarang');
        }

        $parentWallet = ($effectiveGroup !== 'anak') ? Wallet::firstOrCreate(['user_id' => $parentId], ['saldo_sekarang' => 0]) : null;
        $currentSaldoTotal = $childWalletTotal + (($parentWallet) ? (float) $parentWallet->saldo_sekarang : 0);

        $selectedMonth = $request->query('month', now()->format('Y-m'));
        $endOfSelectedMonth = now()->createFromFormat('Y-m', $selectedMonth)->endOfMonth()->toDateString();
        $endOfPrevMonth = now()->createFromFormat('Y-m', $selectedMonth)->subMonth()->endOfMonth()->toDateString();

        $afterQuery = Transaction::query()
            ->whereIn('user_id', $allUserIds->all())
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', '>', $endOfSelectedMonth);

        if ($effectiveGroup === 'semua') {
            $afterQuery->where('is_internal', '!=', true);
        }

        $transactionsAfterSelected = $afterQuery->get(['jenis', 'jumlah']);

        $netAfterSelected = 0;
        foreach ($transactionsAfterSelected as $t) {
            if ($t->jenis === config('constants.transaction_types.pemasukan')) {
                $netAfterSelected -= (float) $t->jumlah;
            } else {
                $netAfterSelected += (float) $t->jumlah;
            }
        }
        $saldoAkhir = $currentSaldoTotal + $netAfterSelected;

        $prevQuery = Transaction::query()
            ->whereIn('user_id', $allUserIds->all())
            ->where('status', config('constants.transaction_status.berhasil'))
            ->where('tanggal', '>', $endOfPrevMonth);

        if ($effectiveGroup === 'semua') {
            $prevQuery->where('is_internal', '!=', true);
        }

        $transactionsAfterPrev = $prevQuery->get(['jenis', 'jumlah']);

        $netAfterPrev = 0;
        foreach ($transactionsAfterPrev as $t) {
            if ($t->jenis === config('constants.transaction_types.pemasukan')) {
                $netAfterPrev -= (float) $t->jumlah;
            } else {
                $netAfterPrev += (float) $t->jumlah;
            }
        }
        $saldoBulanLalu = $currentSaldoTotal + $netAfterPrev;

        $result = [
            'bulan' => $selectedMonth,
            'totalPemasukan' => $income,
            'totalPengeluaran' => $expense,
            'neto' => $income - $expense,
            'saldoAkhir' => $saldoAkhir,
            'saldoBulanLalu' => $saldoBulanLalu,
            'childCount' => $childIds->count(),
        ];

        if ($childId) {
            $childUser = \App\Models\User::find($childId);
            $result['username'] = $childUser?->username;
        }

        return $result;
    }
```

- [ ] **Step 1.5: Run the test to confirm it passes**

Run: `cd backend-laravel && php artisan test --filter=ReportChildFilterTest`
Expected: All 3 tests pass.

- [ ] **Step 1.6: Commit**

```bash
git add backend-laravel/app/Http\Controllers/Api/ReportController.php backend-laravel/tests/Feature/ReportChildFilterTest.php
git commit -m "feat(reports): support child_id filter in familySummary endpoint"
```

---

## Task 2: Backend - Plumb `child_id` into `familyHistorical`

**Files:**
- Modify: `backend-laravel/app/Http\Controllers/Api/ReportController.php:484-564`

- [ ] **Step 2.1: Add a test for historical data with child_id**

Append to `ReportChildFilterTest.php`:

```php
    public function test_historical_with_child_id_returns_200(): void
    {
        $parent = $this->makeUser('parent');
        $child = $this->makeUser('child');
        $this->linkChild($parent, $child);

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/historical?unit=tahunan&year=2026&child_id=' . $child->id);

        $response->assertStatus(200);
        $response->assertJsonStructure(['message', 'data' => []]);
    }

    public function test_historical_with_unowned_child_id_returns_403(): void
    {
        $parent = $this->makeUser('parent');
        $stranger = $this->makeUser('child');

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/historical?unit=tahunan&year=2026&child_id=' . $stranger->id);

        $response->assertStatus(403);
    }
```

- [ ] **Step 2.2: Run the test to confirm it fails**

Run: `cd backend-laravel && php artisan test --filter=ReportChildFilterTest`
Expected: 2 new tests fail with 403 (no validation in historical yet) or 500 (key error).

- [ ] **Step 2.3: Modify `familyHistorical` to use the helper**

Replace the body of `familyHistorical` (lines ~484-564) with:

```php
    public function familyHistorical(Request $request)
    {
        $parent = $request->user();
        if ($parent->role !== config('constants.roles.parent')) {
            return response()->json(['message' => 'Hanya akun parent yang dapat melihat laporan keluarga.'], 403);
        }

        $allUserIds = collect($this->resolveTargetUserIds($request, (string) $parent->id));
        $unit = $request->query('unit', 'tahunan');
        $effectiveGroup = $request->query('child_id') ? 'anak' : $request->query('group', 'semua');

        $result = Transaction::raw(function ($collection) use ($allUserIds, $unit, $request, $effectiveGroup) {
            $match = [
                'user_id' => ['$in' => $allUserIds->all()],
                'status' => config('constants.transaction_status.berhasil'),
            ];

            if ($effectiveGroup === 'semua') {
                $match['is_internal'] = ['$ne' => true];
            }

            if ($unit === 'mingguan' && $request->has('start_date') && $request->has('end_date')) {
                $match['tanggal'] = ['$gte' => $request->start_date, '$lte' => $request->end_date];
                $groupBy = ['$substr' => ['$tanggal', 0, 10]];
            } else if ($unit === 'bulan' && $request->has('month')) {
                $match['tanggal'] = ['$regex' => '^' . $request->month];
                $groupBy = ['$substr' => ['$tanggal', 0, 10]];
            } else if ($unit === 'tahunan' && $request->has('year')) {
                $match['tanggal'] = ['$regex' => '^' . $request->year];
                $groupBy = ['$substr' => ['$tanggal', 0, 7]];
            } else {
                $groupBy = ['$substr' => ['$tanggal', 0, 7]];
            }

            return $collection->aggregate([
                ['$match' => $match],
                ['$group' => [
                    '_id' => $groupBy,
                    'pemasukan' => ['$sum' => [
                        '$cond' => [
                            ['$eq' => ['$jenis', config('constants.transaction_types.pemasukan')]],
                            '$jumlah',
                            0
                        ]
                    ]],
                    'pengeluaran' => ['$sum' => [
                        '$cond' => [
                            ['$eq' => ['$jenis', config('constants.transaction_types.pengeluaran')]],
                            '$jumlah',
                            0
                        ]
                    ]]
                ]],
                ['$sort' => ['_id' => 1]]
            ]);
        });

        $data = array_map(function ($item) {
            return [
                'month' => (string) ($item->_id ?? ''),
                'pemasukan' => (float) ($item->pemasukan ?? 0),
                'pengeluaran' => (float) ($item->pengeluaran ?? 0),
            ];
        }, iterator_to_array($result));

        return response()->json(['message' => 'OK', 'data' => $data]);
    }
```

- [ ] **Step 2.4: Run the test to confirm it passes**

Run: `cd backend-laravel && php artisan test --filter=ReportChildFilterTest`
Expected: All 5 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add backend-laravel/app/Http\Controllers/Api/ReportController.php backend-laravel/tests/Feature/ReportChildFilterTest.php
git commit -m "feat(reports): support child_id filter in familyHistorical endpoint"
```

---

## Task 3: Backend - Plumb `child_id` into `familyHistory`

**Files:**
- Modify: `backend-laravel/app/Http\Controllers/Api/ReportController.php:566-647`

- [ ] **Step 3.1: Add tests for history endpoint with child_id**

Append to `ReportChildFilterTest.php`:

```php
    public function test_history_with_child_id_returns_200(): void
    {
        $parent = $this->makeUser('parent');
        $child = $this->makeUser('child');
        $this->linkChild($parent, $child);

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/history?child_id=' . $child->id);

        $response->assertStatus(200);
        $response->assertJsonStructure(['message', 'data']);
    }

    public function test_history_with_unowned_child_id_returns_403(): void
    {
        $parent = $this->makeUser('parent');
        $stranger = $this->makeUser('child');

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/history?child_id=' . $stranger->id);

        $response->assertStatus(403);
    }
```

- [ ] **Step 3.2: Run the test to confirm it fails**

Run: `cd backend-laravel && php artisan test --filter=ReportChildFilterTest`
Expected: 2 new tests fail.

- [ ] **Step 3.3: Modify `familyHistory` to use the helper**

Replace the `familyHistory` method body (lines ~566-647) with:

```php
    public function familyHistory(Request $request)
    {
        $parent = $request->user();
        if ($parent->role !== config('constants.roles.parent')) {
            return response()->json(['message' => 'Hanya akun parent yang dapat melihat laporan keluarga.'], 403);
        }

        $allUserIds = collect($this->resolveTargetUserIds($request, (string) $parent->id));
        $effectiveGroup = $request->query('child_id') ? 'anak' : $request->query('group', 'semua');

        $query = Transaction::query()->whereIn('user_id', $allUserIds->all());
        $query = $this->applyTimeFilter($query, $request);

        $rows = $query->orderByDesc('created_at')
            ->limit(100)
            ->get();

        $categoryIds = $rows->pluck('category_id')->filter()->unique()->values();
        $categoryMap = Category::query()
            ->whereIn('_id', $categoryIds->all())
            ->get()
            ->keyBy(fn ($c) => (string) $c->id)
            ->map(fn ($c) => [
                'nama' => $c->nama_kategori,
                'icon' => $c->icon ?? 'Tag'
            ])
            ->all();

        $familyMemberMap = \App\Models\User::whereIn('_id', $allUserIds->all())->get(['_id', 'username'])->keyBy(fn($u) => (string) $u->id);

        $data = $rows->filter(function ($t) use ($effectiveGroup) {
            if ($effectiveGroup === 'semua') {
                return !($t->is_internal && $t->jenis === config('constants.transaction_types.pengeluaran'));
            }
            return true;
        })->map(function ($t) use ($categoryMap, $familyMemberMap) {
            $cat = $t->category_id ? ($categoryMap[(string) $t->category_id] ?? null) : null;
            $categoryName = $cat ? $cat['nama'] : 'Lainnya';
            $categoryIcon = $cat ? $cat['icon'] : 'Tag';

            if ($t->jenis === config('constants.transaction_types.menabung')) {
                $categoryName = 'Menabung';
                $categoryIcon = 'PiggyBank';
            } else if ($t->jenis === config('constants.transaction_types.refund')) {
                $categoryName = 'Refund';
                $categoryIcon = 'ArrowCounterclockwise';
            } else if ($t->source_id) {
                $categoryName = 'Tabungan';
                $categoryIcon = 'Wallet2';
            }

            return [
                'id_transaksi' => (string) $t->id,
                'user_id' => (string) $t->user_id,
                'username' => $familyMemberMap[(string) $t->user_id]->username ?? 'Unknown',
                'jenis' => $t->jenis,
                'jumlah' => (float) $t->jumlah,
                'keterangan' => $t->keterangan,
                'tanggal' => $t->tanggal,
                'created_at' => $t->created_at,
                'status' => $t->status ?? 'berhasil',
                'nama_kategori' => $categoryName,
                'icon_kategori' => $categoryIcon,
                'is_internal' => (bool) ($t->is_internal ?? false),
            ];
        });

        return response()->json(['message' => 'OK', 'data' => $data->values()->take(100)->values()]);
    }
```

- [ ] **Step 3.4: Run the test to confirm it passes**

Run: `cd backend-laravel && php artisan test --filter=ReportChildFilterTest`
Expected: All 7 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add backend-laravel/app/Http\Controllers/Api/ReportController.php backend-laravel/tests/Feature/ReportChildFilterTest.php
git commit -m "feat(reports): support child_id filter in familyHistory endpoint"
```

---

## Task 4: Backend - Plumb `child_id` into `familyAnalysis` and `familyAnalysisPdf`

**Files:**
- Modify: `backend-laravel/app/Http\Controllers/Api/ReportController.php:649-869`

- [ ] **Step 4.1: Add tests for analysis endpoint with child_id**

Append to `ReportChildFilterTest.php`:

```php
    public function test_analysis_with_child_id_returns_200(): void
    {
        $parent = $this->makeUser('parent');
        $child = $this->makeUser('child');
        $this->linkChild($parent, $child);

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/analysis?month=2026-06&child_id=' . $child->id);

        $response->assertStatus(200);
        $response->assertJsonStructure(['message', 'data' => ['summary', 'chartData']]);
    }

    public function test_analysis_with_unowned_child_id_returns_403(): void
    {
        $parent = $this->makeUser('parent');
        $stranger = $this->makeUser('child');

        $response = $this->withHeaders($this->authHeaders($parent))
            ->getJson('/api/reports/family/analysis?month=2026-06&child_id=' . $stranger->id);

        $response->assertStatus(403);
    }

    public function test_pdf_with_child_id_returns_200(): void
    {
        $parent = $this->makeUser('parent');
        $child = $this->makeUser('child');
        $this->linkChild($parent, $child);

        $response = $this->withHeaders($this->authHeaders($parent))
            ->get('/api/reports/family/analysis/pdf?month=2026-06&child_id=' . $child->id);

        $response->assertStatus(200);
        $this->assertStringContainsString('application/pdf', $response->headers->get('content-type'));
    }
```

- [ ] **Step 4.2: Run the test to confirm it fails**

Run: `cd backend-laravel && php artisan test --filter=ReportChildFilterTest`
Expected: 3 new tests fail.

- [ ] **Step 4.3: Modify `familyAnalysis` to use the helper**

Replace the section of `familyAnalysis` that builds `allUserIds` and `effectiveGroup` (lines ~657-671). The change:

Find this block:
```php
        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parent->id)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();

        $group = $request->query('group', 'semua');
        if ($group === 'ortu') {
            $allUserIds = collect([(string) $parent->id]);
        } elseif ($group === 'anak') {
            $allUserIds = $childIds;
        } else {
            $allUserIds = collect([(string) $parent->id])->merge($childIds)->unique()->values();
        }
```

Replace with:
```php
        $childIds = ParentChildRelation::query()
            ->where('parent_id', $parent->id)
            ->where('is_active', true)
            ->pluck('child_id')
            ->map(fn ($id) => (string) $id)
            ->values();

        $allUserIds = collect($this->resolveTargetUserIds($request, (string) $parent->id));
        $effectiveGroup = $request->query('child_id') ? 'anak' : $request->query('group', 'semua');
```

Then find the line `$expenseQuery = Transaction::query()` and the line `if ($group === 'semua')`. Replace all references to `$group` in this method with `$effectiveGroup` (there are 2 such references in the expense query block).

- [ ] **Step 4.4: Modify `familyAnalysisPdf` to use the helper**

Same pattern: in `familyAnalysisPdf` (lines ~731-869), find the block that builds `allUserIds` from `$group` (lines ~757-764) and replace it with the helper call. Find:

```php
        $group = $request->query('group', 'semua');
        if ($group === 'ortu') {
            $allUserIds = collect([(string) $parent->id]);
        } elseif ($group === 'anak') {
            $allUserIds = $childIds;
        } else {
            $allUserIds = collect([(string) $parent->id])->merge($childIds)->unique()->values();
        }
```

Replace with:
```php
        $allUserIds = collect($this->resolveTargetUserIds($request, (string) $parent->id));
        $effectiveGroup = $request->query('child_id') ? 'anak' : $request->query('group', 'semua');
```

Then replace the 2 remaining `$group` references in this method (in the expense query block) with `$effectiveGroup`.

- [ ] **Step 4.5: Run the test to confirm it passes**

Run: `cd backend-laravel && php artisan test --filter=ReportChildFilterTest`
Expected: All 10 tests pass.

- [ ] **Step 4.6: Run the full test suite to confirm no regressions**

Run: `cd backend-laravel && php artisan test`
Expected: All tests pass.

- [ ] **Step 4.7: Commit**

```bash
git add backend-laravel/app/Http\Controllers/Api/ReportController.php backend-laravel/tests/Feature/ReportChildFilterTest.php
git commit -m "feat(reports): support child_id filter in familyAnalysis and PDF endpoints"
```

---

## Task 5: Frontend - Add `child_id` to FilterParams and `username` to MonthlySummary

**Files:**
- Modify: `frontend/src/services/report.service.ts:5-12`
- Modify: `frontend/src/types/report.types.ts:1-10`

- [ ] **Step 5.1: Add `child_id` to FilterParams**

In `frontend/src/services/report.service.ts`, find the `FilterParams` interface (lines 5-12):

```ts
interface FilterParams {
    month?: string; 
    year?: string;  
    start_date?: string;
    end_date?: string;   
    unit?: string; 
    group?: string;
}
```

Add `child_id?: string;` as the last line:

```ts
interface FilterParams {
    month?: string; 
    year?: string;  
    start_date?: string;
    end_date?: string;   
    unit?: string; 
    group?: string;
    child_id?: string;
}
```

- [ ] **Step 5.2: Add `username?` to MonthlySummary**

In `frontend/src/types/report.types.ts`, find `MonthlySummary` (lines 1-10). Add `username?: string;` after `saldoBulanLalu?`:

```ts
export interface MonthlySummary { 
    bulan: string; // YYYY-MM
    totalPemasukan: number;
    totalPengeluaran: number;
    neto: number; // Pemasukan - Pengeluaran
    saldoAkhir: number;
    saldoBulanLalu?: number; // Saldo penutupan bulan sebelumnya
    username?: string; // Diisi backend saat child_id diberikan
    persentasePemasukan?: number;
    persentasePengeluaran?: number;
}
```

- [ ] **Step 5.3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors (these are additive optional fields).

- [ ] **Step 5.4: Commit**

```bash
git add frontend/src/services/report.service.ts frontend/src/types/report.types.ts
git commit -m "feat(frontend): add child_id filter param and username field to summary"
```

---

## Task 6: Frontend - FamilyPage - add state and clickable cards with selection indicator

**Files:**
- Modify: `frontend/src/pages/FamilyPage.tsx:1-15, 26-71, 150-237`

- [ ] **Step 6.1: Add `selectedChildId` state and `useEffect` to clear stale selection**

In `frontend/src/pages/FamilyPage.tsx`, find the state declarations block (around lines 32-46). Add `selectedChildId` state:

After line 33 (`const [summary, setSummary] = ...`), add:

```tsx
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
```

After the existing `useEffect` that calls `loadData()` (around line 68-70), add a new effect to clear stale selection:

```tsx
    useEffect(() => {
        if (selectedChildId && !children.some(c => c.id === selectedChildId)) {
            setSelectedChildId(null);
        }
    }, [children, selectedChildId]);
```

- [ ] **Step 6.2: Make the "Saldo Total Anak" card clickable**

Find the "Saldo Total Anak" card (lines 150-173). Replace the outer `Card` element with one that has `onClick`, cursor, and selection-aware border:

Replace:
```tsx
            <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 25 }}>
                <Card.Body className="p-4 px-5">
                    <div className="d-flex justify-content-between align-items-start">
```

With:
```tsx
            <Card
                className="border-0 shadow-sm mb-4"
                style={{
                    borderRadius: 25,
                    cursor: 'pointer',
                    border: selectedChildId === null ? '2px solid #1389f9' : '2px solid transparent',
                    transition: 'border-color 0.2s ease',
                }}
                onClick={() => setSelectedChildId(null)}
            >
                <Card.Body className="p-4 px-5">
                    <div className="d-flex justify-content-between align-items-start">
```

- [ ] **Step 6.3: Make each child card clickable with selection indicator**

Find the child card mapping (lines 175-218). Replace the outer `Card` for each child with one that has click handler, cursor, selection border, and adds `e.stopPropagation()` to the deposit/delete buttons:

Replace:
```tsx
            <Row className="g-4 mb-4">
                {children.map((c) => (
                    <Col key={c.id} md={6}>
                        <Card className="border-0 shadow-sm" style={{ borderRadius: 25, backgroundColor: '#dff0ff' }}>
                            <Card.Body className="p-4">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="bg-primary bg-opacity-10 p-2 rounded-circle text-primary d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                                            <div className="bg-primary rounded-circle" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: '#fff' }}>👤</div>
                                        </div>
                                        <div>
                                            <div className="fw-bold text-dark" style={{ fontSize: 22 }}>
                                                {c.username}
                                            </div>
                                            <div className="text-muted small">Saldo saat ini</div>
                                            <div className="fw-bold mt-1" style={{ fontSize: 26, color: '#1389f9' }}>
                                                {showSaldo ? formatRupiah(c.saldo) : 'Rp ••••••'}
                                            </div>
                                            <div className={`fw-bold small ${c.percentage_change >= 0 ? 'text-success' : 'text-danger'}`}>
                                                {c.percentage_change >= 0 ? '+' : ''}{c.percentage_change}% dari bulan lalu
                                            </div>
                                        </div>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <Button
                                            variant="outline-danger"
                                            onClick={() => openDeleteConfirm(c.id, c.username)}
                                            style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: 'rgba(220, 53, 69, 0.1)', color: '#dc3545' }}
                                        >
                                            <Trash size={20} />
                                        </Button>
                                        <Button
                                            variant="primary"
                                            onClick={() => openDeposit(c.id)}
                                            style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <Plus size={32} />
                                        </Button>
                                    </div>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
```

With:
```tsx
            <Row className="g-4 mb-4">
                {children.map((c) => {
                    const isSelected = selectedChildId === c.id;
                    return (
                        <Col key={c.id} md={6}>
                            <Card
                                className="border-0 shadow-sm"
                                style={{
                                    borderRadius: 25,
                                    backgroundColor: '#dff0ff',
                                    cursor: 'pointer',
                                    border: isSelected ? '2px solid #1389f9' : '2px solid transparent',
                                    transition: 'border-color 0.2s ease',
                                }}
                                onClick={() => setSelectedChildId(c.id)}
                            >
                                <Card.Body className="p-4">
                                    <div className="d-flex justify-content-between align-items-start">
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="bg-primary bg-opacity-10 p-2 rounded-circle text-primary d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                                                <div className="bg-primary rounded-circle" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: '#fff' }}>👤</div>
                                            </div>
                                            <div>
                                                <div className="fw-bold text-dark" style={{ fontSize: 22 }}>
                                                    {c.username}
                                                </div>
                                                <div className="text-muted small">Saldo saat ini</div>
                                                <div className="fw-bold mt-1" style={{ fontSize: 26, color: '#1389f9' }}>
                                                    {showSaldo ? formatRupiah(c.saldo) : 'Rp ••••••'}
                                                </div>
                                                <div className={`fw-bold small ${c.percentage_change >= 0 ? 'text-success' : 'text-danger'}`}>
                                                    {c.percentage_change >= 0 ? '+' : ''}{c.percentage_change}% dari bulan lalu
                                                </div>
                                            </div>
                                        </div>
                                        <div className="d-flex gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Button
                                                variant="outline-danger"
                                                onClick={() => openDeleteConfirm(c.id, c.username)}
                                                style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: 'rgba(220, 53, 69, 0.1)', color: '#dc3545' }}
                                            >
                                                <Trash size={20} />
                                            </Button>
                                            <Button
                                                variant="primary"
                                                onClick={() => openDeposit(c.id)}
                                                style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <Plus size={32} />
                                            </Button>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    );
                })}
```

- [ ] **Step 6.4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6.5: Commit**

```bash
git add frontend/src/pages/FamilyPage.tsx
git commit -m "feat(family-page): add clickable child cards with selection indicator"
```

---

## Task 7: Frontend - FamilyPage - update `loadData()` to pass `child_id` and dynamic chart title

**Files:**
- Modify: `frontend/src/pages/FamilyPage.tsx:1-13, 49-70, 239-254`

- [ ] **Step 7.1: Add `useTimeFilter` import and a `useEffect` watch on `selectedChildId`**

Find the existing import block at the top of the file (lines 1-13). Add `useTimeFilter` import (we'll use it for the history section's period control... actually, the spec says no period control, so skip this). Instead, add a new effect to re-load data when `selectedChildId` changes.

After the existing `useEffect(() => { loadData(); }, [loadData]);` block (line 68-70), add:

```tsx
    useEffect(() => {
        loadData();
    }, [selectedChildId, loadData]);
```

- [ ] **Step 7.2: Refactor `loadData()` to pass `child_id`**

Find the `loadData` function (lines 49-66). Replace it with:

```tsx
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { child_id: selectedChildId ?? undefined };
            const [s, hist, kids] = await Promise.all([
                fetchFamilyMonthlySummary(params),
                fetchFamilyHistoricalData(params),
                fetchChildrenBalancesService(),
            ]);
            setSummary(s);
            setHistoricalData(hist);
            setChildren(kids.filter((k) => k.is_active));
            setError(null);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Gagal memuat data anggota keluarga.');
        } finally {
            setLoading(false);
        }
    }, [selectedChildId]);
```

- [ ] **Step 7.3: Update the chart card title to be dynamic**

Find the chart card (lines 239-254). Replace the inner title `div` (line 241-243):

Find:
```tsx
                <Card.Body className="p-4">
                    <div className="fw-bold mb-4 text-dark" style={{ fontSize: 22 }}>
                        Analisis Keuangan
                    </div>
```

Replace with:
```tsx
                <Card.Body className="p-4">
                    <div className="fw-bold mb-4 text-dark" style={{ fontSize: 22 }}>
                        Analisis Keuangan - {summary?.username || 'Semua Anak'}
                    </div>
```

- [ ] **Step 7.4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7.5: Commit**

```bash
git add frontend/src/pages/FamilyPage.tsx
git commit -m "feat(family-page): pass child_id to data fetches and dynamic chart title"
```

---

## Task 8: Frontend - FamilyPage - add Riwayat Transaksi section

**Files:**
- Modify: `frontend/src/pages/FamilyPage.tsx:1-13, 33-48, 254-end`

- [ ] **Step 8.1: Add `transactions` state and import for `TransactionHistoryItem`**

In the state declarations block (around line 33-48), add:

```tsx
    const [transactions, setTransactions] = useState<ReportTypes.TransactionHistoryItem[]>([]);
```

Find the imports at the top of the file (lines 1-13). The `import type * as ReportTypes from '../types/report.types';` line is already present; no new type import is needed.

- [ ] **Step 8.2: Update `loadData()` to also fetch history**

Modify the `loadData` callback to also fetch `fetchFamilyTransactionHistory`. Replace the `loadData` function with:

```tsx
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { child_id: selectedChildId ?? undefined };
            const [s, hist, kids, history] = await Promise.all([
                fetchFamilyMonthlySummary(params),
                fetchFamilyHistoricalData(params),
                fetchChildrenBalancesService(),
                fetchFamilyTransactionHistory(params),
            ]);
            setSummary(s);
            setHistoricalData(hist);
            setChildren(kids.filter((k) => k.is_active));
            setTransactions(history);
            setError(null);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Gagal memuat data anggota keluarga.');
        } finally {
            setLoading(false);
        }
    }, [selectedChildId]);
```

Add the import for `fetchFamilyTransactionHistory` at the top of the file. The existing import block already has `import { fetchFamilyMonthlySummary, fetchFamilyHistoricalData } from '../services/report.service';`. Extend it to:

```tsx
import { fetchFamilyMonthlySummary, fetchFamilyHistoricalData, fetchFamilyTransactionHistory } from '../services/report.service';
```

- [ ] **Step 8.3: Add the Riwayat Transaksi section below the chart card**

Find the closing of the chart card (after line 254, which is the closing `</Card>` and then `<AddChildModal ...`). Insert the new section before `<AddChildModal`. The insertion point is right after the chart `</Card>` and before `<AddChildModal`:

Add:

```tsx
            {children.length > 0 && (
                <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 25 }}>
                    <Card.Body className="p-4">
                        <div className="fw-bold mb-3 text-dark" style={{ fontSize: 20 }}>
                            Riwayat Transaksi - {summary?.username || 'Semua Anak'}
                        </div>
                        <div className="d-flex justify-content-between mb-3 px-2">
                            <div className="text-center flex-fill">
                                <div className="text-muted small">Pemasukan</div>
                                <div className="fw-bold text-success" style={{ fontSize: 16 }}>
                                    {formatRupiah(summary?.totalPemasukan || 0)}
                                </div>
                            </div>
                            <div className="text-center flex-fill" style={{ borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                <div className="text-muted small">Pengeluaran</div>
                                <div className="fw-bold text-danger" style={{ fontSize: 16 }}>
                                    {formatRupiah(summary?.totalPengeluaran || 0)}
                                </div>
                            </div>
                            <div className="text-center flex-fill">
                                <div className="text-muted small">Neto</div>
                                <div
                                    className="fw-bold"
                                    style={{
                                        fontSize: 16,
                                        color: (summary?.neto || 0) >= 0 ? '#28a745' : '#dc3545',
                                    }}
                                >
                                    {(summary?.neto || 0) >= 0 ? '+' : ''}{formatRupiah(summary?.neto || 0)}
                                </div>
                            </div>
                        </div>
                        <div style={{ maxHeight: 400, overflowY: 'auto' }} className="no-scrollbar px-1">
                            {transactions.length === 0 ? (
                                <div className="text-center p-4 text-muted">
                                    <p className="mb-0">Belum ada transaksi.</p>
                                </div>
                            ) : (
                                transactions.slice(0, 20).map((tx) => (
                                    <Card key={tx.id_transaksi} className="mb-3 shadow-sm border-0" style={{ borderRadius: '18px', overflow: 'hidden' }}>
                                        <Card.Body className="p-3">
                                            <div className="d-flex align-items-center gap-3">
                                                <div
                                                    className="d-flex align-items-center justify-content-center flex-shrink-0"
                                                    style={{
                                                        width: '45px',
                                                        height: '45px',
                                                        borderRadius: '14px',
                                                        backgroundColor: tx.jenis === 'pemasukan' ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                                                        color: tx.jenis === 'pemasukan' ? '#28a745' : '#dc3545',
                                                        fontSize: '20px',
                                                    }}
                                                >
                                                    {React.createElement((Icons as any)[tx.icon_kategori || 'Tag'] || Tag)}
                                                </div>
                                                <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
                                                    <div className="fw-bold text-dark text-truncate" style={{ fontSize: '14px', maxWidth: '100%' }} title={tx.keterangan || ''}>
                                                        {(tx.keterangan || '').replace('Kontribusi Target ID:', 'Tabungan #') || 'Tanpa keterangan'}
                                                    </div>
                                                    <small className="text-muted text-truncate" style={{ fontSize: '11px' }}>
                                                        {tx.username && <span className="fw-medium text-primary me-1">{tx.username}</span>}
                                                        {tx.nama_kategori || 'Lainnya'} • {new Date(tx.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                                    </small>
                                                </div>
                                                <div
                                                    className="fw-bold flex-shrink-0"
                                                    style={{
                                                        color: tx.jenis === 'pemasukan' ? '#28a745' : '#dc3545',
                                                        fontSize: '14px',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {tx.jenis === 'pengeluaran' ? '- ' : '+ '}
                                                    {formatRupiah(tx.jumlah)}
                                                </div>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                ))
                            )}
                        </div>
                    </Card.Body>
                </Card>
            )}
```

- [ ] **Step 8.4: Add missing imports `Tag` and `* as Icons`**

Current imports in `FamilyPage.tsx` (verified) are:
```tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Row, Col, Card, Form, Button, Alert, Spinner, Modal } from 'react-bootstrap';
import MainLayout from '../components/MainLayout';
import { Plus, EyeFill, EyeSlashFill, Trash } from 'react-bootstrap-icons';
```

`React` is already imported. Add `Tag` and `* as Icons` by extending the bootstrap-icons import line. Replace the existing line:

```tsx
import { Plus, EyeFill, EyeSlashFill, Trash } from 'react-bootstrap-icons';
```

With:

```tsx
import * as Icons from 'react-bootstrap-icons';
import { Plus, EyeFill, EyeSlashFill, Trash, Tag } from 'react-bootstrap-icons';
```

- [ ] **Step 8.5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8.6: Lint**

Run: `cd frontend && npm run lint`
Expected: No errors. If unused-import warnings appear, clean them up.

- [ ] **Step 8.7: Commit**

```bash
git add frontend/src/pages/FamilyPage.tsx
git commit -m "feat(family-page): add Riwayat Transaksi section filtered by selected child"
```

---

## Task 9: Final validation

**Files:** none

- [ ] **Step 9.1: Run backend test suite**

Run: `cd backend-laravel && php artisan test`
Expected: All tests pass (no regressions, all 10 new tests pass).

- [ ] **Step 9.2: Run frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 9.3: Run frontend lint**

Run: `cd frontend && npm run lint`
Expected: No lint errors.

- [ ] **Step 9.4: Manual smoke test checklist**

Document results in commit message body. Verify each:

- [ ] Login sebagai parent, navigasi ke halaman "Anggota Keluarga"
- [ ] Default: chart menampilkan data semua anak, section riwayat menampilkan transaksi semua anak
- [ ] Klik kartu anak A: chart dan riwayat berganti ke data anak A, kartu A punya border biru, kartu "Saldo Total Anak" kehilangan border
- [ ] Klik kartu anak B: chart dan riwayat berganti ke data anak B
- [ ] Klik kartu "Saldo Total Anak": chart dan riwayat kembali ke data semua anak
- [ ] Klik tombol deposit pada kartu anak aktif: modal deposit muncul, kartu tetap aktif
- [ ] Klik tombol hapus pada kartu anak aktif: modal konfirmasi muncul, kartu tetap aktif
- [ ] Refresh halaman: state kembali ke default (semua anak)
- [ ] Parent dengan 0 anak: section riwayat tidak muncul

- [ ] **Step 9.5: Final commit (if any trailing fixes)**

If manual testing revealed bugs fixed inline:
```bash
git add -A
git commit -m "fix(family-page): address issues from manual smoke test"
```

---

## Self-Review Notes

**Spec coverage:**
- Backend `child_id` support on 5 endpoints: Tasks 1-4 ✓
- Ownership validation: Task 1 (helper) ✓
- Frontend `child_id` in FilterParams: Task 5 ✓
- Frontend `username` in MonthlySummary: Task 5 ✓
- Clickable child cards with selection: Task 6 ✓
- "Saldo Total Anak" card clickable to deselect: Task 6 ✓
- `stopPropagation` on deposit/delete buttons: Task 6 ✓
- Dynamic chart title: Task 7 ✓
- `loadData` passes child_id: Task 7 ✓
- `useEffect` re-fetches on child change: Task 7 ✓
- Stale-selection cleanup: Task 6 ✓
- New Riwayat Transaksi section: Task 8 ✓
- Summary mini (Pemasukan/Pengeluaran/Neto): Task 8 ✓
- List of up to 20 transactions: Task 8 ✓
- Empty state: Task 8 ✓
- Hidden when no children: Task 8 ✓

**Placeholder scan:** No TBD/TODO. All code blocks are complete.

**Type consistency:** `selectedChildId` is `string | null` everywhere. `child_id` in `FilterParams` is `string | undefined` (matches existing pattern). `username` is optional on `MonthlySummary`. `transactions` typed as `TransactionHistoryItem[]`.
