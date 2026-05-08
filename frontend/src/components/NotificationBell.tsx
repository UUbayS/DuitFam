import React, { useState } from 'react';
import { BellFill } from 'react-bootstrap-icons';
import { useNotification } from '../context/NotificationContext';
import NotificationPanel from './NotificationPanel';

const NotificationBell: React.FC = () => {
  const [showPanel, setShowPanel] = useState(false);
  const { unreadCount } = useNotification();

  return (
    <div className="position-relative">
      <button
        className="p-0 shadow-none border-0 bg-transparent d-flex align-items-center"
        onClick={() => setShowPanel(!showPanel)}
        style={{ background: 'none' }}
      >
        <BellFill size={24} className="responsive-bell-icon" />
        {unreadCount > 0 && (
          <span
            className="position-absolute bg-danger text-white rounded-circle d-flex align-items-center justify-content-center"
            style={{
              fontSize: '10px',
              minWidth: '18px',
              minHeight: '18px',
              top: '-5px',
              right: '-8px',
              fontWeight: 'bold'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {showPanel && (
        <>
          <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1049 }} onClick={() => setShowPanel(false)} />
          <NotificationPanel onClose={() => setShowPanel(false)} />
        </>
      )}
    </div>
  );
};

export default NotificationBell;
