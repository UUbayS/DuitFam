export interface TargetInput {
    nama_target: string;
    target_jumlah: number;
    tanggal_target: string;
    child_id?: string;
}

export interface TargetMenabung extends TargetInput {
    id_target: string;
    id_user: string;
    jumlah_terkumpul: number;
    status: 'aktif' | 'tercapai' | 'batal';
    created_at: string;
    updated_at: string;
}
