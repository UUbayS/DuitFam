import api from './api';
import type { RecurringInput, RecurringTransaction } from '../types/recurring.types';

export const fetchRecurringTransactions = async (): Promise<{ data: RecurringTransaction[] }> => {
    const response = await api.get('/recurring-transactions');
    return response.data;
};

export const createRecurringTransaction = async (data: RecurringInput): Promise<{ message: string; data: { id: string } }> => {
    const response = await api.post('/recurring-transactions', data);
    return response.data;
};

export const updateRecurringTransaction = async (id: string, data: RecurringInput): Promise<{ message: string }> => {
    const response = await api.put(`/recurring-transactions/${id}`, data);
    return response.data;
};

export const deleteRecurringTransaction = async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/recurring-transactions/${id}`);
    return response.data;
};

export const generateRecurringTransaction = async (id: string): Promise<{ message: string; generated: number }> => {
    const response = await api.post(`/recurring-transactions/${id}/generate`);
    return response.data;
};

export const generateAllRecurringTransactions = async (): Promise<{ message: string; total: number }> => {
    const response = await api.post('/recurring-transactions/generate-all');
    return response.data;
};
