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
