import { Button, Col, Container, Row } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import React, { useEffect, useMemo, useState } from 'react';
import LogoBiru from '../assets/Logo Biru.svg';
import StartIllustration from '../assets/startpage.jpg';

const StartPage = () => {
    const navigate = useNavigate();
    const [phase, setPhase] = useState<'enter' | 'idle' | 'leave'>('enter');
    const transitionMs = 260;

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            navigate('/dashboard');
            return;
        }
        const id = window.setTimeout(() => setPhase('idle'), 30);
        return () => window.clearTimeout(id);
    }, [navigate]);

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

    return (
        <div
            style={{
                minHeight: '100vh',
                background: 'linear-gradient(180deg, #f2fbff 0%, #43b4ff 100%)',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 50% 20%, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 55%)',
                }}
            />

            <Container
                style={{ position: 'relative', zIndex: 1, ...pageStyle, minHeight: '100vh', display: 'flex', alignItems: 'center' }}
            >
                          
                <Row className="align-items-center w-100 mt-4">
                    <Col lg={6} className="mb-5 mb-lg-0">
                        <div className="d-flex align-items-center justify-content-start mb-4">
                            <img src={LogoBiru} alt="DuitFam" style={{ height: 42 }} />
                        </div>
                        <div style={{ maxWidth: 520 }}>
                            <div className="text-dark" style={{ fontSize: 44, lineHeight: 1.05, fontWeight: 800 }}>
                                Welcome to
                                <div style={{ fontSize: 64, lineHeight: 1.0, fontWeight: 900 }}>DuitFam</div>
                            </div>
                            <div className="text-dark opacity-75 mt-3" style={{ fontSize: 16, lineHeight: 1.6 }}>
                                Pantau pemasukan, atur pengeluaran keluarga, dan capai target menabung bersama dalam satu aplikasi.
                            </div>

                            <div className="mt-4">
                                <Button
                                    variant="primary"
                                    className="px-5 py-3 fw-bold"
                                    style={{
                                        borderRadius: 12,
                                        minWidth: 170,
                                        boxShadow: '0 10px 20px rgba(13,110,253,0.25)',
                                    }}
                                    onClick={() => go('/login')}
                                >
                                    Get Started
                                </Button>
                            </div>
                        </div>
                    </Col>
                    <Col lg={6} className="d-flex justify-content-center">
                        <img
                            src={StartIllustration}
                            alt="Ilustrasi DuitFam"
                            className="img-fluid"
                            style={{ maxWidth: 620, width: '100%', filter: 'drop-shadow(0 30px 50px rgba(0,0,0,0.12))' }}
                        />
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default StartPage;
