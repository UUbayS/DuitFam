import api from './api';

export interface SpendingAlert {
    type: 'warning' | 'success' | 'info';
    title: string;
    message: string;
    severity: 'high' | 'medium' | 'low';
    amount?: number;
}

export interface AlertsResponse {
    alerts: SpendingAlert[];
    financialSummary?: {
        bulan: string;
        totalPemasukan: number;
        totalPengeluaran: number;
        neto: number;
        saldoAkhir: number;
    };
}

/**
 * Fetch spending alerts for current user
 */
export const fetchSpendingAlerts = async (): Promise<AlertsResponse> => {
    const response = await api.get<AlertsResponse>('/ai/alerts');
    return response.data;
};
