import React from 'react';
import { Card, ProgressBar, Dropdown } from 'react-bootstrap';
import * as Icons from 'react-bootstrap-icons';
import { ThreeDotsVertical, PencilSquare, Trash } from 'react-bootstrap-icons';
import type { Budget } from '../types/budget.types';

const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.floor(amount)).replace('Rp', 'Rp ');
};

const getStatusVariant = (status: Budget['status']): { variant: 'success' | 'warning' | 'danger'; label: string } => {
    if (status === 'over') return { variant: 'danger', label: 'Terlampaui' };
    if (status === 'warning') return { variant: 'warning', label: 'Mendekati Batas' };
    return { variant: 'success', label: 'Aman' };
};

interface BudgetCardProps {
    budget: Budget;
    showUsername?: boolean;
    onEdit?: (b: Budget) => void;
    onDelete?: (b: Budget) => void;
}

const BudgetCard: React.FC<BudgetCardProps> = ({ budget, showUsername, onEdit, onDelete }) => {
    const IconComponent = (Icons as any)[budget.icon_kategori || 'Tag'] || Icons.Tag;
    const statusInfo = getStatusVariant(budget.status);
    const canManage = Boolean(onEdit || onDelete);

    return (
        <Card className="mb-3 shadow-sm border-0" style={{ borderRadius: 18 }}>
            <Card.Body className="p-3">
                <div className="d-flex align-items-center gap-3">
                    <div
                        className="d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                            width: 45,
                            height: 45,
                            borderRadius: 14,
                            backgroundColor: statusInfo.variant === 'danger'
                                ? 'rgba(220, 53, 69, 0.12)'
                                : statusInfo.variant === 'warning'
                                ? 'rgba(255, 193, 7, 0.15)'
                                : 'rgba(40, 167, 69, 0.1)',
                            color: statusInfo.variant === 'danger'
                                ? '#dc3545'
                                : statusInfo.variant === 'warning'
                                ? '#b8860b'
                                : '#28a745',
                            fontSize: 20,
                        }}
                    >
                        <IconComponent size={20} />
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <div className="d-flex justify-content-between align-items-center">
                            <div className="fw-bold text-dark text-truncate" style={{ fontSize: 14 }}>
                                {budget.nama_kategori || 'Kategori'}
                                {showUsername && budget.username && (
                                    <span className="ms-2 fw-medium text-primary" style={{ fontSize: 11 }}>
                                        {budget.username}
                                    </span>
                                )}
                            </div>
                            {canManage && (
                                <Dropdown align="end">
                                    <Dropdown.Toggle
                                        variant="link"
                                        id={`budget-actions-${budget.id}`}
                                        className="p-1 text-secondary shadow-none border-0"
                                        style={{ background: 'transparent' }}
                                    >
                                        <ThreeDotsVertical size={16} />
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu style={{ borderRadius: 12, fontSize: 13 }}>
                                        {onEdit && (
                                            <Dropdown.Item
                                                onClick={() => onEdit(budget)}
                                                className="d-flex align-items-center gap-2"
                                            >
                                                <PencilSquare size={14} /> Edit
                                            </Dropdown.Item>
                                        )}
                                        {onDelete && (
                                            <Dropdown.Item
                                                onClick={() => onDelete(budget)}
                                                className="d-flex align-items-center gap-2 text-danger"
                                            >
                                                <Trash size={14} /> Hapus
                                            </Dropdown.Item>
                                        )}
                                    </Dropdown.Menu>
                                </Dropdown>
                            )}
                        </div>
                        <div className="d-flex justify-content-between text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                            <span>{formatRupiah(budget.used)} / {formatRupiah(budget.jumlah)}</span>
                            <span className={statusInfo.variant === 'danger' ? 'text-danger fw-bold' : ''}>
                                {Math.min(999, budget.persentase).toFixed(0)}%
                            </span>
                        </div>
                        <ProgressBar
                            now={Math.min(100, budget.persentase)}
                            variant={statusInfo.variant}
                            style={{ height: 8, borderRadius: 4, marginTop: 6 }}
                        />
                        <div className="d-flex justify-content-between align-items-center mt-1">
                            <small className="text-muted" style={{ fontSize: 10 }}>
                                Sisa: {formatRupiah(budget.remaining)}
                            </small>
                            <small
                                className={`fw-semibold text-${statusInfo.variant}`}
                                style={{ fontSize: 10 }}
                            >
                                {statusInfo.label}
                            </small>
                        </div>
                    </div>
                </div>
            </Card.Body>
        </Card>
    );
};

export default BudgetCard;
