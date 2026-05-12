import api from './api';
import * as AuthTypes from '../types/auth.types'; 

export const registerUser = async (data: AuthTypes.RegisterFormInput): Promise<AuthTypes.AuthResponse> => {
  const response = await api.post<AuthTypes.AuthResponse>('/auth/register', data);
  return response.data;
};

export const loginUser = async (data: AuthTypes.LoginFormInput): Promise<AuthTypes.AuthResponse> => {
  const response = await api.post<AuthTypes.AuthResponse>('/auth/login', data);
  return response.data;
};

export const logoutRequest = async (): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>('/auth/logout');
  return response.data;
};

export const logoutUser = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

export const getCurrentUser = (): AuthTypes.UserPayload | null => {
    const userString = localStorage.getItem('user');
    if (userString) {
        try {
            return JSON.parse(userString) as AuthTypes.UserPayload;
        } catch (e) {
            console.error("Gagal parse data user dari LocalStorage:", e);
            return null;
        }
    }
    return null;
};

export const isAuthenticated = (): boolean => {
    return !!localStorage.getItem('token') && !!localStorage.getItem('user');
};

export const generateInviteCode = async (): Promise<{ invite_code: string }> => {
  const response = await api.post<{ invite_code: string }>('/auth/generate-invite');
  return response.data;
};

export const checkParentStatus = async (): Promise<{ linked: boolean }> => {
  const response = await api.get<{ linked: boolean }>('/auth/parent-status');
  return response.data;
};
