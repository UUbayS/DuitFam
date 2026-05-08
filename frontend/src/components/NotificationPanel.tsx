import React from 'react';
import { useNotification } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import type { AppNotification } from '../types/notification.types';

const NotificationPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { notifications, loading, markRead, markAllRead, unreadCount } = useNotification();
  const navigate = useNavigate();

  const handleClick = async (notif: AppNotification) => {
    if (!notif.read_at) {
      await markRead(notif.id);
    }
    onClose();
    if (notif.meta?.transaction_id) {
      navigate('/');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString('id-ID');
  };

  return (
    <div
      className="position-absolute bg-white rounded-3 shadow-lg"
      style={{
        top: '50px',
        right: '10px',
        width: '350px',
        maxHeight: '450px',
        zIndex: 1050,
        overflow: 'hidden'
      }}
    >
      <div className="d-flex align-items-center justify-content-between p-3 border-bottom">
        <h6 className="mb-0 fw-bold text-dark">Notifikasi</h6>
        {unreadCount > 0 && (
          <button className="btn btn-link btn-sm p-0 text-decoration-none" onClick={markAllRead}>
            Tandai semua dibaca
          </button>
        )}
      </div>

      <div className="overflow-auto" style={{ maxHeight: '350px' }}>
        {loading ? (
          <div className="text-center p-4 text-muted">Memuat...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center p-4 text-muted">Tidak ada notifikasi</div>
        ) : (
          notifications.map(notif => (
            <div
              key={notif.id}
              className={`p-3 border-bottom cursor-pointer text-dark ${!notif.read_at ? 'bg-light' : ''}`}
              onClick={() => handleClick(notif)}
              style={{ cursor: 'pointer' }}
              role="button"
            >
              <div className="d-flex justify-content-between align-items-start">
                <h6 className="mb-1 fw-bold" style={{ fontSize: '14px' }}>{notif.title}</h6>
                {!notif.read_at && (
                  <span className="badge bg-primary rounded-circle" style={{ width: '8px', height: '8px' }} />
                )}
              </div>
              <p className="mb-1 text-muted" style={{ fontSize: '13px' }}>{notif.message}</p>
              <small className="text-muted">{formatTime(notif.created_at)}</small>
            </div>
          ))
        )}
      </div>

      <div className="p-2 border-top text-center">
        <button className="btn btn-link btn-sm text-decoration-none" onClick={() => { onClose(); navigate('/notifications'); }}>
          Lihat semua notifikasi
        </button>
      </div>
    </div>
  );
};

export default NotificationPanel;
