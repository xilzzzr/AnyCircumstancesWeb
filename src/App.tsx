import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DevRoleToggle } from "@/components/ui/DevRoleToggle";
import { ScrollToTop } from "@/components/ScrollToTop";

import { VaultPassphraseProvider } from "./contexts/VaultPassphraseContext";
import { PaywallProvider } from "@/contexts/PaywallContext";

// Layouts
import { PublicLayout } from "@/layouts/PublicLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { AdminLayout } from "@/layouts/AdminLayout";

// Public Pages
import { LandingPage } from "@/pages/public/LandingPage";
import { FeaturesPage } from "@/pages/public/FeaturesPage";
import { HowItWorksPage } from "@/pages/public/HowItWorksPage";
import { PricingPage } from "@/pages/public/PricingPage";
import SecurityPage from "@/pages/public/SecurityPage";
import FaqPage from "@/pages/public/FaqPage";
import { PrivacyPage } from "@/pages/public/PrivacyPage";
import { TermsPage } from "@/pages/public/TermsPage";
import { DeadMansSwitchPage } from "@/pages/public/DeadMansSwitchPage";
import { DigitalVaultPage } from "@/pages/public/DigitalVaultPage";
import { AboutPage } from "@/pages/public/AboutPage";
import { ContactPage } from "@/pages/public/ContactPage";
import { ScenariosPage } from "@/pages/public/ScenariosPage";
import { AccessibilityPage } from "@/pages/public/AccessibilityPage";

// Auth Pages
import { LoginPage } from "@/pages/auth/LoginPage";
import { SignupPage } from "@/pages/auth/SignupPage";
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage";
import { CreatePinPage } from "@/pages/auth/CreatePinPage";
import { CreatePanicPinPage } from "@/pages/auth/CreatePanicPinPage";
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
import { BillingPage } from "@/pages/app/BillingPage";
import { AccountSettingsPage } from "@/pages/app/AccountSettingsPage";

import PlanBuilderPage from "@/pages/app/PlanBuilderPage";
import EditPlanPage from "@/pages/app/EditPlanPage";

import SharePage from "@/pages/SharePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { role } = useAuth();

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/scenarios" element={<ScenariosPage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/dead-mans-switch" element={<DeadMansSwitchPage />} />
        <Route path="/digital-vault" element={<DigitalVaultPage />} />
        <Route
          path="/cookies"
          element={
            <div className="p-8 text-center">
              <h1 className="text-2xl font-bold">Cookie Settings</h1>
            </div>
          }
        />
        <Route
          path="/status"
          element={
            <div className="p-8 text-center">
              <h1 className="text-2xl font-bold">Status</h1>
            </div>
          }
        />
        <Route path="/share/:token" element={<SharePage />} />
      </Route>

      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/create-pin" element={<CreatePinPage />} />
      <Route path="/create-panic-pin" element={<CreatePanicPinPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/app"
        element={role === "user" ? <AppLayout /> : <Navigate to="/login" />}
      >
        <Route index element={<DashboardPage />} />
        <Route path="vault" element={<VaultPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="verification" element={<VerificationSettingsPage />} />
        <Route path="check-in" element={<CheckInPage />} />
        <Route path="emergency-contacts" element={<EmergencyContactsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="settings" element={<AccountSettingsPage />} />
        <Route path="plan" element={<PlanBuilderPage />} />
        <Route path="edit-plan" element={<EditPlanPage />} />
      </Route>

      <Route
        path="/admin"
        element={role === "admin" ? <AdminLayout /> : <Navigate to="/login" />}
      >
        <Route
          index
          element={
            <div className="p-8">
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            </div>
          }
        />
        <Route
          path="users"
          element={
            <div className="p-8">
              <h1 className="text-2xl font-bold">Users</h1>
            </div>
          }
        />
        <Route
          path="billing"
          element={
            <div className="p-8">
              <h1 className="text-2xl font-bold">Billing & Plans</h1>
            </div>
          }
        />
        <Route
          path="campaigns"
          element={
            <div className="p-8">
              <h1 className="text-2xl font-bold">Campaigns</h1>
            </div>
          }
        />
        <Route
          path="audit"
          element={
            <div className="p-8">
              <h1 className="text-2xl font-bold">Audit Log</h1>
            </div>
          }
        />
        <Route
          path="health"
          element={
            <div className="p-8">
              <h1 className="text-2xl font-bold">System Health</h1>
            </div>
          }
        />
        <Route
          path="settings"
          element={
            <div className="p-8">
              <h1 className="text-2xl font-bold">Admin Settings</h1>
            </div>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <PaywallProvider>
            <VaultPassphraseProvider>
              <ScrollToTop />
              <AppRoutes />
            </VaultPassphraseProvider>
          </PaywallProvider>
        </AuthProvider>
      </BrowserRouter>
      <Toaster />
      <Sonner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
