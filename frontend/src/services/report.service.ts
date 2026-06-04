import api from './api';
import type * as ReportTypes from '../types/report.types';
import type { SpendingTipsResponse } from '../types/spending-tips.types';

export interface FilterParams {
    month?: string;
    year?: string;
    start_date?: string;
    end_date?: string;
    unit?: string;
    group?: string;
    child_id?: string;
    page?: number;
    per_page?: number;
}

export interface PaginatedMeta {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
}

export interface PaginatedResponse<T> {
    message: string;
    data: T[];
    meta: PaginatedMeta;
}

const getCurrentMonth = (): string => {
    const date = new Date();
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
};

const buildQueryString = (params: FilterParams | string): string => {
    if (typeof params === 'string') {
        return `?month=${params}`;
    }

    const queryString = Object.keys(params)
        .filter(key => params[key as keyof FilterParams] !== undefined && params[key as keyof FilterParams] !== '')
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key as keyof FilterParams]))}`)
        .join('&');

    return queryString ? `?${queryString}` : '';
};

/**
 * Mengambil ringkasan laporan keuangan bulanan.
 * SINKRON: Menggunakan /reports sesuai index.ts backend
 */
export const fetchMonthlySummary = async (params: FilterParams | string = getCurrentMonth()): Promise<ReportTypes.MonthlySummary> => {
    const queryString = buildQueryString(params);
    const response = await api.get<{ message: string, data: ReportTypes.MonthlySummary }>(`/reports/summary${queryString}`);
    return response.data.data;
};

/**
 * Mengambil Riwayat Transaksi (paginated).
 */
export const fetchTransactionHistory = async (params: FilterParams | string = ''): Promise<PaginatedResponse<ReportTypes.TransactionHistoryItem>> => {
    const queryString = buildQueryString(params);
    const response = await api.get<PaginatedResponse<ReportTypes.TransactionHistoryItem>>(`/reports/history${queryString}`);
    return response.data;
};

/**
 * Mengambil Laporan Analisis Lengkap
 */
export const fetchAnalysisReport = async (params: FilterParams | string = getCurrentMonth()): Promise<ReportTypes.AnalysisReport> => {
    const queryString = buildQueryString(params);
    const response = await api.get<{ message: string, data: ReportTypes.AnalysisReport }>(`/reports/analysis${queryString}`);
    return response.data.data;
};

/**
 * Mengambil Data Historis untuk Grafik.
 */
export const fetchHistoricalData = async (params: FilterParams = { unit: 'tahunan' }): Promise<ReportTypes.AnalysisReport['chartData']> => {
    const queryString = buildQueryString(params);
    const response = await api.get<{ message: string, data: ReportTypes.AnalysisReport['chartData'] }>(`/reports/historical${queryString}`);
    return response.data.data;
};

export const fetchFamilyMonthlySummary = async (params: FilterParams | string = getCurrentMonth()): Promise<ReportTypes.MonthlySummary & { childCount?: number }> => {
    const queryString = buildQueryString(params);
    const response = await api.get<{ message: string, data: ReportTypes.MonthlySummary & { childCount?: number } }>(`/reports/family/summary${queryString}`);
    return response.data.data;
};

export const fetchFamilyTransactionHistory = async (params?: FilterParams): Promise<PaginatedResponse<ReportTypes.TransactionHistoryItem & { user_id?: string; status?: string }>> => {
    const queryString = params ? buildQueryString(params) : '';
    const response = await api.get<PaginatedResponse<ReportTypes.TransactionHistoryItem & { user_id?: string; status?: string }>>(`/reports/family/history${queryString}`);
    return response.data;
};

export const fetchFamilyHistoricalData = async (params: FilterParams = { unit: 'tahunan' }): Promise<ReportTypes.AnalysisReport['chartData']> => {
    const queryString = buildQueryString(params);
    const response = await api.get<{ message: string, data: ReportTypes.AnalysisReport['chartData'] }>(`/reports/family/historical${queryString}`);
    return response.data.data;
};

export const fetchFamilyAnalysisReport = async (params: FilterParams | string = getCurrentMonth()): Promise<ReportTypes.AnalysisReport> => {
    const queryString = buildQueryString(params);
    const response = await api.get<{ message: string, data: ReportTypes.AnalysisReport }>(`/reports/family/analysis${queryString}`);
    return response.data.data;
};

/**
 * Mengambil Smart Spending Tips dari AI
 */
export const getSpendingTips = async (): Promise<SpendingTipsResponse> => {
    const response = await api.get<SpendingTipsResponse>('/ai/spending-tips');
    return response.data;
};

export const fetchFamilyAnalysisPdf = async (month: string): Promise<Blob> => {
    const response = await api.get('/reports/family/analysis/pdf', {
        params: { month },
        responseType: 'blob',
    });
    return response.data as Blob;
};

export const downloadTransactionsExport = async (
    params: Omit<FilterParams, 'unit' | 'page' | 'per_page'> = {},
): Promise<Blob> => {
    const response = await api.get('/reports/export', {
        params,
        responseType: 'blob',
    });
    return response.data as Blob;
};

export const triggerExportDownload = (blob: Blob, filename: string): void => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};
