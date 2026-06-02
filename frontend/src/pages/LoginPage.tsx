import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as AuthTypes from '../types/auth.types';
import { loginUser, registerUser } from '../services/auth.service';
import LogoBiru from '../assets/Logo Biru.svg';
import LogoPutih from '../assets/Logo Putih.svg';
import { CheckCircleFill, XCircleFill } from 'react-bootstrap-icons';
import { useAuth } from '../context/AuthContext';
import Grainient from '../components/Backgrounds/Grainient';

type AuthMode = 'login' | 'register';
type RegisterMode = 'parent' | 'child';

/* ------------------------------------------------------------------ */
/*  Small helper – password-strength indicator                        */
/* ------------------------------------------------------------------ */
const ValidationItem = ({ isPassed, text }: { isPassed: boolean; text: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginTop: 4 }}>
    {isPassed
      ? <CheckCircleFill size={12} style={{ color: '#22c55e', flexShrink: 0 }} />
      : <XCircleFill size={12} style={{ color: '#ccc', flexShrink: 0 }} />}
    <span style={{ color: isPassed ? '#22c55e' : '#999' }}>{text}</span>
  </div>
);

/* ================================================================== */
/*  LOGIN PAGE – Sliding Overlay inspired by BOSS0exe                 */
/* ================================================================== */
const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  const initialMode = (location.pathname === '/register' ? 'register' : 'login') as AuthMode;
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [registerMode, setRegisterMode] = useState<RegisterMode>('parent');

  // Login form
  const [loginData, setLoginData] = useState<AuthTypes.LoginFormInput>({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  // Register form
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '' });
  const [checks, setChecks] = useState({ length: false, capital: false, number: false });
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // Common
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync URL ↔ mode
  useEffect(() => {
    if (mode === 'register' && location.pathname !== '/register') navigate('/register');
    else if (mode === 'login' && location.pathname !== '/login') navigate('/login');
  }, [mode, navigate, location.pathname]);

  // Password checks
  useEffect(() => {
    setChecks({
      length: registerData.password.length >= 8,
      capital: /[A-Z]/.test(registerData.password),
      number: /\d/.test(registerData.password),
    });
  }, [registerData.password]);

/* ---------- handlers ---------- */
  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setLoginData({ ...loginData, [e.target.name]: e.target.value });

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setRegisterData({ ...registerData, [e.target.name]: e.target.value });

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const res = await loginUser(loginData);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      setUser(res.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Login gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };


  const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!checks.length || !checks.capital || !checks.number) {
      setError('Password belum memenuhi syarat.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const payload: AuthTypes.RegisterFormInput = {
        username: registerData.username,
        email: registerData.email,
        password: registerData.password,
        role: registerMode,
      };
      await registerUser(payload);
      setMode('login');
      setError(null);
      setSuccessMessage('Akun berhasil dibuat! Silakan login.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registrasi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- switchMode ---------- */
  const switchMode = (to: AuthMode) => {
    setError(null);
    setSuccessMessage(null);
    setMode(to);
    setRegisterMode('parent');
    // Reset password visibility when switching modes
    if (to === 'login') {
      setShowRegisterPassword(false);
    } else {
      setShowPassword(false);
    }
  };

  const isActive = mode === 'register';

  /* ================================================================ */
  /*  INLINE STYLES – faithfully mirroring the CSS from the           */
  /*  inspiration repo, re-themed in DuitFam blue.                    */
  /* ================================================================ */

  const S = {
    /* Full-page dark background */
    page: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      fontFamily: "'Montserrat', 'Inter', sans-serif",
      padding: 20,
      position: 'relative' as const,
      overflow: 'hidden' as const,
    } as React.CSSProperties,

    /* The main card container */
    container: {
      background: '#fff',
      borderRadius: 30,
      boxShadow: '0 14px 60px rgba(0,0,0,0.35)',
      position: 'relative' as const,
      overflow: 'hidden' as const,
      width: 820,
      maxWidth: '100%',
      minHeight: 640,
    } as React.CSSProperties,

    /* Each form panel (sign-in / sign-up) */
    formContainer: {
      position: 'absolute' as const,
      top: 0,
      height: '100%',
      transition: 'all 0.6s ease-in-out',
    } as React.CSSProperties,

    signIn: {
      left: 0,
      width: '50%',
      zIndex: 2,
      transform: isActive ? 'translateX(100%)' : 'translateX(0)',
    } as React.CSSProperties,

    signUp: {
      left: 0,
      width: '50%',
      opacity: isActive ? 1 : 0,
      zIndex: isActive ? 5 : 1,
      transform: isActive ? 'translateX(100%)' : 'translateX(0)',
      animation: isActive ? 'authMove 0.6s' : 'none',
    } as React.CSSProperties,

    form: {
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column' as const,
      padding: '0 40px',
      height: '100%',
    } as React.CSSProperties,

    input: {
      background: '#f0f4f8',
      border: '2px solid transparent',
      margin: '8px 0',
      padding: '12px 16px',
      fontSize: 13,
      borderRadius: 10,
      width: '100%',
      outline: 'none',
      fontFamily: 'inherit',
      transition: 'border-color 0.3s, box-shadow 0.3s',
      color: '#1a1a2e',
    } as React.CSSProperties,

    inputFocusStyle: {
      borderColor: '#1aa7ff',
      boxShadow: '0 0 0 3px rgba(26,167,255,0.15)',
    },

    submitBtn: {
      background: 'linear-gradient(135deg, #1aa7ff 0%, #0077cc 100%)',
      color: '#fff',
      fontSize: 13,
      padding: '12px 45px',
      border: 'none',
      borderRadius: 10,
      fontWeight: 700,
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
      marginTop: 12,
      cursor: 'pointer',
      width: '100%',
      transition: 'transform 0.2s, box-shadow 0.3s',
      fontFamily: 'inherit',
      boxShadow: '0 4px 15px rgba(26,167,255,0.35)',
    } as React.CSSProperties,

    /* ---- Toggle Overlay ---- */
    toggleContainer: {
      position: 'absolute' as const,
      top: 0,
      left: '50%',
      width: '50%',
      height: '100%',
      overflow: 'hidden' as const,
      transition: 'all 0.6s ease-in-out',
      borderRadius: 20,
      zIndex: 1000,
      transform: isActive ? 'translateX(-100%)' : 'translateX(0)',
    } as React.CSSProperties,

    toggle: {
      background: 'linear-gradient(135deg, #1aa7ff 0%, #0055cc 100%)',
      backgroundSize: '50% 100%',
      height: '100%',
      color: '#fff',
      position: 'relative' as const,
      left: '-100%',
      width: '200%',
      transform: isActive ? 'translateX(50%)' : 'translateX(0)',
      transition: 'all 0.6s ease-in-out',
    } as React.CSSProperties,

    togglePanel: {
      position: 'absolute' as const,
      width: '50%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column' as const,
      padding: '0 30px',
      textAlign: 'center' as const,
      top: 0,
      transition: 'all 0.6s ease-in-out',
    } as React.CSSProperties,

    toggleLeft: {
      transform: isActive ? 'translateX(0)' : 'translateX(-200%)',
    } as React.CSSProperties,

    toggleRight: {
      right: 0,
      transform: 'translateX(0)',
    } as React.CSSProperties,

    toggleBtn: {
      background: 'transparent',
      border: '2px solid #fff',
      color: '#fff',
      fontSize: 12,
      padding: '10px 45px',
      borderRadius: 10,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
      marginTop: 16,
      cursor: 'pointer',
      transition: 'all 0.3s',
      fontFamily: 'inherit',
    } as React.CSSProperties,

    heading: {
      fontSize: 28,
      fontWeight: 800,
      color: '#1a1a2e',
      margin: 0,
      letterSpacing: -0.5,
    } as React.CSSProperties,

    subtitle: {
      fontSize: 13,
      lineHeight: '20px',
      letterSpacing: 0.3,
      margin: '12px 0 8px',
      color: '#777',
    } as React.CSSProperties,

    errorBox: {
      background: '#fff0f0',
      color: '#d32f2f',
      border: '1px solid #ffcdd2',
      borderRadius: 10,
      padding: '8px 16px',
      fontSize: 12,
      fontWeight: 600,
      textAlign: 'center' as const,
      width: '100%',
      marginBottom: 4,
    } as React.CSSProperties,

    link: {
      color: '#1aa7ff',
      fontSize: 12,
      textDecoration: 'none',
      marginTop: 10,
      cursor: 'pointer',
      fontWeight: 600,
    } as React.CSSProperties,

    checkboxLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: '#666',
      marginTop: 4,
      cursor: 'pointer',
      userSelect: 'none' as const,
    } as React.CSSProperties,
  };


  return (
    <>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap');

        @keyframes authMove {
          0%, 49.99% { opacity: 0; z-index: 1; }
          50%, 100%  { opacity: 1; z-index: 5; }
        }

        .auth-input:focus {
          border-color: #1aa7ff !important;
          box-shadow: 0 0 0 3px rgba(26,167,255,0.15) !important;
        }
        .auth-input::placeholder {
          color: #aab4c2;
        }

        .auth-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(26,167,255,0.45) !important;
        }
        .auth-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .auth-submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .toggle-btn-outline:hover {
          background: rgba(255,255,255,0.15) !important;
          transform: translateY(-1px);
        }

        /* Floating decorative circles */
        .auth-deco-circle {
          position: absolute;
          border-radius: 50%;
          opacity: 0.06;
          pointer-events: none;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .auth-container-card {
            width: 100% !important;
            max-width: 400px !important; /* Keeps the card a nice, readable size */
            min-height: auto !important;
            padding: 40px 0 !important;
            margin: 0 auto !important; /* Forces perfect horizontal centering */
          }
          .auth-form-panel {
            width: 100% !important;
            position: relative !important;
            transform: none !important;
            height: auto !important;
            left: 0 !important; /* Resets any leftover sliding animation positions */
          }
          .auth-form-panel form {
            padding: 0 24px !important; 
            height: auto !important; 
            width: 100% !important;
          }
          .auth-toggle-overlay {
            display: none !important;
          }
          .auth-mobile-switch {
            display: flex !important;
            justify-content: center !important;
            width: 100% !important;
          }
          .auth-mobile-switch a {
            margin-top: 0 !important; 
            margin-left: 4px !important; 
          }
          .auth-sign-in-panel {
            display: ${isActive ? 'none' : 'flex'} !important;
          }
          .auth-sign-up-panel {
            display: ${isActive ? 'flex' : 'none'} !important;
          }
        }
      `}</style>

      <div style={S.page}>
        <Grainient
          color1="#dadada"
          color2="#44ADE6"
          color3="#0E82E8"
          noiseScale={1.95}
        />

        {/* ============ MAIN CONTAINER CARD ============ */}
        <div className="auth-container-card" style={S.container}>

          {/* -------- SIGN UP FORM (left, hidden by default) -------- */}
          <div
            className="auth-form-panel auth-sign-up-panel"
            style={{ ...S.formContainer, ...S.signUp }}
          >
            <form onSubmit={handleRegisterSubmit} style={S.form}>
              <img src={LogoBiru} alt="DuitFam" style={{ height: 36, marginBottom: 12 }} />
              <h1 style={S.heading}>Daftar Akun</h1>
              <p style={S.subtitle}>Buat akun baru untuk memulai menabung bersama keluarga</p>

              {error && mode === 'register' && <div style={S.errorBox}>{error}</div>}

              {/* Tab Pilihan: Parent / Child */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderRadius: 999, padding: 4, backgroundColor: '#f1f5f9', width: '100%' }}>
                <button
                  type="button"
                  onClick={() => { setRegisterMode('parent'); setError(null); }}
                  style={{
                    flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 500,
                    border: 'none', cursor: 'pointer',
                    borderRadius: 999,
                    backgroundColor: registerMode === 'parent' ? '#007bff' : 'transparent',
                    color: registerMode === 'parent' ? '#fff' : '#64748b',
                    transition: 'all 0.2s ease',
                    boxShadow: registerMode === 'parent' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Orang Tua
                </button>
                <button
                  type="button"
                  onClick={() => { setRegisterMode('child'); setError(null); }}
                  style={{
                    flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 500,
                    border: 'none', cursor: 'pointer',
                    borderRadius: 999,
                    backgroundColor: registerMode === 'child' ? '#007bff' : 'transparent',
                    color: registerMode === 'child' ? '#fff' : '#64748b',
                    transition: 'all 0.2s ease',
                    boxShadow: registerMode === 'child' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Anak
                </button>
              </div>

              <input
                className="auth-input"
                style={S.input}
                type="text"
                name="username"
                placeholder="Nama"
                value={registerData.username}
                onChange={handleRegisterChange}
                required
              />
              <input
                className="auth-input"
                style={S.input}
                type="email"
                name="email"
                placeholder="Email"
                value={registerData.email}
                onChange={handleRegisterChange}
                required
              />
              <input
                className="auth-input"
                style={S.input}
                type={showRegisterPassword ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                value={registerData.password}
                onChange={handleRegisterChange}
                required
              />

              {/* Hidden field untuk role */}
              <input type="hidden" name="role" value={registerMode} />

              <div style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                <label style={S.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={showRegisterPassword}
                    onChange={() => setShowRegisterPassword(!showRegisterPassword)}
                    style={{ accentColor: '#1aa7ff' }}
                  />
                  Tampilkan password
                </label>
              </div>

              {/* Password strength */}
              <div style={{ width: '100%', marginBottom: 4, marginTop: -2 }}>
                <ValidationItem isPassed={checks.length} text="Minimal 8 karakter" />
                <ValidationItem isPassed={checks.capital} text="Mengandung huruf kapital" />
                <ValidationItem isPassed={checks.number} text="Mengandung angka" />
              </div>

              <button type="submit" disabled={loading} className="auth-submit-btn" style={S.submitBtn}>
                {loading ? 'Loading...' : `DAFTAR SEBAGAI ${registerMode === 'parent' ? 'ORANG TUA' : 'ANAK'}`}
              </button>

{/* Mobile-only switch link */}
              <p className="auth-mobile-switch" style={{ ...S.subtitle, display: 'none', marginTop: 16 }}>
                Sudah punya akun?<a style={S.link} onClick={() => switchMode('login')}>Masuk</a>
              </p>
            </form>
          </div>

          {/* -------- SIGN IN FORM (left, visible by default) -------- */}
          <div
            className="auth-form-panel auth-sign-in-panel"
            style={{ ...S.formContainer, ...S.signIn }}
          >
            <form onSubmit={handleLoginSubmit} style={S.form}>
              <img src={LogoBiru} alt="DuitFam" style={{ height: 36, marginBottom: 12 }} />
              <h1 style={S.heading}>Sign In</h1>
              <p style={S.subtitle}>Selamat datang kembali ke DuitFam</p>

              {error && mode === 'login' && <div style={S.errorBox}>{error}</div>}

              {successMessage && (
                <div style={{
                  background: '#f0fff4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: 'center' as const,
                  width: '100%',
                  marginBottom: 4,
                }}>
                  {successMessage}
                </div>
              )}

              <input
                className="auth-input"
                style={S.input}
                type="text"
                name="email"
                placeholder="Email or Username"
                value={loginData.email}
                onChange={handleLoginChange}
                required
              />
              <input
                className="auth-input"
                style={S.input}
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                value={loginData.password}
                onChange={handleLoginChange}
                required
              />

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={S.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={() => setShowPassword(!showPassword)}
                    style={{ accentColor: '#1aa7ff' }}
                  />
                  Show password
                </label>
                {/*<a href="#" style={S.link} onClick={(e) => e.preventDefault()}>Forgot Password?</a>*/}
              </div>

              <button type="submit" disabled={loading} className="auth-submit-btn" style={S.submitBtn}>
                {loading ? 'Loading...' : 'SIGN IN'}
              </button>

              {/* Mobile-only switch link */}
              <p className="auth-mobile-switch" style={{ ...S.subtitle, display: 'none', marginTop: 16 }}>
                Don't have an account?<a style={S.link} onClick={() => switchMode('register')}>Sign Up</a>
              </p>
            </form>
          </div>

          {/* ============ TOGGLE OVERLAY (colored sliding panel) ============ */}
          <div className="auth-toggle-overlay" style={S.toggleContainer}>
            <div style={S.toggle}>

              {/* Left panel – shown when "active" (register mode) */}
              <div style={{ ...S.togglePanel, ...S.toggleLeft }}>
                <img src={LogoPutih} alt="DuitFam" style={{ height: 42, marginBottom: 8 }} />
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Welcome Back!</h1>
                <p style={{ fontSize: 13, lineHeight: '22px', margin: '14px 0', opacity: 0.92 }}>
                  Masuk dengan akun yang sudah ada untuk mengakses keuangan keluargamu
                </p>
                <button
                  type="button"
                  className="toggle-btn-outline"
                  style={S.toggleBtn}
                  onClick={() => switchMode('login')}
                >
                  SIGN IN
                </button>
              </div>

              {/* Right panel – shown by default (login mode) */}
              <div style={{ ...S.togglePanel, ...S.toggleRight }}>
                <img src={LogoPutih} alt="DuitFam" style={{ height: 42, marginBottom: 8 }} />
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Hello, Friends!</h1>
                <p style={{ fontSize: 13, lineHeight: '22px', margin: '14px 0', opacity: 0.92 }}>
                  Daftar sekarang dan mulai kelola keuangan bersama keluargamu
                </p>
                <button
                  type="button"
                  className="toggle-btn-outline"
                  style={S.toggleBtn}
                  onClick={() => switchMode('register')}
                >
                  SIGN UP
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>

  );
};

export default LoginPage;
