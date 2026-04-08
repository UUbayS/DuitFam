import api from './api';
import type { WithdrawalRequestItem } from '../types/approval.types';

export const createWithdrawalRequest = async (data: { amount: number; reason?: string }) => {
  const response = await api.post('/transactions/withdrawals', data);
  return response.data;
};

export const fetchWithdrawalRequests = async (): Promise<WithdrawalRequestItem[]> => {
  const response = await api.get<{ message: string; data: WithdrawalRequestItem[] }>('/transactions/withdrawals');
  return response.data.data;
};

export const processWithdrawalRequest = async (
  id: string,
  data: { action: 'approved' | 'rejected'; reason?: string }
) => {
  const response = await api.patch(`/transactions/withdrawals/${id}`, data);
  return response.data;
};
