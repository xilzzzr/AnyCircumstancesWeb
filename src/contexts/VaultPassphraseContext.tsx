import React, { createContext, useContext, useMemo, useState } from "react";

type VaultPassphraseContextValue = {
  passphrase: string | null;
  setPassphrase: (p: string) => void;
  clearPassphrase: () => void;
};

const VaultPassphraseContext = createContext<VaultPassphraseContextValue | null>(null);

export function VaultPassphraseProvider({ children }: { children: React.ReactNode }) {
  const [passphrase, _setPassphrase] = useState<string | null>(null);

  const value = useMemo<VaultPassphraseContextValue>(() => {
    return {
      passphrase,
      setPassphrase: (p: string) => _setPassphrase(String(p || "").trim() || null),
      clearPassphrase: () => _setPassphrase(null),
    };
  }, [passphrase]);

  return <VaultPassphraseContext.Provider value={value}>{children}</VaultPassphraseContext.Provider>;
}

export function useVaultPassphrase() {
  const ctx = useContext(VaultPassphraseContext);
  if (!ctx) throw new Error("useVaultPassphrase must be used within VaultPassphraseProvider");
  return ctx;
}
