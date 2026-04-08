import React, { useEffect, useMemo, useState } from 'react';
import { Form, Button, Card, Alert, InputGroup, Container, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { Envelope, Lock, Person, CheckCircleFill, XCircleFill, ArrowLeft } from 'react-bootstrap-icons';

import LogoBiru from '../assets/Logo Biru.svg';
import StartIllustration from '../assets/startpage.jpg';
import { registerUser } from '../services/auth.service';

const RegisterPage = () => {
    const navigate = useNavigate();
    const [phase, setPhase] = useState<'enter' | 'idle' | 'leave'>('enter');
    const transitionMs = 260;
    
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
    });

    const [checks, setChecks] = useState({ length: false, capital: false, number: false });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [validated, setValidated] = useState(false);

    useEffect(() => {
        const id = window.setTimeout(() => setPhase('idle'), 30);
        return () => window.clearTimeout(id);
    }, []);

    const go = (to: string) => {
        setPhase('leave');
        window.setTimeout(() => navigate(to), transitionMs);
    };

    const pageStyle = useMemo(() => {
        const base: React.CSSProperties = { transform: 'translateX(0)', opacity: 1, transition: `all ${transitionMs}ms ease` };
        if (phase === 'enter') return { ...base, transform: 'translateX(-14px)', opacity: 0 };
        if (phase === 'leave') return { ...base, transform: 'translateX(14px)', opacity: 0 };
        return base;
    }, [phase]);

    useEffect(() => {
        setChecks({
            length: formData.password.length >= 8,
            capital: /[A-Z]/.test(formData.password),
            number: /\d/.test(formData.password)
        });
    }, [formData.password]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        
        if (form.checkValidity() === false) {
            e.stopPropagation();
            setValidated(true);
            return;
        }

        if (!formData.email.toLowerCase().endsWith('@gmail.com')) {
            setError('Email wajib menggunakan domain @gmail.com');
            return;
        }

        if (!(checks.length && checks.capital && checks.number)) {
            setError('Password belum memenuhi syarat keamanan.');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            await registerUser({ ...formData, role: 'parent' });
            navigate('/login');
            
        } catch (err) {
            const errorBody = err as any;
            setError(errorBody.response?.data?.message || 'Gagal registrasi. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    const ValidationItem = ({ isPassed, text }) => (
        <div className={`d-flex align-items-center mb-1 ${isPassed ? 'text-success' : 'text-muted'}`} style={{ fontSize: '0.75rem' }}>
            {isPassed ? <CheckCircleFill className="me-2" /> : <XCircleFill className="me-2" style={{ opacity: 0.3 }} />}
            <span>{text}</span>
        </div>
    );

    return (
        <div
            style={{
                minHeight: '100vh',
                background: 'linear-gradient(180deg, #f2fbff 0%, #1aa7ff 100%)',
                position: 'relative',
                overflow: 'hidden',
            }}
            className="d-flex align-items-stretch"
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 50% 22%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 58%)',
                }}
            />

            <button
                type="button"
                aria-label="Kembali"
                onClick={() => go('/')}
                style={{
                    position: 'absolute',
                    top: 24,
                    left: 24,
                    border: 0,
                    background: 'transparent',
                    padding: 8,
                    zIndex: 2,
                }}
            >
                <ArrowLeft size={28} />
            </button>

            <Container fluid className="h-100" style={{ position: 'relative', zIndex: 1, ...pageStyle }}>
                <Row className="h-100 align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
                    <Col
                        lg={6}
                        className="d-none d-lg-flex flex-column justify-content-center"
                        style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 28 }}
                    >
                        <div style={{ maxWidth: 520 }}>
                            <div className="text-dark fw-bold" style={{ fontSize: 42, lineHeight: 1.1 }}>
                                Buat Akun Orang Tua
                            </div>
                            <div className="text-dark opacity-75 mt-2" style={{ fontSize: 16, maxWidth: 420 }}>
                                Daftarkan akun parent untuk mengelola tabungan dan aktivitas keuangan keluarga.
                            </div>
                            <div className="mt-4">
                                <img
                                    src={StartIllustration}
                                    alt="Ilustrasi"
                                    style={{
                                        width: '100%',
                                        maxWidth: 520,
                                        filter: 'drop-shadow(0 25px 45px rgba(0,0,0,0.12))',
                                    }}
                                />
                            </div>
                        </div>
                    </Col>

                    <Col
                        lg={4}
                        className="d-flex flex-column align-items-center justify-content-center"
                        style={{
                            padding: 32,
                        }}
                    >
                        <img src={LogoBiru} alt="DuitFam" style={{ height: 44, marginBottom: 18 }} />

                        <Form noValidate validated={validated} onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360 }}>
                            <Card
                                className="border-0"
                                style={{
                                    borderRadius: 12,
                                    boxShadow: '0 16px 40px rgba(0,0,0,0.12)',
                                }}
                            >
                                <Card.Body style={{ padding: 22 }}>
                                    <div className="text-center mb-4">
                                        <div style={{ fontSize: 22, fontWeight: 800 }}>Register</div>
                                    </div>

                                    {error ? (
                                        <Alert variant="danger" className="border-0 rounded-4 py-2 small mb-4 fw-medium text-center">
                                            {error}
                                        </Alert>
                                    ) : null}

                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-semibold">Nama</Form.Label>
                                        <InputGroup>
                                            <InputGroup.Text
                                                className="bg-white"
                                                style={{
                                                    borderRadius: '10px 0 0 10px',
                                                    border: '1px solid rgba(0,0,0,0.25)',
                                                    borderRight: 0,
                                                }}
                                            >
                                                <Person />
                                            </InputGroup.Text>
                                            <Form.Control
                                                type="text"
                                                name="username"
                                                placeholder="Masukkan Nama"
                                                value={formData.username}
                                                onChange={handleChange}
                                                required
                                                style={{
                                                    borderRadius: '0 10px 10px 0',
                                                    border: '1px solid rgba(0,0,0,0.25)',
                                                    borderLeft: 0,
                                                    padding: '10px 12px',
                                                }}
                                            />
                                        </InputGroup>
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-semibold">Email</Form.Label>
                                        <InputGroup>
                                            <InputGroup.Text
                                                className="bg-white"
                                                style={{
                                                    borderRadius: '10px 0 0 10px',
                                                    border: '1px solid rgba(0,0,0,0.25)',
                                                    borderRight: 0,
                                                }}
                                            >
                                                <Envelope />
                                            </InputGroup.Text>
                                            <Form.Control
                                                type="email"
                                                name="email"
                                                placeholder="Masukkan Email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                required
                                                style={{
                                                    borderRadius: '0 10px 10px 0',
                                                    border: '1px solid rgba(0,0,0,0.25)',
                                                    borderLeft: 0,
                                                    padding: '10px 12px',
                                                }}
                                            />
                                        </InputGroup>
                                    </Form.Group>

                                    <Form.Group className="mb-2">
                                        <Form.Label className="fw-semibold">Password</Form.Label>
                                        <InputGroup>
                                            <InputGroup.Text
                                                className="bg-white"
                                                style={{
                                                    borderRadius: '10px 0 0 10px',
                                                    border: '1px solid rgba(0,0,0,0.25)',
                                                    borderRight: 0,
                                                }}
                                            >
                                                <Lock />
                                            </InputGroup.Text>
                                            <Form.Control
                                                type="password"
                                                name="password"
                                                placeholder="Masukkan password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                required
                                                style={{
                                                    borderRadius: '0 10px 10px 0',
                                                    border: '1px solid rgba(0,0,0,0.25)',
                                                    borderLeft: 0,
                                                    padding: '10px 12px',
                                                }}
                                            />
                                        </InputGroup>
                                    </Form.Group>

                                    <div className="mt-3">
                                        <ValidationItem isPassed={checks.length} text="Minimal 8 karakter" />
                                        <ValidationItem isPassed={checks.capital} text="Minimal 1 Huruf Kapital" />
                                        <ValidationItem isPassed={checks.number} text="Minimal 1 Angka" />
                                    </div>

                                    <div className="text-center mt-3 fw-semibold" style={{ fontSize: 13 }}>
                                        Sudah punya akun?{' '}
                                        <a
                                            href="/login"
                                            className="text-decoration-none"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                go('/login');
                                            }}
                                        >
                                            Masuk
                                        </a>
                                    </div>
                                </Card.Body>
                            </Card>

                            <div className="d-flex justify-content-center mt-4">
                                <Button
                                    variant="light"
                                    type="submit"
                                    disabled={loading || !(checks.length && checks.capital && checks.number)}
                                    className="px-5 py-2"
                                    style={{
                                        borderRadius: 14,
                                        minWidth: 220,
                                        fontWeight: 700,
                                        boxShadow: '0 14px 30px rgba(0,0,0,0.12)',
                                    }}
                                >
                                    {loading ? 'Loading...' : 'Register'}
                                </Button>
                            </div>
                        </Form>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default RegisterPage;
