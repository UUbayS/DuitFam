export interface MonthlySummary { 
    bulan: string; // YYYY-MM
    totalPemasukan: number;
    totalPengeluaran: number;
    neto: number; // Pemasukan - Pengeluaran
    saldoAkhir: number;
    persentasePemasukan?: number;
    persentasePengeluaran?: number;
}

export interface TransactionHistoryItem { // <-- TIPE DATA BARU
    id_transaksi: string;
    user_id?: string;
    jenis: 'pemasukan' | 'pengeluaran';
    jumlah: number;
    keterangan: string;
    tanggal: string; 
    created_at: string; 
    nama_kategori: string;
    status?: 'berhasil' | 'pending' | 'ditolak';
}

export interface ReportCategory {
    namaKategori: string;
    persentase: number;
    jumlah: number;
}

export interface AnalysisReport {
    summary: MonthlySummary;
    topPemasukan: ReportCategory | null;
    topPengeluaran: ReportCategory | null;
    chartData: { month: string; pemasukan: number; pengeluaran: number }[];
    smartRecommendation?: string;
    spendingByCategory?: Array<{ categoryId: string | null; namaKategori: string; jumlah: number; persentase: number }>;
    recommendation?: {
        namaMetode: string;
        deskripsiMetode?: string;
        detailRekomendasi?: string;
        langkah_implementasi?: string;
    };
}
