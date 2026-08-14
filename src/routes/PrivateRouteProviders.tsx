import { Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PaywallProvider } from "@/contexts/PaywallContext";
import { VaultPassphraseProvider } from "@/contexts/VaultPassphraseContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

export default function PrivateRouteProviders() {
  return (
    <AuthProvider>
      <PaywallProvider>
        <VaultPassphraseProvider>
          <Outlet />
          <Toaster />
          <Sonner />
        </VaultPassphraseProvider>
      </PaywallProvider>
    </AuthProvider>
  );
}
