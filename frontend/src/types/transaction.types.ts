export type TransactionType = 'pemasukan' | 'pengeluaran' | 'menabung';

export interface TransactionInput {
    jenis: TransactionType;
    jumlah: number;
    tanggal: string;
    keterangan?: string;
    id_kategori: string;
    source_id?: string;
}

export interface Category {
    id_kategori: string;
    nama_kategori: string;
    jenis: TransactionType;
    icon: string;
}
