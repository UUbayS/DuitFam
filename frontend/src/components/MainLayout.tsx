import React, { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TransactionHistory from './TransactionHistory';
import TransactionModal from './TransactionModal';
import AIChatBox from './AIChatBox';
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
    
    const handleAdded = useCallback(() => {
        if (onTransactionAdded) onTransactionAdded();
        setShowModal(false);
    }, [onTransactionAdded]);

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
        <div className="d-flex overflow-hidden" style={{ height: '100vh', backgroundColor: 'var(--primary-color)' }}>
            {/* Left Sidebar Desktop (Fixed) */}
            <aside className="desktop-only" style={{ width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)', height: '100vh' }}>
                <Sidebar />
            </aside>

            {/* Main Wrapper (Center Scroll + Right Fixed) */}
            <div className="flex-grow-1 d-flex flex-column overflow-hidden">
                {/* Mobile Header (Hanya muncul di mobile) */}
                <header className="mobile-only d-flex align-items-center justify-content-between p-3" style={{ backgroundColor: 'var(--primary-color)', color: 'white', zIndex: 100 }}>
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
                </header>

                {/* Inner Layout Container */}
                <div className="d-flex flex-grow-1 overflow-hidden">
                    {/* Center Content (Scrollable) */}
                    <main className="flex-grow-1 overflow-hidden h-100 position-relative">
                        <div className="content-container overflow-auto h-100">
                            <div className="p-3 p-md-4 p-lg-5">
                                {children}
                            </div>
                        </div>
                        <AIChatBox />
                    </main>

                    {/* Right Sidebar Desktop (Fixed) */}
                    <aside className="desktop-only h-100" style={{ width: 'var(--history-width)', minWidth: 'var(--history-width)', backgroundColor: 'var(--bg-history)' }}>
                        <TransactionHistory
                            onTransactionAdded={handleAdded}
                            openTransactionModal={handleOpenModal}
                            hideAddButton={hideAddButton}
                        />
                    </aside>
                </div>
            </div>

            {/* Sidebar Offcanvas Mobile */}
            <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} placement="start" style={{ width: '280px', backgroundColor: '#007bff' }}>
                <Offcanvas.Header closeButton closeVariant="white" className="pb-0" />
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
