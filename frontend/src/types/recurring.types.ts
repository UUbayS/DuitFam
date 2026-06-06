export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';
export type RecurringJenis = 'pemasukan' | 'pengeluaran';

export interface RecurringTransaction {
    id: string;
    user_id: string;
    category_id: string;
    nama_kategori: string;
    icon_kategori: string;
    jenis: RecurringJenis;
    jumlah: number;
    keterangan?: string | null;
    frequency: RecurringFrequency;
    day_of_week?: number | null;
    day_of_month?: number | null;
    start_date: string;
    end_date?: string | null;
    last_generated_date?: string | null;
    is_active: boolean;
    next_due_date?: string | null;
}

export interface RecurringInput {
    category_id: string;
    jenis: RecurringJenis;
    jumlah: number;
    keterangan?: string | null;
    frequency: RecurringFrequency;
    day_of_week?: number | null;
    day_of_month?: number | null;
    start_date: string;
    end_date?: string | null;
}
