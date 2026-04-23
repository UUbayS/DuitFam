import React from 'react';
import { Nav, Button } from 'react-bootstrap'; 
import { Link, useLocation } from 'react-router-dom';
import { BoxArrowLeft, PersonFill } from 'react-bootstrap-icons';
import { useAuth } from '../context/AuthContext';
// Logo
import LogoPutih from '../assets/Logo Putih.svg';

// Beranda
import HomeWhite from '../assets/IconBeranda.svg';
import HomeBlue from '../assets/IconBerandaBiru.svg'; 

// Analisis Keuangan
import AnalysisWhite from '../assets/IconAnalisis.svg';
import AnalysisBlue from '../assets/IconAnalisisBiru.svg';

// Target Menabung
import TargetWhite from '../assets/IconTarget.svg';
import TargetBlue from '../assets/IconTargetBiru.svg';
    
    // Pengaturan
    import SettingsWhite from '../assets/IconPengaturan.svg';
    import SettingsBlue from '../assets/IconPengaturanBiru.svg';
    
import AnggotaWhite from '../assets/IconAnggota.svg';
import AnggotaBlue from '../assets/IconAnggotaBiru.svg';

import PersetujuanWhite from '../assets/IconPersetujuan.svg';
import PersetujuanBlue from '../assets/IconPersetujuanBiru.svg';

interface SidebarProps {
  onItemClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onItemClick }) => {
  const location = useLocation();
  const { user, handleLogout } = useAuth();
  
  // Array untuk menu navigasi
  const navItems = [
    { to: "/dashboard", icon: { active: HomeBlue, inactive: HomeWhite }, label: "Beranda" },
    { to: "/analisis", icon: { active: AnalysisBlue, inactive: AnalysisWhite }, label: "Analisis Keuangan" },
    { to: "/target", icon: { active: TargetBlue, inactive: TargetWhite }, label: "Target Menabung" },
    ...(user?.role === 'parent'
      ? [
          { to: "/family", icon: { active: AnggotaBlue, inactive: AnggotaWhite }, label: "Anggota Keluarga" },
          { to: "/approval", icon: { active: PersetujuanBlue, inactive: PersetujuanWhite }, label: "Pusat Persetujuan" },
        ]
      : [{ to: "/approval", icon: { active: PersetujuanBlue, inactive: PersetujuanWhite }, label: "Penarikan" }]),
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div 
      style={{ 
        height: '100%', 
        backgroundColor: '#007bff', 
        padding: '20px 0 20px 0', 
        overflowY: 'auto', 
      }}
      className="d-flex flex-column shadow" 
    >
      
      <div className="d-flex align-items-center justify-content-center mb-5 mt-3">
        <img 
          src={LogoPutih} 
          alt="SipDana Logo" 
          style={{ width: '100%', maxWidth: '250px' }} 
          className="px-4" 
        />
      </div>

      <Link 
        to="/settings" 
        className="d-flex flex-column align-items-center mb-4 text-decoration-none" 
        style={{ padding: '0 20px', cursor: 'pointer' }}
      >
        <div
          className="d-flex align-items-center justify-content-center bg-white bg-opacity-25"
          style={{ width: 52, height: 52, borderRadius: 999 }}
        >
          <PersonFill size={22} className="text-white" />
        </div>
        <div className="mt-2 fw-bold text-white" style={{ fontSize: 14 }}>
          {user?.username || 'Keluarga'}
        </div>
        <div className="text-white text-opacity-75" style={{ fontSize: 12 }}>
          {user?.role === 'parent' ? 'Orang Tua' : 'Anak'}
        </div>
      </Link>
      
      <Nav className="flex-column flex-grow-1" style={{ padding: '0 20px' }}>
        {navItems.map(item => (
          <Nav.Link 
            as={Link} 
            to={item.to} 
            key={item.to}
            onClick={onItemClick}
            className={`d-flex align-items-center mb-2 p-3 rounded text-white ${isActive(item.to) ? 'bg-white fw-bold' : 'text-white'}`}
            style={{ 
                backgroundColor: isActive(item.to) ? 'white' : 'transparent',
                transition: '0.3s',
            }}
          >
           <img 
                src={isActive(item.to) ? item.icon.active : item.icon.inactive} 
                alt={`${item.label} Icon`} 
                className="me-3" 
                style={{ width: '20px', height: '20px', filter: 'none' }}
            />
            <span className={isActive(item.to) ? 'text-primary' : 'text-white'}>
                {item.label}
            </span>
          </Nav.Link>
        ))}
      </Nav>

      <div style={{ padding: '0 20px' }} className="mb-4">
        <Button
          variant="link"
          className="w-100 d-flex align-items-center justify-content-start text-white text-decoration-none p-3"
          style={{ borderRadius: 12 }}
          onClick={() => handleLogout()}
        >
          <BoxArrowLeft className="me-3" />
          <span className="fw-bold">Log Out</span>
        </Button>
      </div>
      
    </div>
  );
};

export default Sidebar;
