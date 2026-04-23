import React from 'react';
import { Nav } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Beranda
import HomeWhite from '../assets/IconBeranda.svg';
import HomeBlue from '../assets/IconBerandaBiru.svg';

// Analisis Keuangan
import AnalysisWhite from '../assets/IconAnalisis.svg';
import AnalysisBlue from '../assets/IconAnalisisBiru.svg';

// Target Menabung
import TargetWhite from '../assets/IconTarget.svg';
import TargetBlue from '../assets/IconTargetBiru.svg';

// Settings
import SettingsWhite from '../assets/IconPengaturan.svg';
import SettingsBlue from '../assets/IconPengaturanBiru.svg';

// Plus icon for mobile
import { PlusCircleFill } from 'react-bootstrap-icons';

interface BottomNavProps {
    openTransactionModal: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ openTransactionModal }) => {
    const location = useLocation();
    const { user } = useAuth();
    
    const isActive = (path: string) => location.pathname === path;

    const navItems = [
        { to: "/dashboard", icon: { active: HomeBlue, inactive: HomeWhite }, label: "Beranda" },
        { to: "/analisis", icon: { active: AnalysisBlue, inactive: AnalysisWhite }, label: "Analisis" },
        { type: 'action', icon: <PlusCircleFill size={36} className="text-primary" />, label: "Tambah", onClick: openTransactionModal },
        { to: "/target", icon: { active: TargetBlue, inactive: TargetWhite }, label: "Target" },
        { to: "/settings", icon: { active: SettingsBlue, inactive: SettingsWhite }, label: "Profil" },
    ];

    return (
        <div 
            className="mobile-only fixed-bottom bg-white border-top d-flex justify-content-around align-items-center" 
            style={{ height: '70px', zIndex: 1000, boxShadow: '0 -4px 10px rgba(0,0,0,0.05)' }}
        >
            {navItems.map((item, index) => {
                if (item.type === 'action') {
                    return (
                        <div 
                            key={index}
                            className="d-flex flex-column align-items-center justify-content-center"
                            style={{ cursor: 'pointer', marginTop: '-20px' }}
                            onClick={item.onClick}
                        >
                            <div className="bg-white rounded-circle shadow-sm p-1">
                                {item.icon}
                            </div>
                        </div>
                    );
                }

                const active = isActive(item.to!);
                return (
                    <Nav.Link 
                        key={item.to}
                        as={Link} 
                        to={item.to!} 
                        className="d-flex flex-column align-items-center justify-content-center p-0"
                        style={{ width: '20%', transition: '0.3s' }}
                    >
                        <img 
                            src={active ? item.icon.active : item.icon.inactive} 
                            alt={item.label} 
                            style={{ 
                                width: '24px', 
                                height: '24px',
                                filter: active ? 'none' : 'grayscale(1) opacity(0.5)'
                            }} 
                        />
                        <span 
                            style={{ 
                                fontSize: '10px', 
                                fontWeight: active ? '700' : '500',
                                color: active ? '#007bff' : '#6c757d',
                                marginTop: '4px'
                            }}
                        >
                            {item.label}
                        </span>
                    </Nav.Link>
                );
            })}
        </div>
    );
};

export default BottomNav;
