import React from 'react';
import { useNotification } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'react-bootstrap-icons';
import type { AppNotification } from '../types/notification.types';

const NotificationPage: React.FC = () => {
  const { notifications, loading, markRead, markAllRead, unreadCount } = useNotification();
  const navigate = useNavigate();

  const handleClick = async (notif: AppNotification) => {
    if (!notif.read_at) {
      await markRead(notif.id);
    }
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
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="container-fluid p-0" style={{ maxWidth: '800px' }}>
      <div className="d-flex align-items-center justify-content-between p-3 border-bottom bg-white sticky-top">
        <div className="d-flex align-items-center gap-3">
          <button className="btn btn-link p-0 text-dark" onClick={() => navigate(-1)}>
            <ArrowLeft size={22} />
          </button>
          <h5 className="mb-0 fw-bold">Notifikasi</h5>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-link text-decoration-none" onClick={markAllRead}>
            Tandai semua dibaca
          </button>
        )}
      </div>

      <div className="bg-white">
        {loading ? (
          <div className="text-center p-5 text-muted">Memuat notifikasi...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center p-5">
            <div className="mb-3" style={{ fontSize: '48px' }}>🔔</div>
            <p className="text-muted">Tidak ada notifikasi</p>
          </div>
        ) : (
          notifications.map(notif => (
            <div
              key={notif.id}
              className={`p-3 border-bottom ${!notif.read_at ? 'bg-light' : ''}`}
              onClick={() => handleClick(notif)}
              style={{ cursor: 'pointer' }}
              role="button"
            >
              <div className="d-flex justify-content-between align-items-start mb-1">
                <h6 className="mb-0 fw-bold" style={{ fontSize: '15px' }}>{notif.title}</h6>
                <div className="d-flex align-items-center gap-2">
                  {!notif.read_at && (
                    <span className="badge bg-primary rounded-circle" style={{ width: '8px', height: '8px' }} />
                  )}
                  <small className="text-muted">{formatTime(notif.created_at)}</small>
                </div>
              </div>
              <p className="mb-0 text-muted" style={{ fontSize: '14px' }}>{notif.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationPage;
