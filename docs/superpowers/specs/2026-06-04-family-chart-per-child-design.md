# Filter Chart & Riwayat per Anak di FamilyPage

**Tanggal:** 2026-06-04
**Status:** Approved
**Scope:** Halaman `Anggota Keluarga` (FamilyPage) di DuitFam

## Tujuan

Memungkinkan orang tua memilih salah satu kartu anak di halaman Anggota Keluarga untuk memfilter chart Analisis Keuangan dan section Riwayat Transaksi di bawahnya ke data anak tersebut. Default: tampilkan gabungan semua anak.

## Perubahan

### Backend (`backend-laravel/app/Http\Controllers/Api/ReportController.php`)

Tambah parameter `child_id` (query string) di 5 endpoint keluarga, dengan aturan:

- Jika `child_id` kosong/tidak ada -> perilaku existing (pakai `group`)
- Jika `child_id` ada -> override `allUserIds` menjadi `[$childId]` saja, abaikan `group`
- Validasi: `child_id` harus terdaftar di `ParentChildRelation` dengan `parent_id = currentUser.id` dan `is_active = true`. Jika tidak valid -> HTTP 403 dengan pesan "Anak tidak ditemukan dalam keluarga Anda."

Endpoint yang berubah:
1. `familySummary(Request $request)` - line ~472
2. `familyHistorical(Request $request)` - line ~484
3. `familyHistory(Request $request)` - line ~566
4. `familyAnalysis(Request $request)` - line ~649
5. `familyAnalysisPdf(Request $request, GroqService $groqService)` - line ~731

Implementasi: extract `private function resolveTargetUserIds(Request $request, string $parentId): array` yang me-return koleksi user ID final berdasarkan kombinasi `group` dan `child_id`. Helper ini digunakan di semua 5 endpoint.

### Frontend Service (`frontend/src/services/report.service.ts`)

Tambah `child_id?: string` ke interface `FilterParams`. Tidak ada perubahan signature fungsi; 5 fungsi yang menerima `FilterParams` otomatis support `child_id` lewat `buildQueryString` yang sudah ada.

### Frontend Types (`frontend/src/types/report.types.ts`)

Tambah field optional `username?: string` di `MonthlySummary` agar UI bisa menampilkan nama anak pada judul chart tanpa lookup tambahan. Field ini diisi di backend pada `familySummary` ketika `child_id` diberikan (lookup username via `User` model).

### Frontend Page (`frontend/src/pages/FamilyPage.tsx`)

**State baru:**
- `selectedChildId: string | null` - null artinya "semua anak"

**Perubahan UI:**

| Elemen | Sebelum | Sesudah |
|---|---|---|
| Kartu "Saldo Total Anak" (atas) | Display only | Bisa di-klik -> `setSelectedChildId(null)`. Border biru `2px solid #1389f9` saat `selectedChildId === null` (indikator aktif) |
| Kartu anak di grid | Hanya deposit & hapus | Klik pada body kartu -> `setSelectedChildId(c.id)`. Border tebal `2px solid #1389f9` saat aktif. Tombol Deposit & Hapus pakai `e.stopPropagation()` |
| Kartu chart "Analisis Keuangan" | Judul statis | Judul dinamis: `Analisis Keuangan - {username}` atau `Analisis Keuangan - Semua Anak` |
| Section riwayat di bawah chart | Tidak ada | Section baru dengan summary mini + list max 20 transaksi |

**Section Riwayat baru (di bawah chart):**
- Header dinamis: `Riwayat Transaksi - {username}` atau `- Semua Anak`
- Summary mini (1 baris, color-coded): Pemasukan hijau, Pengeluaran merah, Neto biru
- List transaksi: card per transaksi, format identik dengan TransactionHistory.tsx (ikon kategori, username, tanggal, jumlah, color-coded)
- Limit: 20 item, scroll dalam container dengan tinggi max ~400px
- Empty state: "Belum ada transaksi"
- Hidden ketika `children.length === 0`

**Refactor `loadData()`:**
- Bikin helper `buildParams()` yang me-return `{ child_id: selectedChildId }` atau `{}` (kosong artinya "semua anak" sesuai default backend `group=semua`)
- Pakai di 3 call: `fetchFamilyMonthlySummary`, `fetchFamilyHistoricalData`, dan call baru `fetchFamilyTransactionHistory`

**Re-fetch trigger:**
- `useEffect` yang watch `[selectedChildId]` memanggil `loadData()` lagi

**Edge case: child dihapus saat sedang dipilih**
- `children` di-filter `is_active=true` pada `loadData`
- Tambahkan effect: jika `selectedChildId !== null && !children.find(c => c.id === selectedChildId)`, set `selectedChildId = null`

## File yang Diubah

1. `backend-laravel/app/Http\Controllers/Api/ReportController.php` (modifikasi)
2. `frontend/src/services/report.service.ts` (1 baris ditambah ke interface)
3. `frontend/src/types/report.types.ts` (1 field optional ditambah)
4. `frontend/src/pages/FamilyPage.tsx` (mayoritas perubahan)

## Test Plan

- **Backend:** tambah unit test untuk `child_id` valid (anak milik parent), invalid (bukan anak), dan kombinasi dengan `group` (child_id menang).
- **Manual frontend:**
  - Klik tiap kartu anak -> chart & history update ke data anak tersebut
  - Klik kartu "Saldo Total Anak" -> kembali ke data semua anak
  - Klik tombol deposit/hapus pada kartu aktif -> modal muncul, kartu tetap aktif
  - Refresh halaman -> state kembali default (semua anak)
  - Test dengan parent yang punya 0 anak, 1 anak, banyak anak
  - Test pada viewport mobile dan desktop
- **Lint & typecheck:** `npm run lint`, `npx tsc --noEmit`

## Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Performa: load ulang 3 endpoint setiap klik | Data chart & history ringan (max 100 transaksi); debounce tidak diperlukan |
| State race condition saat klik cepat | `loadData` sudah async-safe; loading flag mencegah double-fetch |
| Child dihapus saat sedang dipilih | Effect clear `selectedChildId` jika id tidak ada di list children aktif |
| Tombol deposit/hapus terpicu saat klik kartu | Pakai `e.stopPropagation()` pada tombol |

## Di Luar Scope

- Filter berdasarkan kategori atau jenis transaksi di FamilyPage (sudah ada di AnalisisPage)
- Tambah chart tambahan per kategori
- Sort/filter history list (pemasukan/pengeluaran/semua)
- Pagination history list
- View filter button-group "Semua/Orang Tua/Anak" di FamilyPage (FamilyPage tidak punya, hanya DashboardPage yang punya)
- Perubahan pada AnalisisPage atau DashboardPage
