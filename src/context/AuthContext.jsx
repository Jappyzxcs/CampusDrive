import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

const SESSION_STORAGE_KEY = 'campusdrive.session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (raw) {
          const restoredUser = JSON.parse(raw);
          if (isMounted) setUser(restoredUser);
        }
      } catch {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    }

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const authenticatedUser = await authService.login(credentials);
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
    return authenticatedUser;
  }, []);

  // Added register function to establish a session upon signup
  const register = useCallback(async (userData) => {
    const authenticatedUser = await authService.register(userData); 
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
    return authenticatedUser;
  }, []);

  // FIX: Make logout async and call Firebase authService
  const logout = useCallback(async () => {
    try {
      await authService.logout(); // Kill the active Firebase session
    } catch (error) {
      console.error("Firebase logout error:", error);
    } finally {
      // Always clear local state even if Firebase throws an error
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      isInitializing,
      login,
      register, // Exposed register
      logout,
    }),
    [user, isInitializing, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}