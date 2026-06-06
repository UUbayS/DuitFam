import api from './api';
import type { Budget, BudgetInput, BudgetSummaryItem } from '../types/budget.types';

export const fetchBudgets = async (periode?: string): Promise<{ data: Budget[] }> => {
    const response = await api.get('/budgets', { params: periode ? { periode_bulan: periode } : {} });
    return response.data;
};

export const fetchBudgetSummary = async (periode?: string): Promise<{ data: BudgetSummaryItem[] }> => {
    const response = await api.get('/budgets/summary', { params: periode ? { periode_bulan: periode } : {} });
    return response.data;
};

export const upsertBudget = async (data: BudgetInput): Promise<{ message: string; data: Budget }> => {
    const response = await api.post('/budgets', data);
    return response.data;
};

export const deleteBudget = async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/budgets/${id}`);
    return response.data;
};
