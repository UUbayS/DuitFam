# Family Analysis PDF Export — Design

**Date:** 2026-06-02
**Status:** Approved
**Branch:** Back-End
**Author:** Brainstorming session

## Problem

`AnalisisPage` already renders the family financial analysis (summary, top expenses, 50/30/20 recommendation, smart recommendation) and `SpendingTipsController` produces an AI narrative. However, there is no way for a parent to share, archive, or print the analysis. The data is locked behind the UI.

Parents (the target audience) want a one-click PDF download of the monthly family report so they can review offline, print for family meetings, or share with a co-parent who is not on the app.

## Goals

- Parent can download a PDF of the family analysis for any selected calendar month.
- The PDF mirrors the in-app analysis content the parent already sees, in Indonesian.
- The PDF includes the AI narrative from the existing `GroqService`.
- Non-parents cannot generate the PDF.
- No new infrastructure (queue, scheduler, email).

## Non-Goals

- Charts in the PDF (DomPDF cannot render canvas; would need a server-side chart library — out of scope).
- Email delivery, scheduled auto-generation, report history.
- Per-child breakdown in the PDF.
- CSV export of transactions.
- Generating PDFs for the per-user (non-family) analysis view in this iteration.

## Design

### Architecture

New endpoint `GET /api/reports/family/analysis/pdf?month=YYYY-MM` returns an `application/pdf` stream. The endpoint reuses the existing `ReportController::buildFamilySummary()` helper and the same aggregation logic used by `familyAnalysis()` to assemble the data, then renders a Blade template through DomPDF. The AI narrative is produced by calling the existing `GroqService::generateSpendingTips()` (or `generateRuleBasedSpendingTips()` fallback) with the family-aggregated data.

Authentication: existing `auth.token` middleware. Authorization: parent role only (matches `familyAnalysis`).

### Components

**Backend**

- `barryvdh/laravel-dompdf` — new Composer dependency.
- `app/Http/Controllers/Api/ReportController.php` — new `familyAnalysisPdf(Request $request)` method.
- `app/Http/Requests/ReportPeriodRequest.php` — new form-request class that validates `month` as `regex:/^\d{4}-(0[1-9]|1[0-2])$/`. Reusable for any future report endpoint that needs the same param.
- `resources/views/reports/family-analysis-pdf.blade.php` — single-page Indonesian layout.
- `routes/api.php` — register `Route::get('/reports/family/analysis/pdf', [ReportController::class, 'familyAnalysisPdf'])`.

**Frontend**

- `src/services/report.service.ts` — new function `fetchFamilyAnalysisPdf(month: string): Promise<Blob>`. Uses existing axios client; response type `blob`.
- `src/pages/AnalisisPage.tsx` — new "Unduh PDF" button rendered whenever `isParent === true` (the page only loads family data for parents, so the button is always relevant in that mode). Show spinner during generation; on success, create a temporary anchor element and trigger download with filename `Laporan-Keluarga-YYYY-MM.pdf`.

### Data Flow

1. Parent clicks "Unduh PDF" in `AnalisisPage` while a family view is active and a month is selected.
2. Frontend calls `GET /api/reports/family/analysis/pdf?month=YYYY-MM` with the existing auth header.
3. Controller:
   - Returns 403 if `role !== 'parent'`.
   - Returns 422 if `month` fails the regex.
   - Builds the same summary the JSON endpoint returns by calling `buildFamilySummary()` and re-running the category-aggregation logic from `familyAnalysis()`.
   - Calls `GroqService::generateSpendingTips($familyContext)` where `$familyContext` has the same shape `getFinancialContext()` produces, but populated with family-aggregated data and a synthetic `user.role = 'parent'` so the existing prompt path works.
   - Passes the data to the Blade view.
4. Blade renders HTML; DomPDF converts to PDF.
5. Controller returns `Response::streamDownload(fn () => print $pdf->output(), 'Laporan-Keluarga-'.$month.'.pdf', ['Content-Type' => 'application/pdf'])`.
6. Browser receives the file and triggers download.

### Blade view (`family-analysis-pdf.blade.php`)

Single page, A4 portrait, Bootstrap-flavoured inline styles (no external CSS — DomPDF will not fetch it). Sections, top to bottom:

- **Header:** "Laporan Keuangan Keluarga — [Bulan Indonesia YYYY]" (e.g., "Laporan Keuangan Keluarga — Juni 2026"), parent username, generation timestamp.
- **Stat cards (3 across):** Total Pemasukan, Total Pengeluaran, Neto. Formatted with `number_format(..., 0, ',', '.')` and `Rp` prefix.
- **50/30/20 allocation table:** Need / Want / Save, with computed amounts from `totalPemasukan`.
- **Top expense category:** name + amount + percentage (or "Tidak ada data" if empty).
- **Smart recommendation:** static string from controller (existing `familyAnalysis` logic).
- **AI narrative:** rendered as plain paragraphs (no markdown — strip any `**` or `#` defensively).
- **Footer:** "Digenerate oleh DuitFam · [timestamp]".

Indonesian month names: use a static `['Januari','Februari',...,'Desember']` array in the view.

### Error Handling

| Failure | Response |
|---|---|
| Caller is not a parent | 403 JSON `{message: "Hanya akun parent yang dapat mengunduh laporan keluarga."}` |
| `month` param missing or malformed | 422 JSON with validation errors |
| AI provider times out / errors | Use `generateRuleBasedSpendingTips()` fallback, same pattern as `SpendingTipsController` |
| DomPDF render throws | Log error, return 500 JSON `{message: "Gagal membuat PDF. Silakan coba lagi."}` |
| Selected month has no transactions | Render report with zero values, no error |
| User not authenticated | 401 (handled by existing middleware) |

### Testing

- **Feature test (`tests/Feature/ReportPdfTest.php`):**
  - `parent_can_download_family_analysis_pdf` — seed parent + child + transactions, call endpoint with valid month, assert 200, `Content-Type: application/pdf`, body starts with `%PDF`.
  - `child_cannot_download_family_analysis_pdf` — assert 403.
  - `invalid_month_returns_422` — pass `month=2026-13`, assert 422.
  - `missing_month_uses_current_month` — assert 200 (defaults to current month).
- **Unit test:**
  - `ReportPeriodRequest::rules()` returns the expected regex.
- **Manual:**
  - Download PDF in browser, verify Indonesian text renders, numbers match the on-screen numbers, 50/30/20 amounts correct, AI narrative present, no broken UTF-8.

### File Touch List

Backend:
- `backend-laravel/composer.json` (add `barryvdh/laravel-dompdf`)
- `backend-laravel/app/Http/Controllers/Api/ReportController.php` (add `familyAnalysisPdf`)
- `backend-laravel/app/Http/Requests/ReportPeriodRequest.php` (new)
- `backend-laravel/resources/views/reports/family-analysis-pdf.blade.php` (new)
- `backend-laravel/routes/api.php` (add route)
- `backend-laravel/tests/Feature/ReportPdfTest.php` (new)

Frontend:
- `frontend/src/services/report.service.ts` (add `fetchFamilyAnalysisPdf`)
- `frontend/src/pages/AnalisisPage.tsx` (add button + download handler)

## Open Questions

None. All decisions captured above.
