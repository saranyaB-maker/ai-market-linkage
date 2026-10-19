import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import api from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  quickDemoLogin: (role: UserRole) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await api.getCurrentUser();
      if (res && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
      api.clearToken();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await api.login(credentials);
    api.setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (data: any) => {
    const res = await api.register(data);
    api.setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    api.clearToken();
    setUser(null);
  };

  const quickDemoLogin = async (role: UserRole) => {
    let email = '';
    let password = '';
    if (role === 'admin') {
      email = 'admin@marketlink.local';
      password = 'Admin@12345';
    } else if (role === 'seller') {
      email = 'seller@marketlink.local';
      password = 'Seller@12345';
    } else if (role === 'buyer') {
      email = 'buyer@marketlink.local';
      password = 'Buyer@12345';
    }
    await login({ email, password });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, quickDemoLogin, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
