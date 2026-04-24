import api from './api';
import type { ProfileUpdateInput, PasswordUpdateInput } from '../types/auth.types';

export const updateProfileService = async (data: ProfileUpdateInput): Promise<{ message: string }> => {
    const response = await api.put('/users/profile', data);
    return response.data;
};

export const updatePasswordService = async (data: PasswordUpdateInput): Promise<{ message: string }> => {
    const response = await api.put('/users/password', data);
    return response.data;
};

export const linkChildService = async (child_email: string): Promise<{ message: string }> => {
    const response = await api.post('/users/children', { child_email });
    return response.data;
};

export const createChildService = async (data: { username: string; email: string; password: string; saldo_awal?: number }): Promise<{ message: string; data: { id: string; username: string; email: string; is_active: boolean } }> => {
    const response = await api.post('/users/children/create', data);
    return response.data;
};

export const updateChildService = async (id: string, data: { username?: string; email?: string; password?: string; is_active?: boolean }): Promise<{ message: string }> => {
    const response = await api.put(`/users/children/${id}`, data);
    return response.data;
};

export const toggleChildService = async (id: string): Promise<{ message: string }> => {
    const response = await api.patch(`/users/children/${id}/toggle`);
    return response.data;
};

export const fetchChildrenService = async (): Promise<{ id: string; username: string; email: string; is_active: boolean }[]> => {
    const response = await api.get<{ message: string; data: { id: string; username: string; email: string; is_active: boolean }[] }>('/users/children');
    return response.data.data;
};

export const fetchChildrenBalancesService = async (): Promise<{ id: string; username: string; email: string; is_active: boolean; saldo: number }[]> => {
    const response = await api.get<{ message: string; data: { id: string; username: string; email: string; is_active: boolean; saldo: number }[] }>('/users/children/balances');
    return response.data.data;
};

export const deleteChildService = async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/users/children/${id}`);
    return response.data;
};

export const resetChildPasswordService = async (id: string, data: { password: string; password_confirmation: string }): Promise<{ message: string }> => {
    const response = await api.post(`/users/children/${id}/reset-password`, data);
    return response.data;
};
