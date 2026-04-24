import React, { useState } from 'react';
import { Modal, Form, Button, Alert, Spinner } from 'react-bootstrap';

interface Props {
  show: boolean;
  handleClose: () => void;
  childUsername: string;
  onConfirm: (password: string, confirmPassword: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const ResetPasswordModal = ({ show, handleClose, childUsername, onConfirm, loading, error }: Props) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(password, confirmPassword);
  };

  const handleCloseModal = () => {
    setPassword('');
    setConfirmPassword('');
    handleClose();
  };

  return (
    <Modal show={show} onHide={handleCloseModal} centered>
      <Modal.Header closeButton className="border-0 pt-4 px-4">
        <Modal.Title className="fw-bold">Reset Password Anak</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        <p className="text-muted mb-3">
          Reset password untuk akun <strong>{childUsername}</strong>. 
          Password baru harus minimal 8 karakter, mengandung huruf besar dan angka.
        </p>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label className="small text-muted fw-bold">Password Baru</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password baru"
              style={{ borderRadius: 12, padding: '12px', fontSize: 16 }}
              autoFocus
              disabled={loading}
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label className="small text-muted fw-bold">Konfirmasi Password</Form.Label>
            <Form.Control
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              style={{ borderRadius: 12, padding: '12px', fontSize: 16 }}
              disabled={loading}
            />
          </Form.Group>

          <div className="d-flex gap-3">
            <Button 
              variant="light" 
              className="w-100 py-2 fw-bold"
              style={{ borderRadius: 12 }}
              onClick={handleCloseModal}
              disabled={loading}
            >
              Batal
            </Button>
            <Button 
              variant="primary" 
              type="submit"
              disabled={loading} 
              className="w-100 py-2 fw-bold"
              style={{ borderRadius: 12 }}
            >
              {loading ? <Spinner size="sm" /> : 'Reset Password'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default ResetPasswordModal;
