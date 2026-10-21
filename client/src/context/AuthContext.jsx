import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser as apiLogin, registerUser as apiRegister, getMe as apiGetMe } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pbgms_token') || localStorage.getItem('pcs_admin_token');
    if (!token) {
      setLoading(false);
      return;
    }

    apiGetMe()
      .then((data) => {
        if (data.success && (data.user || data.admin)) {
          setUser(data.user || data.admin);
        } else {
          localStorage.removeItem('pbgms_token');
          localStorage.removeItem('pcs_admin_token');
          setUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem('pbgms_token');
        localStorage.removeItem('pcs_admin_token');
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (identifier, password) => {
    const res = await apiLogin(identifier, password);
    if (res.success && res.token) {
      localStorage.setItem('pbgms_token', res.token);
      localStorage.setItem('pcs_admin_token', res.token);
      setUser(res.user);
      return res;
    }
    throw new Error(res.message || 'Login failed');
  };

  const register = async (userData) => {
    const res = await apiRegister(userData);
    if (res.success && res.token) {
      localStorage.setItem('pbgms_token', res.token);
      setUser(res.user);
      return res;
    }
    throw new Error(res.message || 'Registration failed');
  };

  const logout = () => {
    localStorage.removeItem('pbgms_token');
    localStorage.removeItem('pcs_admin_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      admin: user, // backwards compatibility
      role: user?.role || 'GUEST',
      isAuthenticated: !!user,
      loading,
      login,
      register,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
