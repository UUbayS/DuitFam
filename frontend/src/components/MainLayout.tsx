import React from 'react';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TransactionHistory from './TransactionHistory';

interface MainLayoutProps {
    children: ReactNode;
    onTransactionAdded?: () => void;
    openTransactionModal?: () => void;
    hideAddButton?: boolean; 
}

const MainLayout: React.FC<MainLayoutProps> = ({ 
    children, 
    onTransactionAdded, 
    openTransactionModal,
    hideAddButton = false 
}) => {
    const handleAdded = onTransactionAdded || (() => {});
    const handleOpenModal = openTransactionModal || (() => {});
    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#007bff' }}>
            <div style={{ width: 240, minWidth: 240, zIndex: 10 }}>
                <Sidebar />
            </div>

            <div
                style={{
                    flexGrow: 1,
                    display: 'flex',
                    backgroundColor: '#f6f4ff',
                    borderTopLeftRadius: 48,
                    borderBottomLeftRadius: 48,
                    overflow: 'hidden',
                }}
            >
                <div style={{ flexGrow: 1, padding: 24, overflowY: 'auto' }}>
                    {children}
                </div>

                <div style={{ width: 340, minWidth: 340, backgroundColor: '#cfeeff' }}>
                    <TransactionHistory
                        onTransactionAdded={handleAdded}
                        openTransactionModal={handleOpenModal}
                        hideAddButton={hideAddButton}
                    />
                </div>
            </div>
        </div>
    );
};

export default MainLayout;
