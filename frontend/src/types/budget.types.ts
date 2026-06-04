export type BudgetStatus = 'safe' | 'warning' | 'over';

export interface Budget {
    id: string;
    user_id: string;
    username?: string;
    category_id: string;
    nama_kategori?: string;
    icon_kategori?: string;
    jumlah: number;
    used: number;
    remaining: number;
    persentase: number;
    status: BudgetStatus;
    periode_bulan: string;
}

export interface BudgetSummaryItem {
    user_id: string;
    username?: string;
    category_id: string;
    nama_kategori?: string;
    icon_kategori?: string;
    used: number;
    limit: number;
    remaining: number;
    persentase: number;
    status: BudgetStatus | 'no_budget';
}

export interface BudgetInput {
    user_id: string;
    category_id: string;
    jumlah: number;
    periode_bulan: string;
}
