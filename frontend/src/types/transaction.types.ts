export type TransactionType = 'pemasukan' | 'pengeluaran' | 'menabung' | 'refund';

export interface TransactionInput {
    jenis: TransactionType;
    jumlah: number;
    tanggal: string;
    keterangan?: string;
    id_kategori: string;
    source_id?: string;
}

export interface TransactionUpdate {
    jumlah?: number;
    tanggal?: string;
    keterangan?: string | null;
    id_kategori?: string | null;
    source_id?: string | null;
}

export interface TransactionItem {
    id_transaksi: string;
    user_id: string;
    jenis: TransactionType;
    jumlah: number;
    keterangan?: string | null;
    tanggal: string;
    status: string;
    id_kategori?: string | null;
    nama_kategori?: string | null;
    icon_kategori?: string | null;
    source_id?: string | null;
    is_internal?: boolean;
    is_recurring?: boolean;
}

export interface Category {
    id_kategori: string;
    nama_kategori: string;
    jenis: TransactionType;
    icon: string;
}
