import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react'; 
import * as AuthTypes from '../types/auth.types';
import { getCurrentUser, isAuthenticated, logoutRequest, logoutUser } from '../services/auth.service';
import { Spinner } from 'react-bootstrap'; 

export interface AuthContextType {
  user: AuthTypes.UserPayload | null;
  isLoggedIn: boolean;
  setUser: (user: AuthTypes.UserPayload | null) => void; 
  handleLogout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<AuthTypes.UserPayload | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkInitialAuth = () => {
        const currentUser = getCurrentUser();
        const authenticated = isAuthenticated();
        
        setUserState(currentUser);
        setIsLoggedIn(authenticated);
        setIsLoading(false); 
    };

    checkInitialAuth();
  }, []);

  const setUser = (userData: AuthTypes.UserPayload | null) => {
    setUserState(userData);
    setIsLoggedIn(!!userData);
  };
  
  const handleLogout = async () => {
      try {
          await logoutRequest();
      } catch {
          // ignore
      } finally {
          logoutUser();
          setUser(null);
      }
  };
  
  if (isLoading) {
    return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <Spinner animation="border" variant="primary" />
            <span className="ms-2">Memuat sesi...</span>
        </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, setUser, handleLogout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return context;
};
