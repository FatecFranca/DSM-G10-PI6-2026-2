import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiError, getStoredToken, onUnauthorized, setStoredToken } from '../services/api';
import { authService } from '../services';
import type { Role, User } from '../types/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  can: {
    manageUsers: boolean;
    manageInstitutions: boolean;
    seeDataMining: boolean;
    writeStudents: boolean;
    runAnalyses: boolean;
    manageFollowUps: boolean;
    seeAllInstitutions: boolean;
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

function permissionsFor(role: Role | undefined) {
  const isAdmin = role === 'ADMIN';
  const isAnalyst = role === 'ANALYST';

  return {
    manageUsers: isAdmin,
    manageInstitutions: isAdmin,
    seeDataMining: isAdmin,
    writeStudents: isAdmin || isAnalyst,
    runAnalyses: isAdmin || isAnalyst,
    manageFollowUps: isAdmin || isAnalyst,
    seeAllInstitutions: isAdmin,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!getStoredToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await authService.me());
    } catch (error) {
      if (error instanceof ApiError && error.isAuthExpired) logout();
      else setUser(null);
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => onUnauthorized(logout), [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authService.login(email, password);
    setStoredToken(response.token);
    setUser(await authService.me());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      authenticated: user !== null,
      login,
      logout,
      refresh,
      can: permissionsFor(user?.role),
    }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return context;
}
