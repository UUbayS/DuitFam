import React, { useEffect, useMemo, useState } from 'react';
import { Form, Button, Card, Alert, InputGroup, Container, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import * as AuthTypes from '../types/auth.types'; 
import { loginUser } from '../services/auth.service';
import LogoBiru from '../assets/Logo Biru.svg';
import StartIllustration from '../assets/startpage.jpg';
import { ArrowLeft, Envelope, Lock } from 'react-bootstrap-icons'; 
import { useAuth } from '../context/AuthContext'; 

const LoginPage = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [phase, setPhase] = useState<'enter' | 'idle' | 'leave'>('enter');
  const transitionMs = 260;
  
  const [formData, setFormData] = useState<AuthTypes.LoginFormInput>({
    email: '',
    password: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setValidated(true);
      return;
    }
    
    setError(null);
    setLoading(true);

    try {
      const response = await loginUser(formData);
      
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      setUser(response.user);
      
      navigate('/dashboard');

    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Gagal login. Periksa email dan password Anda.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
                Selamat Datang Kembali
              </div>
              <div className="text-dark opacity-75 mt-2" style={{ fontSize: 16, maxWidth: 420 }}>
                Kelola keuangan keluarga bersama DuitFam
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

          <Col lg={4} className="d-flex flex-column align-items-center justify-content-center">
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
                    <div style={{ fontSize: 22, fontWeight: 800 }}>Login</div>
                  </div>

                  {error ? (
                    <Alert variant="danger" className="border-0 rounded-4 py-2 small mb-4 fw-medium text-center">
                      {error}
                    </Alert>
                  ) : null}

                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Username/Email</Form.Label>
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
                        type="text"
                        name="email"
                        placeholder="Masukkan Username/Email"
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

                  <Form.Group className="mb-4">
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
                        type={showPassword ? 'text' : 'password'}
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
                    <div className="mt-2">
                      <Form.Check
                        type="checkbox"
                        id="show-password"
                        label="Tampilkan password"
                        checked={showPassword}
                        onChange={() => setShowPassword(!showPassword)}
                      />
                    </div>
                  </Form.Group>

                  <div className="text-center mt-2 fw-semibold" style={{ fontSize: 13 }}>
                    Belum punya akun?{' '}
                    <a
                      href="/register"
                      className="text-decoration-none"
                      onClick={(e) => {
                        e.preventDefault();
                        go('/register');
                      }}
                    >
                      Daftar disini
                    </a>
                  </div>
                </Card.Body>
              </Card>

              <div className="d-flex justify-content-center mt-4">
                <Button
                  variant="light"
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2"
                  style={{
                    borderRadius: 14,
                    minWidth: 220,
                    fontWeight: 700,
                    boxShadow: '0 14px 30px rgba(0,0,0,0.12)',
                  }}
                >
                  {loading ? 'Loading...' : 'Login'}
                </Button>
              </div>
            </Form>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default LoginPage;
