import api from './api';
import type { Category } from '../types/transaction.types';

/**
 * Mengambil daftar semua kategori yang tersedia.
 * Endpoint: GET /api/utilities/categories
 */
export const fetchCategories = async (): Promise<Category[]> => {
    const response = await api.get<{ message: string, data: Category[] }>('/utilities/categories');
    return response.data.data;
};