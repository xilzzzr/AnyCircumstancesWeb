import React, { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { RouteSeo } from "@/components/seo/RouteSeo";

import { PublicLayout } from "@/layouts/PublicLayout";
import NotFound from "@/pages/NotFound";

const LandingPage = lazy(() => import("@/pages/public/LandingPage").then((module) => ({ default: module.LandingPage })));
const DeadMansSwitchPage = lazy(() => import("@/pages/public/DeadMansSwitchPage").then((module) => ({ default: module.DeadMansSwitchPage })));
const DigitalVaultPage = lazy(() => import("@/pages/public/DigitalVaultPage").then((module) => ({ default: module.DigitalVaultPage })));
const EmergencyInformationVaultPage = lazy(() => import("@/pages/public/EmergencyInformationVaultPage").then((module) => ({ default: module.EmergencyInformationVaultPage })));
const FeaturesPage = lazy(() => import("@/pages/public/FeaturesPage").then((module) => ({ default: module.FeaturesPage })));
const HowItWorksPage = lazy(() => import("@/pages/public/HowItWorksPage").then((module) => ({ default: module.HowItWorksPage })));
const ProofOfLifePage = lazy(() => import("@/pages/public/ProofOfLifePage").then((module) => ({ default: module.ProofOfLifePage })));
const PricingPage = lazy(() => import("@/pages/public/PricingPage").then((module) => ({ default: module.PricingPage })));
const SecurityPage = lazy(() => import("@/pages/public/SecurityPage"));
const FaqPage = lazy(() => import("@/pages/public/FaqPage"));
const ScenariosPage = lazy(() => import("@/pages/public/ScenariosPage").then((module) => ({ default: module.ScenariosPage })));
const GuidesIndexPage = lazy(() => import("@/pages/public/GuidePage").then((module) => ({ default: module.GuidesIndexPage })));
const GuidePage = lazy(() => import("@/pages/public/GuidePage").then((module) => ({ default: module.GuidePage })));

const AboutPage = lazy(() => import("@/routes/PublicInfoPages").then((module) => ({ default: module.AboutPage })));
const ContactPage = lazy(() => import("@/routes/PublicInfoPages").then((module) => ({ default: module.ContactPage })));
const AccessibilityPage = lazy(() => import("@/routes/PublicInfoPages").then((module) => ({ default: module.AccessibilityPage })));
const PrivacyPage = lazy(() => import("@/routes/PublicInfoPages").then((module) => ({ default: module.PrivacyPage })));
const TermsPage = lazy(() => import("@/routes/PublicInfoPages").then((module) => ({ default: module.TermsPage })));

const LoginPage = lazy(() => import("@/routes/AuthPages").then((module) => ({ default: module.LoginPage })));
const SignupPage = lazy(() => import("@/routes/AuthPages").then((module) => ({ default: module.SignupPage })));
const VerifyEmailPage = lazy(() => import("@/routes/AuthPages").then((module) => ({ default: module.VerifyEmailPage })));
const CreatePinPage = lazy(() => import("@/routes/AuthPages").then((module) => ({ default: module.CreatePinPage })));
const CreatePanicPinPage = lazy(() => import("@/routes/AuthPages").then((module) => ({ default: module.CreatePanicPinPage })));
const OnboardingPage = lazy(() => import("@/routes/AuthPages").then((module) => ({ default: module.OnboardingPage })));
const ForgotPasswordPage = lazy(() => import("@/routes/AuthPages").then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("@/routes/AuthPages").then((module) => ({ default: module.ResetPasswordPage })));

const PrivateRouteProviders = lazy(() => import("@/routes/PrivateRouteProviders"));
const ProtectedAppLayout = lazy(() => import("@/routes/ProtectedAppLayout"));
const DashboardPage = lazy(() => import("@/pages/app/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const VaultPage = lazy(() => import("@/pages/app/VaultPage").then((module) => ({ default: module.VaultPage })));
const UploadPage = lazy(() => import("@/pages/app/UploadPage").then((module) => ({ default: module.UploadPage })));
const CheckInPage = lazy(() => import("@/pages/app/CheckInPage").then((module) => ({ default: module.CheckInPage })));
const VerificationSettingsPage = lazy(() => import("@/pages/app/VerificationSettingsPage").then((module) => ({ default: module.VerificationSettingsPage })));
const EmergencyContactsPage = lazy(() => import("@/pages/app/EmergencyContactsPage").then((module) => ({ default: module.EmergencyContactsPage })));
const BillingPage = lazy(() => import("@/pages/app/BillingPage").then((module) => ({ default: module.BillingPage })));
const PlanBuilderPage = lazy(() => import("@/pages/app/PlanBuilderPage"));
const EditPlanPage = lazy(() => import("@/pages/app/EditPlanPage"));
const ActivityPage = lazy(() => import("@/routes/AppSecondaryPages").then((module) => ({ default: module.ActivityPage })));
const AccountSettingsPage = lazy(() => import("@/routes/AppSecondaryPages").then((module) => ({ default: module.AccountSettingsPage })));
const HelpPage = lazy(() => import("@/routes/AppSecondaryPages").then((module) => ({ default: module.HelpPage })));
const IdeasPage = lazy(() => import("@/routes/AppSecondaryPages").then((module) => ({ default: module.IdeasPage })));
const SharePage = lazy(() => import("@/pages/SharePage"));

function RouteFallback({ application = false }: { application?: boolean }) {
  return (
    <div className={application ? "min-h-[50vh] p-6" : "container mx-auto min-h-[50vh] px-4 py-20"} role="status" aria-live="polite">
      <div className="mx-auto max-w-3xl animate-pulse space-y-4" aria-hidden="true">
        <div className="h-8 w-2/3 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
      </div>
      <span className="sr-only">Loading page</span>
    </div>
  );
}

function lazyElement(Page: LazyExoticComponent<ComponentType>, application = false) {
  return <Suspense fallback={<RouteFallback application={application} />}><Page /></Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={lazyElement(LandingPage)} />
        <Route path="/features" element={lazyElement(FeaturesPage)} />
        <Route path="/how-it-works" element={lazyElement(HowItWorksPage)} />
        <Route path="/proof-of-life" element={lazyElement(ProofOfLifePage)} />
        <Route path="/pricing" element={lazyElement(PricingPage)} />
        <Route path="/security" element={lazyElement(SecurityPage)} />
        <Route path="/faq" element={lazyElement(FaqPage)} />
        <Route path="/contact" element={lazyElement(ContactPage)} />
        <Route path="/scenarios" element={lazyElement(ScenariosPage)} />
        <Route path="/accessibility" element={lazyElement(AccessibilityPage)} />
        <Route path="/terms" element={lazyElement(TermsPage)} />
        <Route path="/privacy" element={lazyElement(PrivacyPage)} />
        <Route path="/about" element={lazyElement(AboutPage)} />
        <Route path="/dead-mans-switch" element={lazyElement(DeadMansSwitchPage)} />
        <Route path="/digital-vault" element={lazyElement(DigitalVaultPage)} />
        <Route path="/emergency-information-vault" element={lazyElement(EmergencyInformationVaultPage)} />
        <Route path="/guides" element={lazyElement(GuidesIndexPage)} />
        <Route path="/guides/:slug" element={lazyElement(GuidePage)} />
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
        <Route path="/share" element={lazyElement(SharePage)} />
        <Route path="/share/:token" element={lazyElement(SharePage)} />
      </Route>

      <Route element={lazyElement(PrivateRouteProviders, true)}>
        <Route path="/login" element={lazyElement(LoginPage)} />
        <Route path="/signup" element={lazyElement(SignupPage)} />
        <Route path="/verify-email" element={lazyElement(VerifyEmailPage)} />
        <Route path="/create-pin" element={lazyElement(CreatePinPage)} />
        <Route path="/create-panic-pin" element={lazyElement(CreatePanicPinPage)} />
        <Route path="/onboarding" element={lazyElement(OnboardingPage)} />
        <Route path="/forgot-password" element={lazyElement(ForgotPasswordPage)} />
        <Route path="/reset-password" element={lazyElement(ResetPasswordPage)} />

        <Route path="/app" element={lazyElement(ProtectedAppLayout, true)}>
          <Route index element={lazyElement(DashboardPage, true)} />
          <Route path="vault" element={lazyElement(VaultPage, true)} />
          <Route path="upload" element={lazyElement(UploadPage, true)} />
          <Route path="verification" element={lazyElement(VerificationSettingsPage, true)} />
          <Route path="check-in" element={lazyElement(CheckInPage, true)} />
          <Route path="emergency-contacts" element={lazyElement(EmergencyContactsPage, true)} />
          <Route path="billing" element={lazyElement(BillingPage, true)} />
          <Route path="activity" element={lazyElement(ActivityPage, true)} />
          <Route path="settings" element={lazyElement(AccountSettingsPage, true)} />
          <Route path="plan" element={lazyElement(PlanBuilderPage, true)} />
          <Route path="edit-plan" element={lazyElement(EditPlanPage, true)} />
          <Route path="ideas" element={lazyElement(IdeasPage, true)} />
          <Route path="help" element={lazyElement(HelpPage, true)} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export const AppWithinRouter = () => (
  <>
    <ScrollToTop />
    <RouteSeo />
    <AppRoutes />
  </>
);

const App = () => (
  <BrowserRouter>
    <AppWithinRouter />
  </BrowserRouter>
);

export default App;
