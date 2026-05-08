import { useNavigate } from 'react-router-dom';
import React, { useEffect, useMemo, useState } from 'react';
import LogoBiru from '../assets/Logo Biru.svg';
import Grainient from '../components/Backgrounds/Grainient';

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
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Grainient
                color1="#dadada"
                color2="#44ADE6"
                color3="#0E82E8"
                noiseScale={1.95}
            />
            {/* Logo top-left */}
            <div
                style={{
                    position: 'absolute',
                    top: 28,
                    left: 36,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    zIndex: 2,
                }}
            >
                <img src={LogoBiru} alt="DuitFam" style={{ height: 60 }} />
            </div>

            {/* Centered content */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 1,
                    ...pageStyle,
                }}
            >

                <h1
                    style={{
                        fontSize: 52,
                        fontWeight: 700,
                        color: '#000000ff',
                        textAlign: 'center',
                        marginBottom: 12,
                        lineHeight: 1.15,
                    }}
                >
                    Welcome, <span style={{ fontWeight: 900, color: '#0a2e5c' }}>DuitFam</span>
                </h1>


                <p
                    style={{
                        fontSize: 15,
                        color: '#3a6a8a',
                        textAlign: 'center',
                        maxWidth: 440,
                        lineHeight: 1.6,
                        marginBottom: 36,
                    }}
                >
                    Pantau pemasukan, atur pengeluaran keluarga, dan
                    <br />
                    capai target menabung bersama dalam satu aplikasi.
                </p>


                <button
                    onClick={() => go('/login')}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(30, 120, 220, 0.45), inset 0 1px 1px rgba(255,255,255,0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(30, 120, 220, 0.35), inset 0 1px 1px rgba(255,255,255,0.3)';
                    }}
                    style={{
                        background: 'linear-gradient(180deg, #5db8f5 0%, #2196F3 40%, #1976D2 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 50,
                        padding: '16px 64px',
                        fontSize: 17,
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 8px 24px rgba(30, 120, 220, 0.35), inset 0 1px 1px rgba(255,255,255,0.3)',
                        transition: 'all 0.25s ease',
                        letterSpacing: 0.3,
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >

                    <span
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '50%',
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 100%)',
                            borderRadius: '50px 50px 0 0',
                            pointerEvents: 'none',
                        }}
                    />
                    <span style={{ position: 'relative', zIndex: 1 }}>Get Started</span>
                </button>
            </div>
        </div>
    );
};

export default StartPage;
