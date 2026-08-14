import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

export type UserRole = "user" | "logged_out";

export type AuthUser = {
  id?: string | number;
  email?: string;
  role?: UserRole;
  [key: string]: any;
};

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole;
  loading: boolean;
  isAuthenticated: boolean;
  vaultLocked: boolean;
  refreshSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
  unlockVault: (pin: string) => Promise<boolean>;
  lockVault: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function emitPaywall(title?: string, description?: string) {
  const returnTo = window.location.pathname + window.location.search;
  window.dispatchEvent(
    new CustomEvent("uac:paywall", {
      detail: {
        title: title || "Paid feature",
        description:
          description ||
          "This feature is part of a paid plan. Build your plan to unlock it.",
        returnTo,
      },
    })
  );
}

async function readJsonSafe(res: Response) {
  const txt = await res.text();
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

function isPaymentRequired(resp: Response, data: any) {
  const code = data?.error ? String(data.error) : "";
  return resp.status === 402 || code === "payment_required";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRoleState] = useState<UserRole>("logged_out");
  const [vaultLocked, setVaultLocked] = useState(true);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = role !== "logged_out" && user !== null;

  const applySession = useCallback((d: any) => {
    const nextRole: UserRole = d?.role === "user" ? "user" : "logged_out";

    if (d?.ok && nextRole !== "logged_out") {
      setRoleState(nextRole);
      setUser(d?.user ?? { email: d?.email });
      return;
    }

    setUser(null);
    setRoleState("logged_out");
    setVaultLocked(true);
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/auth/me", { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      applySession(d);
    } catch {
      applySession({ ok: false });
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const r = await fetch("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d?.ok) return false;

        applySession(d);
        return true;
      } catch {
        return false;
      }
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } catch {}

    setUser(null);
    setRoleState("logged_out");
    setVaultLocked(true);
  }, []);

  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
    if (newRole === "logged_out") {
      setUser(null);
      setVaultLocked(true);
    }
  }, []);

  const unlockVault = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const r = await fetch("/auth/unlock-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin }),
      });

      const d = await readJsonSafe(r);

      if (!r.ok || !d?.ok) {
        if (isPaymentRequired(r, d)) {
          emitPaywall(
            "Vault unlock requires a plan",
            "Unlocking the vault and downloading files requires an active plan. Build your plan to unlock it."
          );
          return true;
        }

        return false;
      }

      setVaultLocked(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  const lockVault = useCallback(() => {
    setVaultLocked(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        isAuthenticated,
        vaultLocked,
        refreshSession,
        login,
        logout,
        setRole,
        unlockVault,
        lockVault,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
