import React, { useState } from 'react';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TransactionHistory from './TransactionHistory';
import TransactionModal from './TransactionModal';
import { PersonFill, BellFill, List, Plus, ClockHistory } from 'react-bootstrap-icons';
import { useAuth } from '../context/AuthContext';
import LogoPutih from '../assets/Logo Putih.svg';
import { Offcanvas, Button } from 'react-bootstrap';

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
    const { user } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    
    const handleAdded = () => {
        if (onTransactionAdded) onTransactionAdded();
        setShowModal(false);
    };

    const handleOpenModal = () => {
        if (openTransactionModal) {
            openTransactionModal();
        } else {
            setShowModal(true);
        }
        setShowHistory(false);
    };
    const toggleSidebar = () => setShowSidebar(!showSidebar);

    return (
        <div className="d-flex min-vh-100" style={{ backgroundColor: '#007bff' }}>
            {/* Sidebar Desktop */}
            <div className="desktop-only" style={{ width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)', zIndex: 10, height: '100vh', position: 'sticky', top: 0 }}>
                <Sidebar />
            </div>

            {/* Main Content Area */}
            <div
                className="flex-grow-1 d-flex flex-column content-container"
                style={{
                    backgroundColor: '#f6f4ff',
                    borderTopLeftRadius: 48,
                    borderBottomLeftRadius: 48,
                    overflow: 'hidden',
                    position: 'relative',
                    width: '100%'
                }}
            >
                {/* Mobile Header */}
                <div className="mobile-only d-flex align-items-center justify-content-between p-3" style={{ backgroundColor: '#007bff', color: 'white' }}>
                    <div className="d-flex align-items-center gap-3">
                        <Button variant="link" className="text-white p-0 shadow-none" onClick={toggleSidebar}>
                            <List size={28} />
                        </Button>
                        <img src={LogoPutih} alt="Logo" style={{ height: '24px' }} />
                    </div>
                    <div className="d-flex align-items-center gap-3">
                        <Button variant="link" className="text-white p-0 shadow-none" onClick={() => setShowHistory(true)}>
                            <ClockHistory size={24} />
                        </Button>
                        <div className="bg-white bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style={{ width: 35, height: 35 }}>
                            <PersonFill size={18} />
                        </div>
                    </div>
                </div>

                <div className="d-flex flex-grow-1 overflow-hidden">
                    {/* Content */}
                    <div className="flex-grow-1 p-3 p-md-4 overflow-auto" style={{ paddingBottom: '80px !important' }}>
                        {children}
                    </div>

                    {/* Transaction History Desktop */}
                    <div className="desktop-only h-100" style={{ width: 'var(--history-width)', minWidth: 'var(--history-width)', backgroundColor: '#cfeeff' }}>
                        <TransactionHistory
                            onTransactionAdded={handleAdded}
                            openTransactionModal={handleOpenModal}
                            hideAddButton={hideAddButton}
                        />
                    </div>
                </div>
            </div>

            {/* Sidebar Offcanvas Mobile */}
            <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} placement="start" style={{ width: '280px', backgroundColor: '#007bff' }}>
                <Offcanvas.Header closeButton closeVariant="white" className="pb-0">
                </Offcanvas.Header>
                <Offcanvas.Body className="p-0">
                    <Sidebar onItemClick={() => setShowSidebar(false)} />
                </Offcanvas.Body>
            </Offcanvas>

            {/* History Offcanvas Mobile */}
            <Offcanvas show={showHistory} onHide={() => setShowHistory(false)} placement="end" style={{ width: '340px', backgroundColor: '#cfeeff' }}>
                <Offcanvas.Header closeButton className="pb-0">
                    <Offcanvas.Title className="fw-bold">Riwayat Transaksi</Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body className="p-0">
                    <TransactionHistory
                        onTransactionAdded={handleAdded}
                        openTransactionModal={handleOpenModal}
                        hideAddButton={hideAddButton}
                    />
                </Offcanvas.Body>
            </Offcanvas>

            {/* Global Transaction Modal */}
            <TransactionModal
                show={showModal}
                handleClose={() => setShowModal(false)}
                onSuccess={handleAdded}
            />
        </div>
    );
};

export default MainLayout;
