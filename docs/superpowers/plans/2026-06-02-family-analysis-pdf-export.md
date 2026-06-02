# Family Analysis PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click PDF download of the family monthly analysis to the existing `AnalisisPage`, mirroring the on-screen summary + AI narrative in Indonesian.

**Architecture:** New `GET /api/reports/family/analysis/pdf?month=YYYY-MM` endpoint in the existing `ReportController`. Reuses `buildFamilySummary()` and the existing category-aggregation logic. Calls `GroqService::generateSpendingTips()` (with a family-aggregated context) for the narrative, then renders a Blade template through `barryvdh/laravel-dompdf` and streams the result. Frontend adds an "Unduh PDF" button to `AnalisisPage` that triggers a blob download.

**Tech Stack:** Laravel 12, MongoDB (existing), `barryvdh/laravel-dompdf` (new), React 19 + TypeScript + Vite (existing), Bootstrap 5 (existing), Axios (existing), PHPUnit 11 (existing).

---

## File Structure

**Backend (new unless noted):**
- `backend-laravel/composer.json` — add `barryvdh/laravel-dompdf`
- `backend-laravel/app/Http/Requests/ReportPeriodRequest.php` — validates `month` param
- `backend-laravel/app/Http/Controllers/Api/ReportController.php` — add `familyAnalysisPdf()` method
- `backend-laravel/resources/views/reports/family-analysis-pdf.blade.php` — DomPDF template
- `backend-laravel/routes/api.php` — register new route
- `backend-laravel/tests/Unit/ReportPeriodRequestTest.php` — validation rules
- `backend-laravel/tests/Feature/ReportFamilyAnalysisPdfTest.php` — endpoint behaviour

**Frontend:**
- `frontend/src/services/report.service.ts` — add `fetchFamilyAnalysisPdf()`
- `frontend/src/pages/AnalisisPage.tsx` — add "Unduh PDF" button + download handler

---

## Task 1: Install DomPDF

**Files:**
- Modify: `backend-laravel/composer.json`
- Modify: `backend-laravel/composer.lock` (auto-generated)

- [ ] **Step 1: Add the package**

Run from `backend-laravel/`:
```bash
composer require barryvdh/laravel-dompdf
```
Expected: package installs, `composer.json` and `composer.lock` updated. The `barryvdh/laravel-dompdf` line appears under `require`.

- [ ] **Step 2: Verify provider auto-discovery**

The package uses Laravel auto-discovery, so `config/app.php` does not need manual edits in Laravel 11+. Verify by running:
```bash
php artisan list | findstr "dompdf"
```
Expected (Windows): output includes `dompdf` somewhere (e.g. `vendor:publish` for `dompdf`).

- [ ] **Step 3: Smoke-test the PDF facade resolves**

```bash
php artisan tinker --execute="echo get_class(\Barryvdh\DomPDF\Facade\Pdf::loadHtml('<p>ok</p>'));"
```
Expected: prints a class name containing `DomPDF` or `PDF`. No "class not found" error.

- [ ] **Step 4: Commit**

```bash
cd backend-laravel
git add composer.json composer.lock
git commit -m "chore(deps): add barryvdh/laravel-dompdf for PDF report export"
```

---

## Task 2: `ReportPeriodRequest` — failing test

**Files:**
- Create: `backend-laravel/tests/Unit/ReportPeriodRequestTest.php`

- [ ] **Step 1: Write the failing test**

Create `backend-laravel/tests/Unit/ReportPeriodRequestTest.php`:
```php
<?php

namespace Tests\Unit;

use App\Http\Requests\ReportPeriodRequest;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class ReportPeriodRequestTest extends TestCase
{
    private function validate(array $data): bool
    {
        $request = new ReportPeriodRequest();
        $validator = Validator::make($data, $request->rules());
        return $validator->passes();
    }

    public function test_valid_month_passes(): void
    {
        $this->assertTrue($this->validate(['month' => '2026-06']));
    }

    public function test_missing_month_passes(): void
    {
        $this->assertTrue($this->validate([]));
    }

    public function test_invalid_month_format_fails(): void
    {
        $this->assertFalse($this->validate(['month' => '2026-13']));
        $this->assertFalse($this->validate(['month' => '06-2026']));
        $this->assertFalse($this->validate(['month' => 'not-a-month']));
    }
}
```

- [ ] **Step 2: Run the test, confirm it fails**

Run from `backend-laravel/`:
```bash
php artisan test --filter=ReportPeriodRequestTest
```
Expected: FAIL with `Class "App\Http\Requests\ReportPeriodRequest" not found`.

- [ ] **Step 3: Create the form-request class**

Create `backend-laravel/app/Http/Requests/ReportPeriodRequest.php`:
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReportPeriodRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'month' => ['nullable', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'month.regex' => 'Format month harus YYYY-MM (contoh: 2026-06).',
        ];
    }
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run from `backend-laravel/`:
```bash
php artisan test --filter=ReportPeriodRequestTest
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd backend-laravel
git add app/Http/Requests/ReportPeriodRequest.php tests/Unit/ReportPeriodRequestTest.php
git commit -m "feat(reports): add ReportPeriodRequest form-request with month validation"
```

---

## Task 3: Controller method — failing test (auth + happy path)

**Files:**
- Create: `backend-laravel/tests/Feature/ReportFamilyAnalysisPdfTest.php`
- Modify: `backend-laravel/app/Http/Controllers/Api/ReportController.php`

- [ ] **Step 1: Write the failing feature test**

Create `backend-laravel/tests/Feature/ReportFamilyAnalysisPdfTest.php`:
```php
<?php

namespace Tests\Feature;

use App\Models\ParentChildRelation;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class ReportFamilyAnalysisPdfTest extends TestCase
{
    private function makeUser(string $role): User
    {
        $user = new User();
        $user->username = $role . '_' . uniqid();
        $user->email = $role . '_' . uniqid() . '@test.local';
        $user->password = bcrypt('Password1');
        $user->role = $role;
        $user->save();
        return $user;
    }

    private function authHeaders(User $user): array
    {
        $token = 'test-token-' . $user->id;
        Auth::login($user);
        return ['Authorization' => 'Bearer ' . $token];
    }

    public function test_child_cannot_download_family_pdf(): void
    {
        $child = $this->makeUser('child');

        $response = $this->withHeaders($this->authHeaders($child))
            ->get('/api/reports/family/analysis/pdf?month=2026-06');

        $response->assertStatus(403);
    }

    public function test_invalid_month_returns_422(): void
    {
        $parent = $this->makeUser('parent');

        $response = $this->withHeaders($this->authHeaders($parent))
            ->get('/api/reports/family/analysis/pdf?month=2026-13');

        $response->assertStatus(422);
    }

    public function test_parent_can_download_family_pdf(): void
    {
        $parent = $this->makeUser('parent');

        $response = $this->withHeaders($this->authHeaders($parent))
            ->get('/api/reports/family/analysis/pdf?month=2026-06');

        $response->assertStatus(200);
        $this->assertStringContainsString('application/pdf', $response->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $response->streamedContent());
    }
}
```

- [ ] **Step 2: Run the test, confirm it fails (route does not exist yet)**

Run from `backend-laravel/`:
```bash
php artisan test --filter=ReportFamilyAnalysisPdfTest
```
Expected: 404 or 405 on all three cases (route not registered).

- [ ] **Step 3: Create the Blade view**

Create `backend-laravel/resources/views/reports/family-analysis-pdf.blade.php`:
```blade
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan Keuangan Keluarga</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #1f2937; font-size: 12px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin-top: 18px; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .meta { color: #6b7280; font-size: 10px; margin-bottom: 16px; }
        .cards { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .cards td { width: 33.33%; padding: 8px; border: 1px solid #e5e7eb; text-align: center; }
        .cards .label { color: #6b7280; font-size: 10px; text-transform: uppercase; }
        .cards .value { font-size: 14px; font-weight: bold; margin-top: 4px; }
        .income { color: #15803d; }
        .expense { color: #b91c1c; }
        table.alloc { width: 100%; border-collapse: collapse; margin-top: 4px; }
        table.alloc th, table.alloc td { border: 1px solid #e5e7eb; padding: 6px; text-align: left; }
        .narrative p { margin: 0 0 6px 0; line-height: 1.5; }
        .footer { margin-top: 24px; color: #9ca3af; font-size: 9px; text-align: center; }
    </style>
</head>
<body>
    <h1>Laporan Keuangan Keluarga &mdash; {{ $bulanLabel }}</h1>
    <div class="meta">
        Keluarga: {{ $parentName }} &middot; Digenerate: {{ $generatedAt }}
    </div>

    <h2>Ringkasan</h2>
    <table class="cards">
        <tr>
            <td>
                <div class="label">Total Pemasukan</div>
                <div class="value income">Rp {{ number_format($summary['totalPemasukan'], 0, ',', '.') }}</div>
            </td>
            <td>
                <div class="label">Total Pengeluaran</div>
                <div class="value expense">Rp {{ number_format($summary['totalPengeluaran'], 0, ',', '.') }}</div>
            </td>
            <td>
                <div class="label">Neto</div>
                <div class="value">Rp {{ number_format($summary['neto'], 0, ',', '.') }}</div>
            </td>
        </tr>
    </table>

    <h2>Alokasi 50/30/20</h2>
    <table class="alloc">
        <thead>
            <tr><th>Kategori</th><th>Persentase</th><th>Nominal</th></tr>
        </thead>
        <tbody>
            <tr><td>Kebutuhan</td><td>50%</td><td>Rp {{ number_format($allocation['need'], 0, ',', '.') }}</td></tr>
            <tr><td>Keinginan</td><td>30%</td><td>Rp {{ number_format($allocation['want'], 0, ',', '.') }}</td></tr>
            <tr><td>Tabungan/Investasi</td><td>20%</td><td>Rp {{ number_format($allocation['save'], 0, ',', '.') }}</td></tr>
        </tbody>
    </table>

    <h2>Pengeluaran Terbesar</h2>
    @if($topExpense)
        <p>
            <strong>{{ $topExpense['namaKategori'] }}</strong> &mdash;
            Rp {{ number_format($topExpense['jumlah'], 0, ',', '.') }}
            ({{ number_format($topExpense['persentase'], 1, ',', '.') }}% dari total pengeluaran)
        </p>
    @else
        <p>Tidak ada data pengeluaran untuk bulan ini.</p>
    @endif

    <h2>Saran Otomatis</h2>
    <p>{{ $smartRecommendation }}</p>

    <h2>Catatan AI Advisor</h2>
    <div class="narrative">
        @forelse($narrativeParagraphs as $paragraph)
            <p>{{ $paragraph }}</p>
        @empty
            <p>Tidak ada catatan tambahan dari AI Advisor untuk bulan ini.</p>
        @endforelse
    </div>

    <div class="footer">
        Digenerate oleh DuitFam &middot; {{ $generatedAt }}
    </div>
</body>
</html>
```

- [ ] **Step 4: Add `familyAnalysisPdf()` to `ReportController`**

Open `backend-laravel/app/Http/Controllers/Api/ReportController.php`. Add this import at the top with the other `use` statements:
```php
use App\Http\Requests\ReportPeriodRequest;
use App\Services\GroqService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
```

Then append this method at the end of the class (before the closing `}`):
```php
    public function familyAnalysisPdf(ReportPeriodRequest $request, GroqService $groqService)
    {
        $parent = $request->user();
        if ($parent->role !== config('constants.roles.parent')) {
            return response()->json(['message' => 'Hanya akun parent yang dapat mengunduh laporan keluarga.'], 403);
        }

        $month = $request->input('month', Carbon::now()->format('Y-m'));

        $summary = $this->buildFamilySummary((string) $parent->id, $request);
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

        $expenseQuery = Transaction::query()
            ->whereIn('user_id', $allUserIds->all())
            ->where('jenis', config('constants.transaction_types.pengeluaran'))
            ->where('status', config('constants.transaction_status.berhasil'));

        if ($group === 'semua') {
            $expenseQuery->where('is_internal', '!=', true);
        }

        $expenseQuery->where('tanggal', 'like', $month . '%');

        $expenseByCategory = $expenseQuery->get()
            ->groupBy('category_id')
            ->map(fn ($items) => (float) $items->sum('jumlah'));

        $categoryIds = $expenseByCategory->keys()->filter()->all();
        $categoryMap = Category::whereIn('_id', $categoryIds)->get()->keyBy(fn ($c) => (string) $c->id);

        $topExpense = null;
        if ($expenseByCategory->isNotEmpty()) {
            $topCategoryId = $expenseByCategory->sortDesc()->keys()->first();
            $topAmount = (float) $expenseByCategory->max();
            $topName = $topCategoryId ? ($categoryMap[(string) $topCategoryId]?->nama_kategori ?? 'Lainnya') : 'Lainnya';
            $topExpense = [
                'categoryId' => $topCategoryId,
                'namaKategori' => $topName,
                'jumlah' => $topAmount,
                'persentase' => $summary['totalPengeluaran'] > 0
                    ? round(($topAmount / $summary['totalPengeluaran']) * 100, 2)
                    : 0,
            ];
        }

        $income = (float) $summary['totalPemasukan'];
        $allocation = [
            'need' => round($income * 0.5, 0),
            'want' => round($income * 0.3, 0),
            'save' => round($income * 0.2, 0),
        ];

        $smartRecommendation = $summary['totalPengeluaran'] > $summary['totalPemasukan']
            ? 'Pengeluaran keluarga melebihi pemasukan. Buat batas kategori keluarga dan kurangi pos terbesar.'
            : 'Arus kas keluarga sehat. Terapkan alokasi 50/30/20 dan tingkatkan porsi tabungan.';

        $familyContext = [
            'summary' => [
                'bulan' => $month,
                'totalPemasukan' => $summary['totalPemasukan'],
                'totalPengeluaran' => $summary['totalPengeluaran'],
                'neto' => $summary['neto'],
                'saldoAkhir' => $summary['saldoAkhir'],
            ],
            'spendingByCategory' => $expenseByCategory->map(function ($amount, $categoryId) use ($summary, $categoryMap) {
                $name = $categoryId ? ($categoryMap[(string) $categoryId]?->nama_kategori ?? 'Lainnya') : 'Lainnya';
                return [
                    'categoryId' => $categoryId,
                    'namaKategori' => $name,
                    'jumlah' => (float) $amount,
                    'persentase' => $summary['totalPengeluaran'] > 0
                        ? round(((float) $amount / $summary['totalPengeluaran']) * 100, 2)
                        : 0,
                ];
            })->values()->all(),
            'user' => ['role' => 'parent', 'username' => $parent->username],
            'saving_goals' => [],
            'family' => ['children_count' => $childIds->count()],
        ];

        try {
            $tips = $groqService->generateSpendingTips($familyContext);
        } catch (\Throwable $e) {
            \Log::error('Family PDF narrative failed', ['error' => $e->getMessage()]);
            $tips = [];
        }

        $narrativeParagraphs = $this->flattenTipsToParagraphs($tips);

        $bulanIndo = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
            5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
            9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
        ];
        [$year, $monthNum] = explode('-', $month);
        $bulanLabel = $bulanIndo[(int) $monthNum] . ' ' . $year;

        $generatedAt = Carbon::now()->translatedFormat('d F Y H:i');

        $pdf = Pdf::loadView('reports.family-analysis-pdf', [
            'summary' => $summary,
            'allocation' => $allocation,
            'topExpense' => $topExpense,
            'smartRecommendation' => $smartRecommendation,
            'narrativeParagraphs' => $narrativeParagraphs,
            'parentName' => $parent->username,
            'bulanLabel' => $bulanLabel,
            'generatedAt' => $generatedAt,
        ])->setPaper('a4', 'portrait');

        $filename = 'Laporan-Keluarga-' . $month . '.pdf';

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->output();
        }, $filename, ['Content-Type' => 'application/pdf']);
    }

    private function flattenTipsToParagraphs(array $tips): array
    {
        if (empty($tips)) {
            return [];
        }

        $paragraphs = [];

        $budget = $tips['budget_tips'] ?? [];
        if (!empty($budget)) {
            $lines = array_map(function ($tip) {
                $title = $tip['title'] ?? 'Tips';
                $msg = $tip['message'] ?? '';
                return '• ' . $title . ' — ' . $msg;
            }, $budget);
            $paragraphs[] = 'Tips Anggaran: ' . implode(' | ', $lines);
        }

        $category = $tips['category_tips'] ?? [];
        if (!empty($category)) {
            $lines = array_map(function ($tip) {
                $title = $tip['title'] ?? 'Tips';
                $msg = $tip['message'] ?? '';
                return '• ' . $title . ' — ' . $msg;
            }, $category);
            $paragraphs[] = 'Tips per Kategori: ' . implode(' | ', $lines);
        }

        $saving = $tips['saving_tips'] ?? [];
        if (!empty($saving)) {
            $lines = array_map(function ($tip) {
                $title = $tip['title'] ?? 'Tips';
                $msg = $tip['message'] ?? '';
                return '• ' . $title . ' — ' . $msg;
            }, $saving);
            $paragraphs[] = 'Tips Menabung: ' . implode(' | ', $lines);
        }

        $warnings = $tips['warnings'] ?? [];
        if (!empty($warnings)) {
            $lines = array_map(function ($tip) {
                $title = $tip['title'] ?? 'Peringatan';
                $msg = $tip['message'] ?? '';
                return '• ' . $title . ' — ' . $msg;
            }, $warnings);
            $paragraphs[] = 'Peringatan: ' . implode(' | ', $lines);
        }

        return $paragraphs;
    }
```

- [ ] **Step 5: Register the route**

Open `backend-laravel/routes/api.php`. Inside the `Route::middleware("auth.token")->group(...)` block, immediately after the existing `Route::get("/reports/family/analysis", ...)` line, add:
```php
    Route::get("/reports/family/analysis/pdf", [
        ReportController::class,
        "familyAnalysisPdf",
    ]);
```

- [ ] **Step 6: Run the test, confirm it passes**

Run from `backend-laravel/`:
```bash
php artisan test --filter=ReportFamilyAnalysisPdfTest
```
Expected: 3 tests pass.

If `test_parent_can_download_family_pdf` fails because the streamed content is empty, ensure `APP_DEBUG=true` is set in the test env (it is, via `phpunit.xml`'s `APP_ENV=testing`) and that the `barryvdh/dompdf` service provider is auto-discovered. If it still fails, run `php artisan config:clear` and retry.

- [ ] **Step 7: Commit**

```bash
cd backend-laravel
git add app/Http/Controllers/Api/ReportController.php app/Http/Requests/ReportPeriodRequest.php resources/views/reports/family-analysis-pdf.blade.php routes/api.php tests/Feature/ReportFamilyAnalysisPdfTest.php
git commit -m "feat(reports): add family analysis PDF export endpoint"
```

---

## Task 4: Frontend service function

**Files:**
- Modify: `frontend/src/services/report.service.ts`

- [ ] **Step 1: Inspect the existing service file**

Read `frontend/src/services/report.service.ts`. Locate the section that exports the family analysis fetcher. Note the axios import path.

- [ ] **Step 2: Add the new function**

Append to `frontend/src/services/report.service.ts` (add the import if `axios` is not already imported there; otherwise reuse the existing one):
```ts
import axios from 'axios';

export const fetchFamilyAnalysisPdf = async (month: string): Promise<Blob> => {
  const token = localStorage.getItem('token');
  const response = await axios.get('/api/reports/family/analysis/pdf', {
    params: { month },
    responseType: 'blob',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data as Blob;
};
```

If the file already imports `axios` or a configured client (e.g. `api`), use the existing one instead of adding a duplicate import. Match the file's existing style.

- [ ] **Step 3: Type-check**

Run from `frontend/`:
```bash
npx tsc -b
```
Expected: no errors related to the new function.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/services/report.service.ts
git commit -m "feat(reports): add fetchFamilyAnalysisPdf service function"
```

---

## Task 5: Frontend "Unduh PDF" button

**Files:**
- Modify: `frontend/src/pages/AnalisisPage.tsx`

- [ ] **Step 1: Add imports and state**

Open `frontend/src/pages/AnalisisPage.tsx`. Add to the import from `../services/report.service`:
```ts
import { fetchAnalysisReport, fetchFamilyAnalysisPdf, fetchFamilyAnalysisReport, fetchFamilyHistoricalData, fetchHistoricalData, fetchTransactionHistory, fetchFamilyTransactionHistory } from '../services/report.service';
```

Inside the component, add this state (next to the other `useState` calls near the top of the function body):
```tsx
const [pdfLoading, setPdfLoading] = useState(false);
const [pdfError, setPdfError] = useState<string | null>(null);
```

Also import `useAuth` is already done. Confirm `useAuth` returns `{ user }` with `user.role`. The `isParent` check should be `user?.role === 'parent'`.

- [ ] **Step 2: Add the download handler**

Add this function inside the component (after the existing fetch handlers):
```tsx
const handleDownloadPdf = async () => {
    setPdfError(null);
    setPdfLoading(true);
    try {
        const blob = await fetchFamilyAnalysisPdf(selectedMonth);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Laporan-Keluarga-${selectedMonth}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err: any) {
        console.error('PDF download failed', err);
        setPdfError('Gagal mengunduh PDF. Silakan coba lagi.');
    } finally {
        setPdfLoading(false);
    }
};
```

If the page does not already have `selectedMonth` as state, add:
```tsx
const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
```
and replace the month reference in the existing fetch handlers accordingly.

- [ ] **Step 3: Render the button**

In the JSX, locate the toolbar area where the period selector lives (look for the `useTimeFilter` hook usage or the month dropdown). Add the button immediately after the existing controls, rendered only when the user is a parent:
```tsx
{user?.role === 'parent' && (
    <Button
        variant="outline-primary"
        onClick={handleDownloadPdf}
        disabled={pdfLoading}
        className="ms-2"
    >
        {pdfLoading ? (
            <>
                <Spinner animation="border" size="sm" className="me-2" />
                Menyiapkan PDF...
            </>
        ) : (
            'Unduh PDF'
        )}
    </Button>
)}
{pdfError && <div className="text-danger small mt-2">{pdfError}</div>}
```

- [ ] **Step 4: Type-check and lint**

Run from `frontend/`:
```bash
npx tsc -b
npm run lint
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/pages/AnalisisPage.tsx
git commit -m "feat(reports): add Unduh PDF button to AnalisisPage"
```

---

## Task 6: Manual end-to-end verification

**Files:** none (manual)

- [ ] **Step 1: Start the backend**

Run from `backend-laravel/`:
```bash
php artisan serve
```
Expected: server starts on `http://127.0.0.1:8000`.

- [ ] **Step 2: Start the frontend**

Run from `frontend/` in a separate terminal:
```bash
npm run dev
```
Expected: Vite reports local URL.

- [ ] **Step 3: Log in as a parent**

Open the frontend URL, log in as the seeded parent account, navigate to the Analisis page.

- [ ] **Step 4: Click "Unduh PDF"**

Click the new button. Expected: browser downloads `Laporan-Keluarga-YYYY-MM.pdf` within a few seconds.

- [ ] **Step 5: Open the PDF**

Open the file. Verify:
- Title shows the correct Indonesian month + year
- Three stat cards show formatted Rupiah amounts
- 50/30/20 table shows three rows
- "Pengeluaran Terbesar" shows the top category or "Tidak ada data"
- "Saran Otomatis" line is present
- "Catatan AI Advisor" contains at least one paragraph (rule-based fallback is acceptable when offline)
- No garbled UTF-8 characters

- [ ] **Step 6: Verify the child cannot download**

Log in as a child user, navigate to the Analisis page. The "Unduh PDF" button should not render. Confirm.

If the button is visible to a child, the `user?.role === 'parent'` guard in Task 5 is missing — fix before continuing.

- [ ] **Step 7: Run the full test suite**

Run from `backend-laravel/`:
```bash
php artisan test
```
Expected: all tests pass, including the new `ReportFamilyAnalysisPdfTest` and `ReportPeriodRequestTest`.

- [ ] **Step 8: Final commit (if any fixes were needed)**

```bash
cd backend-laravel && git add -A && git commit -m "fix(reports): address manual QA findings for PDF export"
cd ../frontend && git add -A && git commit -m "fix(reports): address manual QA findings for PDF button"
```

---

## Self-Review Checklist

- [x] Every spec requirement has a task: backend endpoint, validation, Blade view, route, frontend service, frontend button, tests, error handling, fallback narrative.
- [x] No "TBD" / "TODO" / "fill in" placeholders.
- [x] Type/method names consistent: `familyAnalysisPdf` (controller), `fetchFamilyAnalysisPdf` (service), `handleDownloadPdf` (handler) all used identically across tasks.
- [x] Test commands use the project's actual test runner (`php artisan test`, `npx tsc -b`, `npm run lint`).
- [x] Commits are small, atomic, and conventional.
