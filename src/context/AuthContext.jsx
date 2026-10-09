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

  const register = useCallback(async (userData) => {
    const authenticatedUser = await authService.register(userData); 
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
    return authenticatedUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout(); 
    } catch (error) {
      console.error("Firebase logout error:", error);
    } finally {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setUser(null);
    }
  }, []);

  const resetPassword = useCallback(async (email) => {
    return await authService.sendResetEmail(email);
  }, []);

  // THE FIX: Function to instantly sync local storage and React state
  const updateUserSession = useCallback((updatedData) => {
    setUser((prev) => {
      if (!prev) return null;
      const nextUser = { ...prev, ...updatedData };
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextUser));
      return nextUser;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      isInitializing,
      login,
      register,
      logout,
      resetPassword,
      updateUserSession, // Exporting the new function
    }),
    [user, isInitializing, login, register, logout, resetPassword, updateUserSession],
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