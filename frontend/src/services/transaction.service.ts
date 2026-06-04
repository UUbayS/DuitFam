import api from './api';
import type { TransactionInput, TransactionItem, TransactionUpdate } from '../types/transaction.types';

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

export const fetchTransactionById = async (id: string): Promise<{ message: string; data: TransactionItem }> => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
};

export const updateTransaction = async (id: string, data: TransactionUpdate): Promise<{ message: string; transactionId: string }> => {
    const response = await api.put(`/transactions/${id}`, data);
    return response.data;
};

export const deleteTransaction = async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
};
