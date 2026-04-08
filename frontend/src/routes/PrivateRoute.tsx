import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = () => {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return null; 
  }

  // Jika sudah login, izinkan akses
  if (isLoggedIn) {
    return <Outlet />;
  }

  // Jika belum login, redirect ke Login
  return <Navigate to="/login" replace />;
};

export default PrivateRoute;