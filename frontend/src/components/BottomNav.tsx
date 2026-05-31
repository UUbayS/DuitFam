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

interface NavIcon {
    active: string;
    inactive: string;
}

interface LinkNavItem {
    to: string;
    icon: NavIcon;
    label: string;
}

interface ActionNavItem {
    type: 'action';
    icon: React.ReactElement;
    label: string;
    onClick: () => void;
}

type NavItem = LinkNavItem | ActionNavItem;

const BottomNav: React.FC<BottomNavProps> = ({ openTransactionModal }) => {
    const location = useLocation();
    const { user } = useAuth();
    
    const isActive = (path: string) => location.pathname === path;

    const navItems: NavItem[] = [
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
                if ('type' in item && item.type === 'action') {
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

                const linkItem = item as LinkNavItem;
                const active = isActive(linkItem.to);
                return (
                    <Nav.Link 
                        key={linkItem.to}
                        as={Link} 
                        to={linkItem.to} 
                        className="d-flex flex-column align-items-center justify-content-center p-0"
                        style={{ width: '20%', transition: '0.3s' }}
                    >
                        <img 
                            src={active ? linkItem.icon.active : linkItem.icon.inactive} 
                            alt={linkItem.label} 
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
                            {linkItem.label}
                        </span>
                    </Nav.Link>
                );
            })}
        </div>
    );
};

export default BottomNav;
