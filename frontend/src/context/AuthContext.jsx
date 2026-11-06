import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [ready, setReady] = useState(false);

  const applySession = useCallback((data) => {
    setUser(data?.user || null);
    setVendor(data?.vendor || null);
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { applySession(null); setReady(true); return; }
    try {
      const { data } = await api.get('/auth/me');
      applySession(data);
    } catch {
      tokenStore.clear();
      applySession(null);
    } finally {
      setReady(true);
    }
  }, [applySession]);

  useEffect(() => {
    refresh();
    const onLogout = () => applySession(null);
    window.addEventListener('bz:logout', onLogout);
    return () => window.removeEventListener('bz:logout', onLogout);
  }, [refresh, applySession]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    tokenStore.set(data.token);
    applySession(data);
    return data.user;
  }, [applySession]);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    tokenStore.set(data.token);
    applySession(data);
    return data.user;
  }, [applySession]);

  const logout = useCallback(() => {
    tokenStore.clear();
    applySession(null);
  }, [applySession]);

  const value = useMemo(() => ({ user, vendor, ready, login, register, logout, refresh, setUser }), [user, vendor, ready, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const homeFor = (role) => (role === 'admin' ? '/admin' : role === 'vendor' ? '/vendor' : '/');
