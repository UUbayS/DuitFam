import api from './api';
import type { TransactionInput } from '../types/transaction.types';

/**
 * Mencatat transaksi baru.
 * Endpoint: POST /api/transactions
 */
export const createTransaction = async (data: TransactionInput): Promise<{ message: string }> => {
    const response = await api.post('/transactions', data);
    return response.data;
};

export const depositToChild = async (data: { child_id: string; amount: number; keterangan?: string }): Promise<{ message: string }> => {
    const response = await api.post('/transactions/deposit', data);
    return response.data;
};
