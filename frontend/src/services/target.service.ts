import api from './api';
import * as TargetTypes from '../types/target.types'; 

/**
 * [GET] Mengambil semua target menabung aktif.
 */
export const fetchActiveTargets = async (childId?: string): Promise<TargetTypes.TargetMenabung[]> => {
    const query = childId ? `?child_id=${encodeURIComponent(childId)}` : '';
    const response = await api.get<{ message: string, data: TargetTypes.TargetMenabung[] }>(`/targets${query}`);
    // Pastikan ini me-return response.data.data
    return response.data.data;
};

/**
 * [POST] Membuat target menabung baru.
 */
export const createNewTarget = async (data: TargetTypes.TargetInput) => {
    const response = await api.post('/targets', data);
    return response.data;
};

export const contributeToTarget = async (data: { id_target: string; jumlah: number }) => {
    const response = await api.post('/targets/contribute', data); 
    return response.data;
};

export const withdrawFromTarget = async (data: { id_target: string; jumlah: number }) => {
    const response = await api.post('/targets/withdraw', data); 
    return response.data;
};

export const updateTarget = async (id: string, data: Partial<TargetTypes.TargetInput> & { status?: 'aktif' | 'tercapai' | 'batal' }) => {
    const response = await api.put(`/targets/${id}`, data);
    return response.data;
};

export const cancelTarget = async (id: string) => {
    const response = await api.delete(`/targets/${id}`);
    return response.data;
};
