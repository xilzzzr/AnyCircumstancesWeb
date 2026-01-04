import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User, mockUser } from '@/lib/mockApi';

export type UserRole = 'user' | 'admin' | 'logged_out';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isAdmin: boolean;
  vaultLocked: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setRole: (role: UserRole) => void;
  unlockVault: (pin: string) => Promise<boolean>;
  lockVault: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(mockUser);
  const [role, setRoleState] = useState<UserRole>('user');
  const [vaultLocked, setVaultLocked] = useState(true);

  const isAuthenticated = role !== 'logged_out' && user !== null;
  const isAdmin = role === 'admin';

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    if (email && password) {
      setUser(mockUser);
      setRoleState('user');
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setRoleState('logged_out');
    setVaultLocked(true);
  }, []);

  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
    if (newRole === 'logged_out') {
      setUser(null);
      setVaultLocked(true);
    } else {
      setUser(mockUser);
    }
  }, []);

  const unlockVault = useCallback(async (pin: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (pin === '1234') {
      setVaultLocked(false);
      return true;
    }
    return false;
  }, []);

  const lockVault = useCallback(() => {
    setVaultLocked(true);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      role,
      isAuthenticated,
      isAdmin,
      vaultLocked,
      login,
      logout,
      setRole,
      unlockVault,
      lockVault,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
