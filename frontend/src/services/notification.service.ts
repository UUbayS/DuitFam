import api from './api';
import type { AppNotification } from '../types/notification.types';

export const fetchNotifications = async (): Promise<AppNotification[]> => {
  const response = await api.get<{ message: string; data: AppNotification[] }>('/notifications');
  return response.data.data;
};

export const markNotificationRead = async (id: string) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
};
