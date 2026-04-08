import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Form, Button, Alert, Spinner, Modal } from 'react-bootstrap';
import MainLayout from '../components/MainLayout';
import { PersonFill, KeyFill, CheckCircleFill, BoxArrowRight, XCircleFill } from 'react-bootstrap-icons';
import { useAuth } from '../context/AuthContext';
import * as AuthTypes from '../types/auth.types'; 
import { updatePasswordService, updateProfileService } from '../services/user.service';
import IconPengaturanBiru from '../assets/IconPengaturanBiru.svg';

const SettingsPage = () => {
    const { user, setUser, handleLogout } = useAuth();
    
    const inputStyle = {
        borderRadius: '12px',
        padding: '0.75rem 1rem',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
    };

    // State Password
    const [passwordData, setPasswordData] = useState<AuthTypes.PasswordUpdateInput>({
        currentPassword: '',
        newPassword: '',
    });

    // State Profil
    const [profileData, setProfileData] = useState<AuthTypes.ProfileUpdateInput>({
        username: user?.username || '',
        email: user?.email || '',
    });
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

    const [checks, setChecks] = useState({ length: false, capital: false, number: false });
    useEffect(() => {
        setChecks({
            length: passwordData.newPassword.length >= 8,
            capital: /[A-Z]/.test(passwordData.newPassword),
            number: /\d/.test(passwordData.newPassword)
        });
    }, [passwordData.newPassword]);
    const ValidationItem = ({ isPassed, text }: { isPassed: boolean, text: string }) => (
        <div className={`d-flex align-items-center mb-1 ${isPassed ? 'text-success' : 'text-muted'}`} style={{ fontSize: '0.75rem' }}>
            {isPassed ? <CheckCircleFill className="me-2" size={14} /> : <XCircleFill className="me-2" size={14} style={{ opacity: 0.3 }} />}
            <span>{text}</span>
        </div>
    );
    
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProfileData({ ...profileData, [e.target.name]: e.target.value });
        setProfileMessage(null);
    };

    const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setProfileLoading(true);
        setProfileMessage(null);
        try {
            const { message } = await updateProfileService(profileData);
            if (user) {
                const updatedUser = { ...user, ...profileData };
                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
            setProfileMessage({ type: 'success', text: message });
        } catch (error: any) {
            setProfileMessage({ type: 'danger', text: error.response?.data?.message || 'Gagal update profil.' });
        } finally {
            setProfileLoading(false);
        }
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
        setPasswordMessage(null);
    };
    
    const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!(checks.length && checks.capital && checks.number)) {
            setPasswordMessage({ 
                type: 'danger', 
                text: 'Password baru belum memenuhi syarat keamanan.' 
            });
            return;
        }

        if (passwordData.newPassword.length < 6) {
             setPasswordMessage({ type: 'danger', text: 'Password baru minimal 6 karakter.' });
             return;
        }
        setPasswordLoading(true);
        try {
            const { message } = await updatePasswordService(passwordData);
            setPasswordMessage({ type: 'success', text: message });
            setPasswordData({ currentPassword: '', newPassword: '' });
        } catch (error: any) {
            setPasswordMessage({ type: 'danger', text: error.response?.data?.message || 'Gagal update password.' });
        } finally {
            setPasswordLoading(false);
        }
    };

    // management functions moved to FamilyPage

    return (
        <MainLayout hideAddButton={true}>
            <h2 className="mb-4 d-flex align-items-center text-primary fw-bold" style={{ fontSize: '35px' }}>
                <img 
                    src={IconPengaturanBiru} 
                    alt="Ikon Pengaturan" 
                    className="me-2" 
                    style={{ width: '32px', height: '32px', display: 'block', marginTop: '-1px' }} 
                /> 
                <span style={{ display: 'inline-block', lineHeight: '1.2' }}>Pengaturan</span>
            </h2>

            <Row>
                <Col lg={6} className="mb-4">
                    <Card className="shadow-sm border-0 h-100" style={{ borderRadius: '25px' }}>
                        <Card.Body className="p-4">
                            <h5 className="fw-bold text-dark mb-4 d-flex align-items-center">
                                <div className="bg-primary bg-opacity-10 p-2 rounded-3 me-3 text-primary">
                                    <PersonFill size={20} />
                                </div>
                                Detail Profil
                            </h5>
                            
                            {profileMessage && (
                                <Alert variant={profileMessage.type} className="border-0 rounded-4 mb-4 small fw-medium">
                                    {profileMessage.type === 'success' ? <CheckCircleFill className="me-2" /> : <XCircleFill className="me-2" />}
                                    {profileMessage.text}
                                </Alert>
                            )}

                            <Form onSubmit={handleProfileSubmit}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-semibold small text-muted">Nama Pengguna</Form.Label>
                                    <Form.Control
                                        type="text" name="username" style={inputStyle}
                                        value={profileData.username} onChange={handleProfileChange} required
                                    />
                                </Form.Group>
                                <Form.Group className="mb-4">
                                    <Form.Label className="fw-semibold small text-muted">Email</Form.Label>
                                    <Form.Control
                                        type="email" name="email" style={inputStyle}
                                        value={profileData.email} onChange={handleProfileChange} required
                                    />
                                </Form.Group>
                                <Button variant="primary" type="submit" className="w-100 py-3 fw-bold shadow-sm" style={{ borderRadius: '15px' }} disabled={profileLoading}>
                                    {profileLoading ? <Spinner size="sm" /> : 'Simpan Perubahan'}
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={6} className="mb-4">
                    <Card className="shadow-sm border-0 h-100" style={{ borderRadius: '25px' }}>
                        <Card.Body className="p-4">
                            <h5 className="fw-bold text-dark mb-4 d-flex align-items-center">
                                <div className="bg-danger bg-opacity-10 p-2 rounded-3 me-3 text-danger">
                                    <KeyFill size={20} />
                                </div>
                                Keamanan Akun
                            </h5>
                            
                            {passwordMessage && (
                                <Alert variant={passwordMessage.type} className="border-0 rounded-4 mb-4 small fw-medium">
                                    {passwordMessage.type === 'success' ? <CheckCircleFill className="me-2" /> : <XCircleFill className="me-2" />}
                                    {passwordMessage.text}
                                </Alert>
                            )}

                            <Form onSubmit={handlePasswordSubmit}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-semibold small text-muted">Kata Sandi Lama</Form.Label>
                                    <Form.Control
                                        type="password" name="currentPassword" style={inputStyle}
                                        value={passwordData.currentPassword} onChange={handlePasswordChange} required
                                    />
                                </Form.Group>
                                <Form.Group className="mb-2"> 
                                    <Form.Label className="fw-semibold small text-muted">Kata Sandi Baru</Form.Label>
                                    <Form.Control
                                        type="password" 
                                        name="newPassword" 
                                        style={inputStyle}
                                        value={passwordData.newPassword} 
                                        onChange={handlePasswordChange} 
                                        required
                                    />
                                </Form.Group>
                                <div className="mb-4 p-3 bg-light rounded-4 border-0">
                                    <ValidationItem isPassed={checks.length} text="Minimal 8 karakter" />
                                    <ValidationItem isPassed={checks.capital} text="Minimal 1 Huruf Kapital" />
                                    <ValidationItem isPassed={checks.number} text="Minimal 1 Angka" />
                                </div>
                                <Button 
                                    variant="outline-danger" 
                                    type="submit" 
                                    className="w-100 py-3 fw-bold" 
                                    style={{ borderRadius: '15px' }} 
                                    disabled={passwordLoading || !(checks.length && checks.capital && checks.number)} 
                                >
                                    {passwordLoading ? <Spinner size="sm" /> : 'Ubah Kata Sandi'}
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={12} className="mb-4">
                    <Card className="shadow-sm border-0" style={{ borderRadius: '25px', backgroundColor: '#fff5f5' }}>
                        <Card.Body className="p-4 d-md-flex align-items-center justify-content-between">
                            <div className="mb-3 mb-md-0">
                                <h5 className="fw-bold text-danger mb-1">Keluar dari SipDana</h5>
                                <p className="text-muted small mb-0">Pastikan semua data Anda sudah tersimpan dengan benar.</p>
                            </div>
                            <Button 
                                variant="danger" 
                                onClick={handleLogout}
                                className="px-5 py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center"
                                style={{ borderRadius: '15px' }}
                            >
                                <BoxArrowRight size={20} className="me-2" /> Keluar Sekarang
                            </Button>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

        </MainLayout>
    );
};

export default SettingsPage;
