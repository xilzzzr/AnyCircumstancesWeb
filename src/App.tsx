import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DevRoleToggle } from "@/components/ui/DevRoleToggle";

// Layouts
import { PublicLayout } from "@/layouts/PublicLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { AdminLayout } from "@/layouts/AdminLayout";

// Public Pages
import { LandingPage } from "@/pages/public/LandingPage";
import { HowItWorksPage } from "@/pages/public/HowItWorksPage";
import { PricingPage } from "@/pages/public/PricingPage";
import SecurityPage from "@/pages/public/SecurityPage";
import FaqPage from "@/pages/public/FaqPage";
import { PrivacyPage } from "@/pages/public/PrivacyPage";
import { TermsPage } from "@/pages/public/TermsPage";

// Auth Pages
import { LoginPage } from "@/pages/auth/LoginPage";
import { SignupPage } from "@/pages/auth/SignupPage";
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage";
import { CreatePinPage } from "@/pages/auth/CreatePinPage";

import { OnboardingPage } from "@/pages/auth/OnboardingPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";


// App Pages
import { DashboardPage } from "@/pages/app/DashboardPage";
import { VaultPage } from "@/pages/app/VaultPage";
import { UploadPage } from "@/pages/app/UploadPage";
import { CheckInPage } from "@/pages/app/CheckInPage";
import { VerificationSettingsPage } from "@/pages/app/VerificationSettingsPage";
import { EmergencyContactsPage } from "@/pages/app/EmergencyContactsPage";
import { ActivityPage } from "@/pages/app/ActivityPage";
import { BillingPage } from "./pages/app/BillingPage";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { role, isAuthenticated, isAdmin } = useAuth();

  return (
    <Routes>
      {/* Public Layout */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/contact" element={<div className="p-8 text-center"><h1 className="text-2xl font-bold">Contact</h1></div>} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/cookies" element={<div className="p-8 text-center"><h1 className="text-2xl font-bold">Cookie Settings</h1></div>} />
        <Route path="/status" element={<div className="p-8 text-center"><h1 className="text-2xl font-bold">Status</h1></div>} />
      </Route>

      {/* Auth Pages (standalone) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/create-pin" element={<CreatePinPage />} />
      
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />


      {/* App Layout (User) */}
      <Route path="/app" element={role === 'user' ? <AppLayout /> : <Navigate to="/login" />}>
        <Route index element={<DashboardPage />} />
        <Route path="vault" element={<VaultPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="verification" element={<VerificationSettingsPage />} />
        <Route path="check-in" element={<CheckInPage />} />
        <Route path="emergency-contacts" element={<EmergencyContactsPage />} />
        <Route path="billing" element={<BillingPage />} />
      
        <Route path="activity" element={<ActivityPage />} />
        <Route path="settings" element={<div className="p-8"><h1 className="text-2xl font-bold">Settings</h1></div>} />
        <Route path="help" element={<div className="p-8"><h1 className="text-2xl font-bold">Help</h1></div>} />
      </Route>

      {/* Admin Layout */}
      <Route path="/admin" element={role === 'admin' ? <AdminLayout /> : <Navigate to="/login" />}>
        <Route index element={<div className="p-8"><h1 className="text-2xl font-bold">Admin Dashboard</h1></div>} />
        <Route path="users" element={<div className="p-8"><h1 className="text-2xl font-bold">Users</h1></div>} />
        <Route path="billing" element={<div className="p-8"><h1 className="text-2xl font-bold">Billing & Plans</h1></div>} />
        <Route path="campaigns" element={<div className="p-8"><h1 className="text-2xl font-bold">Campaigns</h1></div>} />
        <Route path="audit" element={<div className="p-8"><h1 className="text-2xl font-bold">Audit Log</h1></div>} />
        <Route path="health" element={<div className="p-8"><h1 className="text-2xl font-bold">System Health</h1></div>} />
        <Route path="settings" element={<div className="p-8"><h1 className="text-2xl font-bold">Admin Settings</h1></div>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
          <DevRoleToggle />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
